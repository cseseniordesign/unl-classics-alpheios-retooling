import { colorForTag, parseMorphTag, ensureDocumentSnapshot, composeUserPostag, ensureFormsArray} from './morphHelpers.js';
import { renderCreateEditorBelow } from './morphEditor.js';
import { colorForPOS } from '../tree/treeUtils.js';
import { triggerAutoSave } from '../xml/saveXML.js';
import { fetchMorphology } from './morpheus.js';

/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupMorphTool
 * --------------------------------------------------------------------------
 * Enables the "Morph" tab on the right-hand toolbar.
 * When the Morph button is active, clicking a word displays its morph info.
 * --------------------------------------------------------------------------
 */
export function setupMorphTool() {
  const morphBtn = document.getElementById('morph');
  const toolBody = document.getElementById('tool-body');
  const allToolButtons = document.querySelectorAll('#toolbar button');
  if (!morphBtn || !toolBody) return;

  // Track on/off state from the toolbar button
  window.isMorphActive = false;

  // Allow other code to close Morph (e.g., when sentence changes)
  window.closeMorphTool = function () {
    if (!window.isMorphActive) return;
    window.isMorphActive = false;
    morphBtn.classList.remove('active');
    toolBody.innerHTML = `<p>Please select a tool from the bar above that you would like to use.</p>`;
    // clear highlights
    document.querySelectorAll(".token.selected").forEach(t => t.classList.remove("selected"));
    d3.selectAll(".node").classed("selected", false);
  };

  morphBtn.addEventListener('click', () => {
    const wasActive = window.isMorphActive;
    allToolButtons.forEach(btn => btn.classList.remove('active'));
    window.isMorphActive = !wasActive;

    if (window.isMorphActive) {
      document.body.classList.add('mode-morph');
      morphBtn.classList.add('active');
      toolBody.innerHTML = `<p style="padding:8px;">Click a word to view morphological info.</p>`;
    } else {
      document.body.classList.remove('mode-morph');
      d3.selectAll(".node").classed("selected", false);
      document.querySelectorAll(".token.selected").forEach(t => t.classList.remove("selected"));
      toolBody.innerHTML = `<p>Please select a tool from the bar above that you would like to use.</p>`;
    }
  });

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
  if (tok) tok.style.color = colorForPOS(word); // uses _displayPostag

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
  let list = toolBody.querySelector('.user-forms-list');
  if (!list) {
    list = document.createElement('div');
    list.className = 'user-forms-list';
    toolBody.querySelector('.morph-container')?.appendChild(list);
  }
  list.innerHTML = word.forms.map((f, i) =>
    userFormCardHTML(f, i, word.activeForm === i)
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
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = e.target.closest('.user-form');
      const idx = Number(card.dataset.index);
      const confirmDelete = confirm('Delete this form?');
      if (!confirmDelete) return;

      removeForm(word, idx);
      renderUserFormsList(word, toolBody);
      window.renderMorphInfo(word);
      triggerAutoSave(); // autosave after deleting a form
    });
  });
}

// =========================
// Forms management helpers
// =========================

function enableMorphEntryExpansion(scopeEl) {
  // Prevent attaching this listener multiple times to the same container
  if (scopeEl._expansionBound) return;
  scopeEl._expansionBound = true;

  scopeEl.addEventListener('click', (e) => {
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
                      i:'interjection', u:'punctuation' };

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
    n: ['pos','number','gender','case'],
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
    case:   { n:'nominative', g:'genitive', d:'dative', a:'accusative', v:'vocative' },
    tense:  { p:'present', i:'imperfect', r:'perfect', l:'pluperfect', f:'future', a:'aorist' },
    mood:   { i:'indicative', s:'subjunctive', o:'optative', n:'infinitive', m:'imperative', p:'participle' },
    voice:  { a:'active', e:'medio-passive', p:'passive' },
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

  // Make top card checkbox reflect whether XML/doc is the active one
  const topCheckbox = toolBody.querySelector('.morph-entry > input[type="checkbox"]');
  if (topCheckbox) topCheckbox.checked = (word.activeForm === -1);

  // Clicking the top checkbox activates the XML/doc form
  topCheckbox?.addEventListener('change', (e) => {
    if (e.target.checked) {
      word.activeForm = -1;
      applyActiveSelectionToWord(word);
      window.renderMorphInfo(word);
      triggerAutoSave(); // autosave after reactivating document form
    }
  });

  // Create button (under top card)
  if (!toolBody.querySelector('.morph-create')) {
    const btn = document.createElement('button');
    btn.className = 'morph-create';
    btn.textContent = 'Create New Form';
    toolBody.querySelector('.morph-container')?.appendChild(btn);
    btn.addEventListener('click', () => renderCreateEditorBelow(word, toolBody));
  }

  // --- Enable delete for the top (document) card ---
  const docDeleteBtn = toolBody.querySelector('.morph-container > .user-form .delete-form');
  if (docDeleteBtn) {
    docDeleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const confirmDelete = confirm('Delete the document form?');
      if (!confirmDelete) return;

      removeForm(word, -1);       // triggers document clear
      window.renderMorphInfo(word); // re-render UI
      triggerAutoSave(); // autosave after clearing document form
    });
  }
}

function userFormCardHTML(form, index, isActive) {
  // Build a concise readable summary (noun.plural.masculine.vocative)
  const parsed = parseMorphTag(form.postag || '');
  const VALUE_MAPS = {
    number: { s:'singular', p:'plural', d:'dual' },
    gender: { m:'masculine', f:'feminine', n:'neuter', c:'common' },
    case:   { n:'nominative', g:'genitive', d:'dative', a:'accusative', v:'vocative' },
    tense:  { p:'present', i:'imperfect', r:'perfect', l:'pluperfect', f:'future', a:'aorist' },
    mood:   { i:'indicative', s:'subjunctive', o:'optative', n:'infinitive', m:'imperative', p:'participle' },
    voice:  { a:'active', e:'medio-passive', p:'passive' },
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
    i:'interjection', u:'punctuation'
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

  // Only allow delete button for "you" and "document" forms
  const deleteBtn = (src === 'you' || src === 'document')
    ? `<button class="delete-form" title="Delete this form">Delete Form</button>`
    : '';

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
      ${deleteBtn}
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
function renderMorphInfo(word) {
  if (!window.isMorphActive) return;
  const toolBody = document.getElementById('tool-body');
  if (!toolBody || !word) return;

  // ensure we have original XML snapshot
  ensureDocumentSnapshot(word);

  if (typeof word.activeForm !== 'number') {
    word.activeForm = -1;
  }

  // --- Render top "document" card using the same card builder ---
  const lemma  = word._doc.lemma;
  const postag = word._doc.postag;
  const posColor = colorForTag(postag);

  const documentForm = {
    lemma: lemma,
    postag: postag,
    source: 'document'
  };

  toolBody.innerHTML = `
    <div class="morph-container">
      <p class="morph-form">
        ${word.form}
        <span class="morph-id" style="color:#9aa3ad">${window.currentIndex}-${word.id}</span>
      </p>
      ${(word._doc.lemma || word._doc.postag)
        ? userFormCardHTML(documentForm, -1, word.activeForm === -1)
        : ''}
    </div>
  `;

  const lemmaEl = toolBody.querySelector('.morph-lemma');
  if (lemmaEl) lemmaEl.style.color = posColor;

  const mc = toolBody.querySelector('.morph-container');
  if (mc) enableMorphEntryExpansion(mc);

  // Append creation/editor + list BELOW the top card 
  appendCreateAndUserForms(word, toolBody);

  // Kick off Morpheus suggestions (async)
  attachMorpheusSuggestions(word, toolBody);

  // Force all morph entries to start collapsed after forms are rebuilt
  document.querySelectorAll('.morph-entry').forEach(entry => {
    entry.classList.remove('expanded');
    entry.dataset.expanded = 'false';
    entry.querySelector('.morph-details')?.remove();
    entry.querySelector('.morph-divider')?.remove();
  });
}

// ============================================================================
// MORPHEUS → FORM HELPERS
// ============================================================================

function guessPosCharFromMorph(result) {
  const hasVerbish = !!(result.tense || result.mood || result.voice);
  const hasNominal = !!(result.gender || result.case || result.num);
  if (hasVerbish) return 'v';   // verb-like
  if (hasNominal) return 'n';   // noun/adjective-like
  return '';                    // unknown → "---------"
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
    default:
      return '';
  }
}

// Turn one Morpheus result into a { lemma, postag, source } form
function formFromMorphResult(result, word) {
  const posChar = guessPosCharFromMorph(result);

  const fields = {
    person: '',
    number: codeFromNumber(result.num),
    tense:  codeFromTense(result.tense),
    mood:   codeFromMood(result.mood),
    voice:  codeFromVoice(result.voice),
    gender: codeFromGender(result.gender),
    case:   codeFromCase(result.case),
    degree: ''
  };

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

  // Only fetch once per word
  if (word._morpheusLoaded) return;
  word._morpheusLoaded = true;

  const lang =
    window.treebankLang ||
    window.treeLanguage ||
    'grc';

  const queryForm =
    (word.lemma && word.lemma.trim()) ||
    word.form;

  let results = [];
  try {
    results = await fetchMorphology(queryForm, lang);
  } catch (err) {
    console.error('[Morph] Morpheus fetch failed for', queryForm, err);
    word._morpheusLoaded = false; // allow retry if we want later
    return;
  }

  if (!Array.isArray(results) || results.length === 0) {
    return;
  }

  ensureFormsArray(word);

  const existing = new Set(
    word.forms.map(f => `${(f.lemma || '').trim()}::${f.postag || ''}`)
  );

  results.forEach(r => {
    const form = formFromMorphResult(r, word);
    if (!form || !form.lemma || !form.postag) return;

    const key = `${(form.lemma || '').trim()}::${form.postag}`;
    if (existing.has(key)) return;

    existing.add(key);
    word.forms.push(form);
  });

  // Re-render the user forms list so Morpheus forms appear
  appendCreateAndUserForms(word, toolBody);
}
