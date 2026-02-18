import { colorForTag, parseMorphTag, ensureDocumentSnapshot, composeUserPostag, ensureFormsArray} from './morphHelpers.js';
import { renderCreateEditorBelow } from './morphEditor.js';
import { colorForPOS } from '../tree/treeUtils.js';
import { triggerAutoSave } from '../xml/saveXML.js';
import { fetchMorphology } from './morpheus.js';
import { showConfirmDialog } from '../ui/modal.js';
import { isMorpheusSupported, getLanguage } from '../input/language.js';


// =====================================================
// GLOBAL Preselect state 
// =====================================================
const _storedPreselect = localStorage.getItem("morphPreselectEnabled");
window.morphPreselectEnabled = (_storedPreselect === "true"); // default false

window._morphPreselectRunning = false;
window._morphPreselectApplied = window._morphPreselectApplied || new Set();

/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupMorphTool
 * --------------------------------------------------------------------------
 * Enables the "Morph" tab on the right-hand toolbar.
 * When the Morph button is active, clicking a word displays its morph info.
 * --------------------------------------------------------------------------
 */
export function setupMorphTool() {
  if (window.morphToolInitialized) return;
  window.morphToolInitialized = true;
  const morphBtn = document.getElementById('morph');
  const toolBody = document.getElementById('tool-body');
  const allToolButtons = document.querySelectorAll('#toolbar button');
  if (!morphBtn || !toolBody) return;
    
  // make tool-body the positioning parent for the gear dropdown
  toolBody.style.position = "relative";

  // Track on/off state from the toolbar button
  window.isMorphActive = false;

  // Allow other code to close Morph (e.g., when sentence changes)
  window.closeMorphTool = function () {
    if (!window.isMorphActive) return;

    window.isMorphActive = false;
    morphBtn.classList.remove('active');
    toolBody.querySelector('#morph-settings-btn')?.remove();
    toolBody.querySelector('#morph-settings')?.remove();
    morphBtn.style.backgroundColor = '#4e6476';
    document.body.classList.remove('mode-morph');

    // Back to treebanking mode UI
    if (window.treebankModeHTML) {
      toolBody.innerHTML = window.treebankModeHTML;
    } else {
      toolBody.innerHTML =
                `<p>Treebanking mode: click a word or node to edit dependencies.</p>`;
    }
  };

  const handler = () => {
    const wasActive = window.isMorphActive;

    // If we're about to OPEN Morph, make sure we fully exit tools that can lock the tree
    if (!wasActive) {
      // Close XML + Sentence (these are the ones that use enterReadOnly)
      window.closeXmlTool();
      window.closeSentenceTool();

      // Relation/Morph should be interactive in the tree
      window.exitReadOnly();
    }

    // Reset toolbar visuals
    allToolButtons.forEach(btn => btn.classList.remove('active'));
    allToolButtons.forEach(btn => (btn.style.backgroundColor = '#4e6476'));

    window.isMorphActive = !wasActive;

    if (window.isMorphActive) {
      morphBtn.classList.add('active');
      morphBtn.style.backgroundColor = 'green';

      toolBody.innerHTML = `
        <div id="morph-panel">
          <div id="morph-pinned" class="morph-slot">
            <p style="padding:8px;">Click a word to view morphological info.</p>
          </div>
          <div id="morph-hover" class="morph-slot"></div>
        </div>
      `;

      // --- mount gear + dropdown as children of toolBody (top-right of the tool box) ---
      toolBody.insertAdjacentHTML("beforeend", `
        <button id="morph-settings-btn" type="button" class="morph-gear-btn" aria-label="Settings">
          <svg class="morph-gear-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19.14,12.94c0.04-0.31,0.06-0.63,0.06-0.94s-0.02-0.63-0.06-0.94l2.03-1.58
              c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.11-0.2-0.35-0.28-0.56-0.2l-2.39,0.96
              c-0.5-0.38-1.04-0.69-1.63-0.94L14.4,2.81C14.36,2.59,14.16,2.43,13.93,2.43h-3.86
              c-0.23,0-0.43,0.16-0.47,0.38L9.24,5.37C8.65,5.62,8.11,5.93,7.61,6.31L5.22,5.35
              C5.01,5.27,4.77,5.35,4.66,5.55L2.74,8.87C2.63,9.07,2.68,9.34,2.86,9.48l2.03,1.58
              C4.85,11.37,4.83,11.69,4.83,12s0.02,0.63,0.06,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61
              l1.92,3.32c0.11,0.2,0.35,0.28,0.56,0.2l2.39-0.96c0.5,0.38,1.04,0.69,1.63,0.94l0.36,2.56
              c0.04,0.22,0.24,0.38,0.47,0.38h3.86c0.23,0,0.43-0.16,0.47-0.38l0.36-2.56
              c0.59-0.25,1.13-0.56,1.63-0.94l2.39,0.96c0.21,0.08,0.45,0,0.56-0.2l1.92-3.32
              c0.11-0.2,0.06-0.47-0.12-0.61L19.14,12.94z M12,15.5c-1.93,0-3.5-1.57-3.5-3.5
              s1.57-3.5,3.5-3.5s3.5,1.57,3.5,3.5S13.93,15.5,12,15.5z"/>
          </svg>
        </button>

        <div id="morph-settings"
          style="
            display:none;
            position:absolute;
            top:42px;
            right:6px;
            z-index:999;
            background:#fff;
            border:1px solid #ccc;
            border-radius:10px;
            padding:10px;
            box-shadow:0 4px 14px rgba(0,0,0,0.15);
            min-width:0;
            width:max-content;
          ">
          <label style="display:flex; gap:10px; align-items:center; margin:0;">
            <input type="checkbox" id="morph-preselect-checkbox" />
            <span>Preselect</span>
          </label>
        </div>
      `);

      wireMorphSettingsUI(toolBody);

      // If there are already selected nodes BEFORE opening Morph,
      // show ALL of them. Otherwise fall back to the single selected token.
      if (Array.isArray(window.treebankData) && typeof window.renderMorphInfo === 'function') {
        const currentSentence = window.treebankData.find(s => String(s.id) === String(window.currentIndex));

        // Prefer multi-select set (ctrl/cmd selection)
        const hasBatch = window.batchSelection && window.batchSelection.size > 0;

        if (hasBatch && currentSentence?.words) {
          const ids = Array.from(window.batchSelection).map(String).sort((a,b) => Number(a) - Number(b));
          const words = ids
            .map(id => currentSentence.words.find(w => String(w.id) === id))
            .filter(Boolean);

          if (words.length > 0) {
            window.renderMorphInfo(words, { slot: 'pinned' });
          }
        } else {
          // Fallback: single selection
          const selectedToken = document.querySelector('.token.selected');
          const wordId = selectedToken?.dataset?.wordId;

          if (wordId && currentSentence?.words) {
            const word = currentSentence.words.find(w => String(w.id) === String(wordId));
            if (word) window.renderMorphInfo(word, { slot: 'pinned' });
          }
        }
      }
    } else {
      document.body.classList.remove('mode-morph');
      morphBtn.style.backgroundColor = '#4e6476';

      // Only restore treebank UI if no OTHER tool is active
      const anotherToolActive = Array.from(allToolButtons).some(
        btn => btn !== morphBtn && btn.classList.contains('active')
      );

      if (!anotherToolActive) {
        toolBody.innerHTML =
          window.treebankModeHTML ||
          `<p>Treebanking mode: click a word or node to edit dependencies.</p>`;
      }
    }
  };

  // Click tab toggle 
  morphBtn.addEventListener('click', (e) => {
    handler();
  });

  // Ensure global binding (if other code calls it)
  window.renderMorphInfo = renderMorphInfo;

  // When any form checkbox changes, collapse all expanded morph entries
  document.addEventListener('change', (e) => {
    if (!e.target.matches('.morph-entry input[type="checkbox"]')) return;
    document.querySelectorAll('.morph-entry.expanded').forEach(entry => {
      entry.classList.remove('expanded');
      entry.dataset.expanded = 'false';
      entry.querySelector('.morph-details')?.remove();
      entry.querySelector('.morph-divider')?.remove();
    });
  });
}

export function applyActiveSelectionToWord(word) {
  const af = Number(word.activeForm);
  word.activeForm = Number.isFinite(af) ? af : -1;  
  ensureDocumentSnapshot(word);

  if (word.activeForm === -1) {
    // show the original XML values
    word._displayLemma  = word._doc.lemma;
    word._displayPostag = word._doc.postag;
    word.source = 'document';
  } else {
    const f = word.forms?.[word.activeForm];
    if (f) {
      word._displayLemma  = (f.lemma  || word._doc.lemma);
      word._displayPostag = (f.postag || word._doc.postag);
      word.source = 'you';
    }
  }
  const tok = document.querySelector(`.token[data-word-id="${word.id}"]`);
  if (tok) {
    const postag = word._displayPostag ?? word.postag ?? "";
    tok.style.color = colorForPOS({ postag });
  }

  // Rebuild the tree so node colors update, but keep Morph open
  if (typeof createNodeHierarchy === 'function') {
    createNodeHierarchy(window.currentIndex);
  }
  if (typeof window.updateXMLIfActive === 'function') {
    window.updateXMLIfActive();
  }
  // After updating sentence tokens, refresh the tree colors
  if (typeof window.fastRefreshTree === 'function') {
    window.fastRefreshTree();
  }
}

export function renderUserFormsList(word, toolBody) {
  ensureFormsArray(word);
  // Normalize activeForm
  const af = Number(word.activeForm);
  word.activeForm = Number.isFinite(af) ? af : -1;

  // If Preselect is enabled and we have forms, ensure something is selected
  // (your requirement: pick the first Morpheus form)
  if (window.morphPreselectEnabled && word.activeForm < 0 && Array.isArray(word.forms) && word.forms.length > 0) {
    word.activeForm = 0;
    applyActiveSelectionToWord(word);  // makes tree/token color consistent too
  }

  let list = toolBody.querySelector('.user-forms-list');
  if (!list) {
    list = document.createElement('div');
    list.className = 'user-forms-list';
    toolBody.querySelector('.morph-container')?.appendChild(list);
  }
  list.innerHTML = word.forms.map((f, i) =>
    userFormCardHTML(f, i, Number(word.activeForm) === i)
  ).join('');

  const mc = toolBody.querySelector('.morph-container');
  if (mc) enableMorphEntryExpansion(mc);

  // When a checkbox is toggled, make that form active
  list.querySelectorAll('.morph-entry input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (!e.target.checked) return; // only handle when checked

      // uncheck all other boxes
      list.querySelectorAll('input[type="checkbox"]').forEach(x => {
        if (x !== e.target) x.checked = false;
      });

      // determine which form this belongs to
      const card = e.target.closest('.user-form');
      const idx = Number(card.dataset.index);

      // update active form and apply globally
      word.activeForm = idx;
      applyActiveSelectionToWord(word);
      triggerAutoSave(); // autosave after switching active form

      // re-render Morph panel and update XML tab
      window.renderMorphInfo(word);
      if (typeof window.updateXMLIfActive === 'function') {
        window.updateXMLIfActive();
      }
    });
  });


  // Delete buttons
  list.querySelectorAll('.delete-form').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = e.target.closest('.user-form');
      const idx = Number(card.dataset.index);

      const confirmDelete = await showConfirmDialog(
        'Delete this form?',
        {
          titleText: 'Delete form?',
          okText: 'Delete',
          cancelText: 'Cancel'
        }
      );
      if (!confirmDelete) return;

      removeForm(word, idx);
      renderUserFormsList(word, toolBody);
      window.renderMorphInfo(word);
      triggerAutoSave(); // autosave after deleting a form
    });
  });

    list.querySelectorAll('.clone-form').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      const card = e.target.closest('.user-form');
      const idx = Number(card.dataset.index);

      // seed from the form you clicked
      const seedForm = word.forms?.[idx];
      if (!seedForm) return;

      renderCreateEditorBelow(word, toolBody, { seedForm });
    });
  });
}

// =========================
// Forms management helpers
// =========================

export async function preselectMissingMorphForCurrentSentence(toolBody = null) {
  const sid = String(window.currentIndex);
  const sentence = window.treebankData?.find(s => String(s.id) === sid);
  if (!sentence) return;

  const lang = getLanguage();
  if (!isMorpheusSupported(lang)) {
    console.warn('[Preselect] Morpheus not supported for', lang);
    return;
  }

  let changed = 0;

  for (const word of sentence.words) {
    // Ensure doc snapshot exists so we can detect "already has morph"
    ensureDocumentSnapshot(word);

    const docLemma  = (word._doc?.lemma  ?? word.lemma  ?? '').trim();
    const docPostag = (word._doc?.postag ?? word.postag ?? '').trim();

    const alreadyHasMorph =
      (typeof word.activeForm === 'number' && word.activeForm >= 0) ||
      (docLemma !== '' || docPostag !== '');

    if (alreadyHasMorph) continue;

    // Make sure we have morpheus/user forms available
    ensureFormsArray(word);

    // If we haven't fetched Morpheus yet (or no forms exist), fetch now
    if (!word._morpheusLoaded || word.forms.length === 0) {
      await attachMorpheusSuggestions(word, toolBody);
    }
    if (!Array.isArray(word.forms) || word.forms.length === 0) continue;

    // Select the FIRST suggestion
    word.activeForm = 0;
    applyActiveSelectionToWord(word);
    changed++;
  }

  if (changed > 0) {
    // One refresh at the end (instead of rebuilding per word)
    if (typeof window.createNodeHierarchy === "function") {
      window.createNodeHierarchy(window.currentIndex);
    }
    if (typeof window.fastRefreshTree === "function") {
      window.fastRefreshTree();
    }
    if (typeof window.updateXMLIfActive === "function") {
      window.updateXMLIfActive();
    }
    triggerAutoSave();
    console.log(`[Preselect] Applied first morph to ${changed} word(s).`);
  }
}

// =====================================================
// Global hook: call after a sentence is rendered
// =====================================================
window.maybeRunMorphPreselect = async function maybeRunMorphPreselect() {
  if (!window.morphPreselectEnabled) return;

  const sid = String(window.currentIndex);

  // Don’t rerun forever when revisiting the same sentence
  if (window._morphPreselectApplied.has(sid)) return;

  if (window._morphPreselectRunning) return;
  window._morphPreselectRunning = true;

  try {
    const toolBody = document.getElementById("tool-body") || null;

    // Fills ONLY missing morph (your function already does the "only if empty" logic)
    await preselectMissingMorphForCurrentSentence(toolBody);

    window._morphPreselectApplied.add(sid);
  } finally {
    window._morphPreselectRunning = false;
  }
};


function enableMorphEntryExpansion(scopeEl) {
  // Prevent attaching this listener multiple times to the same container
  if (scopeEl._expansionBound) return;
  scopeEl._expansionBound = true;

  scopeEl.addEventListener('click', (e) => {
    // Ignore clicks on buttons/controls inside the card (delete/create/etc)
    if (e.target.closest('button')) return;
    const entry = e.target.closest('.morph-entry');
    if (!entry || !scopeEl.contains(entry)) return;

    // Ignore clicks that originate on the checkbox itself
    if (e.target.matches('input[type="checkbox"]')) return;

    // Toggle
    const isExpanded = entry.classList.contains('expanded');

    if (isExpanded) {
      // Collapse
      entry.classList.remove('expanded');
      entry.setAttribute('data-expanded', 'false');
      entry.querySelector('.morph-details')?.remove();
      entry.querySelector('.morph-divider')?.remove();
      return;
    }

    // Expand
    entry.classList.add('expanded');
    entry.setAttribute('data-expanded', 'true');

    const tagEl = entry.querySelector('.morph-tag');
    const tag = tagEl ? tagEl.textContent.trim() : '';
    const parsed = parseMorphTag(tag);
    if (!parsed || Object.keys(parsed).length === 0) return;

    const divider = document.createElement('hr');
    divider.className = 'morph-divider';
    entry.appendChild(divider);

  // Pretty labels and ordering
  const POS_LABELS = { v:'verb', n:'noun', a:'adjective', d:'adverb', p:'pronoun',
                      c:'conjunction', r:'adposition', l:'article', m:'numeral',
                      i:'interjection', u:'punctuation', e:'exclamation' };

  const LABELS = {
    pos:    'Part of Speech',
    person: 'Person',
    number: 'Number',
    tense:  'Tense',
    mood:   'Mood',
    voice:  'Voice',
    gender: 'Gender',
    case:   'Casus',
    degree: 'Degree'
  };

  // Pick a sensible order by POS (fallback covers all keys)
  const DEFAULT_ORDER = ['pos','number','gender','case','person','tense','mood','voice','degree'];
  const ORDER_BY_POS = {
    v: ['pos','person','number','gender','tense','mood','voice', 'case', 'degree'],
    n: ['pos','number','mood','gender','case'],
    p: ['pos','person','number','gender','case'],
    l: ['pos','number','gender','case'],
    a: ['pos','number','gender','case','degree'],
    d: ['pos', 'degree']
  };

  const posChar = (tag && tag[0]) ? tag[0].toLowerCase() : '';
  const order = ORDER_BY_POS[posChar] || DEFAULT_ORDER;

  // Replace raw "v/n/a/…" with pretty words
  const pretty = { ...parsed };
  if (pretty.pos) {
    pretty.pos = POS_LABELS[posChar] || pretty.pos;
  }

    // Remove all "-" or empty fields before building HTML
  Object.keys(pretty).forEach(k => {
    if (!pretty[k] || pretty[k] === '-' || pretty[k].trim() === '') {
      delete pretty[k];
    }
  });

  // Translate short codes to readable English
  const VALUE_MAPS = {
    number: { s:'singular', p:'plural', d:'dual' },
    gender: { m:'masculine', f:'feminine', n:'neuter', c:'common' },
    case:   { n:'nominative', g:'genitive', d:'dative', a:'accusative', v:'vocative', b:'ablative', l:'locative' },
    tense:  { p:'present', i:'imperfect', r:'perfect', l:'pluperfect', f:'future', a:'aorist', t: 'future perfect' },
    mood:   { i:'indicative', s:'subjunctive', o:'optative', n:'infinitive', m:'imperative', p:'participle', d: 'gerund', g:'gerundive', u:'supine' },
    voice:  { a:'active', e:'medio-passive', p:'passive', d:'deponens' },
    degree: { p:'positive', c:'comparative', s:'superlative' },
    person: { '1':'first', '2':'second', '3':'third' }
  };

  Object.entries(pretty).forEach(([k, v]) => {
    if (VALUE_MAPS[k] && VALUE_MAPS[k][v]) {
      pretty[k] = VALUE_MAPS[k][v];
    }
  });

  // Build rows in chosen order
  let detailsHTML = order
    .filter(k => pretty[k])
    .map(k => `
      <div class="morph-row">
        <div class="morph-label">${LABELS[k]}</div>
        <div class="morph-colon">:</div>
        <div class="morph-value">${pretty[k]}</div>
      </div>
    `)
    .join('');

  // If nothing remains (like conjunctions)
  if (!detailsHTML) {
    detailsHTML = `
      <div class="morph-row">
        <div class="morph-value" style="font-style: italic; color: #777;">
          No additional features
        </div>
      </div>`;
  }

  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'morph-details';
  detailsDiv.innerHTML = detailsHTML;
  entry.appendChild(detailsDiv);

  });
}

function appendCreateAndUserForms(word, toolBody) {
  ensureFormsArray(word);

  // Render user forms list
  renderUserFormsList(word, toolBody);

  // ---------- Document (top) card wiring ----------
  const docEntry = toolBody.querySelector('.morph-entry[data-index="-1"]');
  if (docEntry && !docEntry._docButtonsBound) {
    docEntry._docButtonsBound = true;

    const topCheckbox = docEntry.querySelector('input[type="checkbox"]');
    if (topCheckbox) {
      topCheckbox.checked = (Number(word.activeForm) === -1);

      topCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          word.activeForm = -1;
          applyActiveSelectionToWord(word);
          window.renderMorphInfo(word);
          triggerAutoSave();
        }
      });
    }

    // Delete doc form
    const docDeleteBtn = docEntry.querySelector('.delete-form');
    if (docDeleteBtn) {
      docDeleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const confirmDelete = await showConfirmDialog(
          'Delete the document form?',
          {
            titleText: 'Delete document form?',
            okText: 'Delete',
            cancelText: 'Cancel'
          }
        );
        if (!confirmDelete) return;

        removeForm(word, -1);
        window.renderMorphInfo(word);
        triggerAutoSave();
      });
    }

    // Clone doc form -> opens create editor seeded from doc lemma/postag
    const docCloneBtn = docEntry.querySelector('.clone-form');
    if (docCloneBtn) {
      docCloneBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const seedForm = {
          // use the doc snapshot so it matches what's on that card
          lemma: (word._doc?.lemma || word.lemma || word.form || '').trim(),
          postag: (word._doc?.postag || word.postag || '').trim(),
          source: 'document'
        };

        renderCreateEditorBelow(word, toolBody, { seedForm });
      });
    }
  } else if (docEntry) {
    // Keep checkbox in sync on rerender even if we don't rebind
    const topCheckbox = docEntry.querySelector('input[type="checkbox"]');
    if (topCheckbox) topCheckbox.checked = (Number(word.activeForm) === -1);
  }

  // ---------- Create button (under top card) ----------
  if (!toolBody.querySelector('.morph-create')) {
    const btn = document.createElement('button');
    btn.className = 'morph-create';
    btn.textContent = 'Create New Form';
    toolBody.querySelector('.morph-container')?.appendChild(btn);

    btn.addEventListener('click', () => renderCreateEditorBelow(word, toolBody));
  }
}

function userFormCardHTML(form, index, isActive) {
  // Build a concise readable summary (noun.plural.masculine.vocative)
  const parsed = parseMorphTag(form.postag || '');
  const VALUE_MAPS = {
    number: { s:'singular', p:'plural', d:'dual' },
    gender: { m:'masculine', f:'feminine', n:'neuter', c:'common' },
    case:   { n:'nominative', g:'genitive', d:'dative', a:'accusative', v:'vocative', b:'ablative', l:'locative' },
    tense:  { p:'present', i:'imperfect', r:'perfect', l:'pluperfect', f:'future', a:'aorist', t:'futperfect' },
    mood:   { i:'indicative', s:'subjunctive', o:'optative', n:'infinitive', m:'imperative', p:'participle', d: 'gerund', g:'gerundive', u:'supine' },
    voice:  { a:'active', e:'medio-passive', p:'passive', d:'deponens' },
    degree: { p:'positive', c:'comparative', s:'superlative' },
    person: { '1':'first', '2':'second', '3':'third' }
  };

  // translate short codes
  Object.entries(parsed).forEach(([k,v]) => {
    if (VALUE_MAPS[k] && VALUE_MAPS[k][v]) parsed[k] = VALUE_MAPS[k][v];
  });

  // Make a compact readable string that includes part of speech at the start
  const posLabels = {
    v:'verb', n:'noun', a:'adjective', d:'adverb', p:'pronoun',
    c:'conjunction', r:'adposition', l:'article', m:'numeral',
    i:'interjection', u:'punctuation', e: 'exclamation'
  };

  const posChar = (form.postag || '')[0]?.toLowerCase() || '';
  const posWord = posLabels[posChar] || posChar || '';

  const featureString = Object.entries(parsed)
    .filter(([k, v]) => k !== 'pos' && v && v !== '-')
    .map(([k, v]) => v)
    .join('.');

  const readable = [posWord, featureString].filter(Boolean).join('.');


  const col = colorForTag(form.postag || '');

  const expandedClass = isActive ? ' expanded' : '';
  const expandedAttr  = isActive ? 'true' : 'false';
  const cbId = `uf-check-${index}`;
  const src = form.source || 'you';

  // Always allow deleting the document form (index === -1),
  // and allow deleting "you" forms (and optionally morpheus too later)
  const canDelete = (src !== '');

  const createBtn = `
    <button class="clone-form" type="button"
      title="Create a new form based on this one">
      Create New
    </button>
  `;

  const deleteBtn = canDelete
    ? `
      <button class="delete-form" type="button"
        title="Delete this form">
        Delete Form
      </button>
    `
    : '';

  const actions = `
    <div class="form-actions">
      ${createBtn}
      ${deleteBtn}
    </div>
  `;

  return `
    <div class="morph-entry user-form${expandedClass}" 
        data-index="${index}" 
        data-expanded="${expandedAttr}" 
        aria-expanded="${expandedAttr}">
      <input id="${cbId}" type="checkbox" ${isActive ? 'checked' : ''} />
      <div class="morph-content">
        <span class="morph-lemma" style="color:${col}">
          ${form.lemma || ''}
        </span>
        <p class="morph-tag">${form.postag || ''}</p>
        <p class="morph-source">${src}</p>
        <p class="morph-readout">${readable || shortPOS(form.postag)}</p>
      </div>
      ${actions}
    </div>
  `;
}

function removeForm(word, index) {
  if (!Array.isArray(word.forms)) return;

  // If index < 0, it's the document form
  if (index < 0) {
    // Clear both display and XML-level values
    word._doc = { lemma: '', postag: '' };
    word._displayLemma = '';
    word._displayPostag = '';
    word.lemma = '';     // clear from actual XML-bound field
    word.postag = '';    // clear from actual XML-bound field
    word.source = 'document';

    // Update token color + tree
    applyActiveSelectionToWord(word);

    // Re-render XML view if open
    if (typeof window.updateXMLIfActive === 'function') {
      window.updateXMLIfActive();
    }
    return;
  }

  // Otherwise delete user/morpheus form
  word.forms.splice(index, 1);
  if (word.activeForm === index) word.activeForm = -1;
  else if (word.activeForm > index) word.activeForm -= 1;
  applyActiveSelectionToWord(word);
  triggerAutoSave(); // autosave after deletion
}

// ---------------------------------------------------------
// PUBLIC: renderMorphInfo(word) — keep your top card intact,
// then append "Create new form" + user-forms list underneath
// ---------------------------------------------------------
function renderMorphInfo(wordOrWords, opts = {}) {
  if (!window.isMorphActive) return;

  const slot = (opts && opts.slot === "hover") ? "hover" : "pinned";
  const pinnedEl = document.getElementById("morph-pinned");
  const hoverEl  = document.getElementById("morph-hover");
  const promptEl = document.getElementById("morph-prompt");

  const root = (slot === "hover") ? hoverEl : pinnedEl;
  if (!root) return;

  if (promptEl) promptEl.style.display = "none";

  const words = Array.isArray(wordOrWords) ? wordOrWords.filter(Boolean) : [wordOrWords].filter(Boolean);
  if (words.length === 0) return;

  // Keep stable order
  words.sort((a,b) => Number(a.id) - Number(b.id));

  const renderOne = (word, mountEl) => {
    ensureDocumentSnapshot(word);

    const af = Number(word.activeForm);
    word.activeForm = Number.isFinite(af) ? af : -1;

    const lemma  = word._doc?.lemma ?? '';
    const postag = word._doc?.postag ?? '';

    const docLemma  = String(lemma).trim();
    const docPostag = String(postag).trim();
    const hasDocMorph = (docLemma !== '' || docPostag !== '');

    const posColor = colorForTag(postag);
    const documentForm = { lemma, postag, source: "document" };

    mountEl.innerHTML = `
      <div class="morph-container">
        <p class="morph-form">
          ${word.form}
          <span class="morph-id" style="color:#9aa3ad">${window.currentIndex}-${word.id}</span>
        </p>
        ${hasDocMorph ? userFormCardHTML(documentForm, -1, word.activeForm === -1) : ''}
      </div>
    `;

    const lemmaEl = mountEl.querySelector(".morph-lemma");
    if (lemmaEl) lemmaEl.style.color = posColor;

    const mc = mountEl.querySelector(".morph-container");
    if (mc) enableMorphEntryExpansion(mc);

    appendCreateAndUserForms(word, mountEl);
    attachMorpheusSuggestions(word, mountEl);

    // Collapse entries scoped to this mount only
    mountEl.querySelectorAll(".morph-entry").forEach(entry => {
      entry.classList.remove("expanded");
      entry.dataset.expanded = "false";
      entry.querySelector(".morph-details")?.remove();
      entry.querySelector(".morph-divider")?.remove();
    });
  };

  // ---- MULTI ----
  if (words.length > 1) {
    root.innerHTML = `<div class="morph-multi"></div>`;
    const wrap = root.querySelector(".morph-multi");

    words.forEach(w => {
      const block = document.createElement("div");
      block.className = "morph-word-block";
      block.dataset.wordId = String(w.id);
      wrap.appendChild(block);
      renderOne(w, block);
    });

    return;
  }

  // ---- SINGLE ----
  root.innerHTML = ""; // or keep your old structure if you want
  renderOne(words[0], root);
}

// ============================================================================
// MORPHEUS → FORM HELPERS
// ============================================================================

// Map Morpheus POS strings to Arethusa one-letter POS codes
function posCharFromMorpheusPOS(posRaw) {
  const s = (posRaw || '').toString().trim().toLowerCase();
  if (!s) return '';

  const lang = getLanguage();
  const isLatin = lang === 'lat';

  // Typical Morpheus POS strings:
  // "verb", "noun", "adjective", "pronoun", "article",
  // "adverb", "conjunction", "preposition", "interjection", etc.
  if (s.startsWith('verb'))         return 'v';
  if (s.startsWith('noun'))         return 'n';
  if (s.startsWith('adj'))          return 'a';
  if (s.includes('participle'))     return 'v'; // treat as verb-like
  if (s.startsWith('pron'))         return 'p';
  if (s.startsWith('art'))          return 'l'; // article
  if (s.startsWith('adv'))          return 'd';
  if (s.startsWith('part') || s.includes('particle')) return 'd'; // treat particles like adverbs (Arethusa-style)
  if (s.includes('indeclin')) return 'd'; // indeclinable often behaves like particle/adverb for coloring
  if (s.startsWith('conj'))         return 'c';
  if (s.startsWith('prep') ||
      s.includes('preposition'))    return 'r'; // adposition
  if (s.startsWith('num') ||
      s.startsWith('card'))         return 'm'; // numeral
  if (s.startsWith('excl') || s.startsWith('exclam')) return isLatin ? 'e' : 'i';
  if (s.startsWith('interj'))       return 'i';
  if (s.startsWith('punct'))        return 'u';

  return '';
}

function guessPosCharFromMorph(result) {
  // Prefer explicit POS from Morpheus
  const fromPOS = posCharFromMorpheusPOS(result.pos);
  if (fromPOS) return fromPOS;

  // Fallback heuristic based on features
  const hasVerbish = !!(result.tense || result.mood || result.voice);
  const hasNominal = !!(result.gender || result.case || result.num);
  if (hasVerbish) return 'v';
  if (hasNominal) return 'n';
  return '';
}


function codeFromPerson(p) {
  const s = (p || '').toString().toLowerCase().trim();
  if (!s) return '';
  if (s === '1' || s === '1st' || s.startsWith('first'))  return '1';
  if (s === '2' || s === '2nd' || s.startsWith('second')) return '2';
  if (s === '3' || s === '3rd' || s.startsWith('third'))  return '3';
  return '';
}

function codeFromNumber(num) {
  switch ((num || '').toLowerCase()) {
    case 'sg':
    case 's':
    case 'singular':
      return 's';
    case 'pl':
    case 'p':
    case 'plural':
      return 'p';
    case 'dual':
    case 'd':
      return 'd';
    default:
      return '';
  }
}

function codeFromCase(c) {
  switch ((c || '').toLowerCase()) {
    case 'nom':
    case 'nominative':
      return 'n';
    case 'gen':
    case 'genitive':
      return 'g';
    case 'dat':
    case 'dative':
      return 'd';
    case 'acc':
    case 'accusative':
      return 'a';
    case 'voc':
    case 'vocative':
      return 'v';
    case 'abl':
    case 'ablative':
      return 'b';
    case 'loc':
    case 'locative':
      return 'l';
    default:
      return '';
  }
}

function codeFromGender(g) {
  switch ((g || '').toLowerCase()) {
    case 'm':
    case 'masc':
    case 'masculine':
      return 'm';
    case 'f':
    case 'fem':
    case 'feminine':
      return 'f';
    case 'n':
    case 'neut':
    case 'neuter':
      return 'n';
    case 'c':
    case 'common':
      return 'c';
    default:
      return '';
  }
}

function codeFromTense(t) {
  switch ((t || '').toLowerCase()) {
    case 'pres':
    case 'present':
      return 'p';
    case 'imperf':
    case 'imperfect':
      return 'i';
    case 'perf':
    case 'perfect':
      return 'r';
    case 'plup':
    case 'pluperfect':
      return 'l';
    case 'fut':
    case 'future':
      return 'f';
    case 'aor':
    case 'aorist':
      return 'a';
    case 'futperf':
    case 'future perfect':
    case 'fut perfect':
      return 't';
    default:
      return '';
  }
}

function codeFromMood(m) {
  switch ((m || '').toLowerCase()) {
    case 'ind':
    case 'indicative':
      return 'i';
    case 'subj':
    case 'subjunctive':
      return 's';
    case 'opt':
    case 'optative':
      return 'o';
    case 'inf':
    case 'infinitive':
      return 'n';
    case 'imperat':
    case 'imperative':
      return 'm';
    case 'part':
    case 'participle':
      return 'p';
    case 'gerund':
      return 'd';
    case 'gerundive':
      return 'g';
    case 'supine':
      return 'u';
    default:
      return '';
  }
}

function codeFromVoice(v) {
  switch ((v || '').toLowerCase()) {
    case 'act':
    case 'active':
      return 'a';
    case 'mp':
    case 'medio-passive':
    case 'middle':
    case 'med':
      return 'e';
    case 'pass':
    case 'passive':
      return 'p';
    case 'dep':
    case 'deponent':
    case 'deponens':
      return 'd';
    default:
      return '';
  }
}

// Turn one Morpheus result into a { lemma, postag, source } form
function formFromMorphResult(result, word) {
  const posChar = guessPosCharFromMorph(result);
  const isLatin = String(getLanguage()).toLowerCase().startsWith('lat');

  const fields = {
    person: codeFromPerson(result.person),
    number: codeFromNumber(result.num),
    tense:  codeFromTense(result.tense),
    mood:   codeFromMood(result.mood),
    voice:  codeFromVoice(result.voice),
    gender: codeFromGender(result.gender),
    case:   codeFromCase(result.case),
    degree: ''
  };

  if (isLatin && posChar === 'p') {
    fields.person = '';
  }

  if (isLatin) {
    // Latin: no dual, no common gender, no optative, no medio-passive
    if (fields.number === 'd') fields.number = '';
    if (fields.gender === 'c') fields.gender = '';
    if (fields.mood === 'o') fields.mood = '';
    if (fields.voice === 'e') fields.voice = '';
    if (fields.tense === 'a') fields.tense = '';
  }

  const postag = composeUserPostag(posChar, fields);

  // If Morpheus gave us no usable features, skip this suggestion
  // (postag empty or just dashes like "---------")
  if (!postag || /^-+$/.test(postag)) {
    return null;
  }

  const lemma =
    (result.lemma && String(result.lemma).trim()) ||
    (word.lemma && String(word.lemma).trim()) ||
    (word.form && String(word.form).trim()) ||
    '';

  return {
    lemma,
    postag,
    source: 'bsp/morpheus'
  };
}

// Fetch Morpheus analyses and attach them as extra forms
async function attachMorpheusSuggestions(word, toolBody) {
  if (!word) return;

  // prevent concurrent calls (hover + preselect can fire quickly)
  if (word._morpheusLoading) return;

  // If we already loaded successfully AND we have forms, no need to refetch
  if (word._morpheusLoaded && Array.isArray(word.forms) && word.forms.length > 0) return;

  word._morpheusLoading = true;

  const lang = getLanguage();
  if (!isMorpheusSupported(lang)) {
    word._morpheusLoading = false;
    return;
  }

  const surfaceRaw = (word.form && String(word.form).trim()) || '';
  const lemmaRaw   = (word.lemma && String(word.lemma).trim()) || '';

  // Try a cleaned surface too (punctuation, brackets, quotes can break queries)
  const cleanedSurface = surfaceRaw.replace(/[·.,;:!?()[\]{}"“”'’]/g, '').trim();

  let results = [];
  let usedQuery = '';

  try {
    // 1) surface
    if (surfaceRaw) {
      usedQuery = surfaceRaw;
      results = await fetchMorphology(surfaceRaw, lang);
    }

    // 2) cleaned surface
    if ((!results || results.length === 0) && cleanedSurface && cleanedSurface !== surfaceRaw) {
      usedQuery = cleanedSurface;
      results = await fetchMorphology(cleanedSurface, lang);
    }

    // 3) lemma fallback
    if ((!results || results.length === 0) && lemmaRaw) {
      usedQuery = lemmaRaw;
      results = await fetchMorphology(lemmaRaw, lang);
    }
  } catch (err) {
    console.error('[Morph] Morpheus fetch failed for', usedQuery || surfaceRaw || lemmaRaw, err);
    word._morpheusLoading = false;
    // IMPORTANT: do NOT mark loaded; allow retry later
    return;
  }

  // If still nothing, allow retry later (don’t permanently lock out)
  if (!Array.isArray(results) || results.length === 0) {
    if (window.morphDebug) console.log('[Morph] no Morpheus results for', usedQuery || surfaceRaw || lemmaRaw);
    word._morpheusLoading = false;
    word._morpheusLoaded = false;
    return;
  }

  // From here: we successfully got results at least once
  word._morpheusLoaded = true;

  ensureFormsArray(word);

  const existing = new Set(
    word.forms.map(f => `${(f.lemma || '').trim()}::${f.postag || ''}`)
  );

  const baseLemma  = (word._doc?.lemma  || word.lemma  || '').trim();
  const basePostag = (word._doc?.postag || word.postag || '').trim();
  if (baseLemma || basePostag) existing.add(`${baseLemma}::${basePostag}`);

  results.forEach(r => {
    const form = formFromMorphResult(r, word);
    if (!form || !form.lemma || !form.postag) return;

    const key = `${(form.lemma || '').trim()}::${form.postag}`;
    if (existing.has(key)) return;

    existing.add(key);
    word.forms.push(form);
  });

  // If Preselect is enabled and no selection exists yet, select first suggestion
  const af2 = Number(word.activeForm);
  word.activeForm = Number.isFinite(af2) ? af2 : -1;

  if (window.morphPreselectEnabled && word.activeForm < 0 && word.forms.length > 0) {
    word.activeForm = 0;
    applyActiveSelectionToWord(word);
  }


  if (toolBody) {
    appendCreateAndUserForms(word, toolBody);
  }

  word._morpheusLoading = false;
}

function wireMorphSettingsUI(toolBody) {
  const settingsBtn = toolBody.querySelector('#morph-settings-btn');
  const settingsBox = toolBody.querySelector('#morph-settings');
  const preselectCb = toolBody.querySelector('#morph-preselect-checkbox');
  if (!settingsBtn || !settingsBox || !preselectCb) return;

  // ---- 1) Initialize checkbox from global state (NO forced reset here) ----
  preselectCb.checked = !!window.morphPreselectEnabled;

  // ---- 2) Toggle dropdown reliably ----
  settingsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); // prevents outside-close handlers from immediately hiding it
    const isOpen = settingsBox.style.display === 'block';
    settingsBox.style.display = isOpen ? 'none' : 'block';
  });

  // Prevent clicks inside dropdown from bubbling up and closing it
  settingsBox.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // ---- 3) Outside click closes ----
  if (!window._morphSettingsOutsideCloseBound) {
    window._morphSettingsOutsideCloseBound = true;

    document.addEventListener('mousedown', (e) => {
      const toolBody = document.getElementById('tool-body');
      if (!toolBody) return;

      const btn = toolBody.querySelector('#morph-settings-btn');
      const box = toolBody.querySelector('#morph-settings');
      if (!btn || !box) return;

      // Click on button or inside box -> do nothing
      if (btn.contains(e.target) || box.contains(e.target)) return;

      box.style.display = 'none';
    });
  }

  // ---- 4) Preselect toggle ----
  preselectCb.addEventListener('change', async (e) => {
    const enabled = !!e.target.checked;
    window.morphPreselectEnabled = enabled;

    // If we want it to persist across sentence navigation (NOT refresh),
    // do NOT write localStorage here.
    // If we *do* want it to persist across refresh, then uncomment:
    // localStorage.setItem('morphPreselectEnabled', enabled ? 'true' : 'false');

    if (enabled) {
      await preselectMissingMorphForCurrentSentence(toolBody);
      try { triggerAutoSave(); } catch {}
    }
  });
}

function shortPOS(postag = '') {
  const t = (postag || '').toString();
  const c = t[0]?.toLowerCase() || '';
  const map = {
    v: 'verb',
    n: 'noun',
    a: 'adjective',
    d: 'adverb',
    p: 'pronoun',
    c: 'conjunction',
    r: 'adposition',
    l: 'article',
    m: 'numeral',
    i: 'interjection',
    u: 'punctuation',
    e: 'exclamation'
  };
  return map[c] || t || '';
}
