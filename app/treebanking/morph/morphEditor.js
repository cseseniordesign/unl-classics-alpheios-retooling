import { ensureFormsArray, composeUserPostag, parseMorphTag } from './morphHelpers.js';
import { applyActiveSelectionToWord, renderUserFormsList } from './morphTool.js';
import { triggerAutoSave } from '../xml/saveXML.js';
import { showConfirmDialog } from '../ui/modal.js';
import { getLanguage } from '../input/language.js';
import { initMorphLexicon, incrementUsage, upsertForm, mergeIntoAllTokens, pickTopLexiconForm } from './morphLexicon.js';
import { getPosList, getPosValues, getApplicableMorphAttributes, getMorphAttribute } from '../tags/tagsetStore.js';

// Inline editor that appears under the button and closes on save
export function renderCreateEditorBelow(word, toolBody, opts = {}) {
    const seedForm = opts.seedForm || null;
    console.log('[renderCreateEditorBelow] seedForm =', seedForm);
    console.log('[renderCreateEditorBelow] opts =', opts);
    ensureFormsArray(word);
    const lang = getLanguage();
    const isLatin = String(lang).toLowerCase().startsWith('lat');

    // Only one editor at a time
    toolBody.querySelector('.morph-editor-inline')?.remove();

    const host = document.createElement('div');
    host.className = 'morph-editor-inline';
    host.style.marginTop = '12px';
    host.innerHTML = `
        <div class="field">
        <label>Lemma</label>
        <input id="nf-lemma" type="text" value="${(
            (seedForm?.lemma || word._displayLemma || word._doc?.lemma || word.lemma || word.form || '').trim()
        )}"/>
        </div>

        <div class="field">
        <label>Part of Speech</label>
        <select id="nf-pos"></select>   
        </div>

        <div id="nf-dynamic"></div>

        <div class="morph-actions">
        <button id="nf-reset" class="btn btn-reset" type="button">Reset</button>
        <button id="nf-cancel" class="btn btn-cancel" type="button">Cancel</button>
        <button id="nf-save"  class="btn btn-save"  type="button">Save</button>
        </div>
    `;
    toolBody.querySelector('.morph-container')?.appendChild(host);
    // Scroll the new editor into view so the click feels responsive
    requestAnimationFrame(() => {
    host.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
    });

    const nfLemma = host.querySelector('#nf-lemma');
    const nfPos   = host.querySelector('#nf-pos');

    const posList = getPosList();
    nfPos.innerHTML = '<option value="">— choose —</option>';

    posList.forEach(pos => {
        const opt = document.createElement('option');
        opt.value = pos.key || '';
        opt.dataset.postag = pos.postag || '';
        opt.textContent = pos.long || pos.short || pos.postag || '';
        nfPos.appendChild(opt);
    });

    // POS adjustments for Latin
    if (isLatin) {
    // Remove Article (l)
    nfPos.querySelector('option[value="l"]')?.remove();

    // Replace interjection (i) with exclamation (e)
    const intOpt = nfPos.querySelector('option[value="i"]');
    if (intOpt) {
        intOpt.textContent = 'exclamation';
        intOpt.value = 'e';            
    }
    }

    const nfDyn   = host.querySelector('#nf-dynamic');

    // Remove red outline when user fixes a field 
    host.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('input', () => el.closest('.field')?.classList.remove('invalid'));
    el.addEventListener('change', () => el.closest('.field')?.classList.remove('invalid'));
    });

    const initialLemma = (seedForm?.lemma || word._displayLemma || word._doc?.lemma || word.lemma || word.form || '').trim();

    function resetEditorToBlankCreate() {
    // lemma stays prefilled
    nfLemma.value = initialLemma;

    // POS goes back to blank (— choose —)
    nfPos.value = '';

    // remove all the dynamic selects
    nfDyn.innerHTML = '';

    // clear validation UI if you use it
    host.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
    }

    /**
     * Need to replace interjection with exclamtion while in latin (has no other fields)
     * No article pos in latin
     * Pronoun has no "Person" field
     * Verb defaults to Tense, Mood, and Voice
     * - If mood is indicative, fields are: Person, Number, Tense, Mood, and Voice
     * - If mood is subjunctive, fields are: Person, Number, Tense, Mood, and Voice
     * - If mood is infinitive, fields are: Tense Mood, and Voice
     * - If mood is imperative, fields are: Person, Number, Tense, Mood, and Voice
     * - If mood is gerund, fields are: Person, Number, Tense, Mood, Voice, and Casus
     * - If mood is gerundive, fields are Person, Number, Tense, Mood, Voice, Gender, and Casus
     * - If mood is participle, fields are: Number, Tense, Mood, Voice, Gender, Casus, and Degree
     * - If mood is supine, fields are: Person, Number, Tense, Mood, and Voice
     */


const FIELD_META = {
  pers:   { id: 'nf-person', label: 'Person' },
  num:    { id: 'nf-num',    label: 'Number' },
  tense:  { id: 'nf-tense',  label: 'Tense' },
  mood:   { id: 'nf-mood',   label: 'Mood' },
  voice:  { id: 'nf-voice',  label: 'Voice' },
  gend:   { id: 'nf-g',      label: 'Gender' },
  case:   { id: 'nf-case',   label: 'Casus' },
  degree: { id: 'nf-deg',    label: 'Degree' }
};

function buildSelectFromAttr(id, attrDef) {
  const sel = document.createElement('select');
  sel.id = id;
  sel.className = 'cf-select';
  sel.style.width = '100%';

  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '---';
  sel.appendChild(blank);

  Object.entries(attrDef?.values || {}).forEach(([key, def]) => {
    const opt = document.createElement('option');
    opt.value = def?.postag || '';
    opt.textContent = def?.long || def?.short || key;
    sel.appendChild(opt);
  });

  return sel;
}

function configKeyToPostagValue(attrName, configKey) {
  if (!configKey) return '';

  const attrDef = getMorphAttribute(attrName);
  if (!attrDef) return '';

  const valueDef = attrDef.values?.[configKey];
  return valueDef?.postag || '';
}

function collectDynamicValuesFromUI() {
  const values = {};

  const fieldMap = [
    ['pers', 'nf-person'],
    ['num', 'nf-num'],
    ['tense', 'nf-tense'],
    ['mood', 'nf-mood'],
    ['voice', 'nf-voice'],
    ['gend', 'nf-g'],
    ['case', 'nf-case'],
    ['degree', 'nf-deg']
  ];

  fieldMap.forEach(([cfgKey, elId]) => {
    const el = nfDyn.querySelector(`#${elId}`);
    const attrDef = getMorphAttribute(cfgKey);

    if (!el || !attrDef) {
      values[cfgKey] = '';
      return;
    }

    let selectedKey = '';

    for (const [key, def] of Object.entries(attrDef.values || {})) {
      if ((def?.postag || '') === el.value) {
        selectedKey = key;
        break;
      }
    }

    values[cfgKey] = selectedKey;
  });

  return values;
}

function normalizePosKey(posLike) {
  const raw = String(posLike || '').trim().toLowerCase();
  if (!raw) return '';

  const posList = getPosList();

  const match = posList.find(pos =>
    String(pos.key || '').toLowerCase() === raw ||
    String(pos.long || '').toLowerCase() === raw ||
    String(pos.short || '').toLowerCase() === raw ||
    String(pos.postag || '').toLowerCase() === raw
  );

  return match?.key || '';
}

function collectPreservedValuesFromSeedForm() {
  if (!seedForm?.postag) {
    return {};
  }

  const parsed = parseMorphTag(seedForm.postag) || {};

  return {
    pers: parsed.person || '',
    num: parsed.number || '',
    tense: parsed.tense || '',
    mood: parsed.mood || '',
    voice: parsed.voice || '',
    gend: parsed.gender || '',
    case: parsed.case || '',
    degree: parsed.degree || ''
  };
}

function renderDynamicForPOS(posKeyLike, preservedValues = {}) {
  nfDyn.innerHTML = '';
  const posKey = normalizePosKey(posKeyLike);
  if (!posKey) return;

  const state = { pos: posKey, ...preservedValues };
  const attrs = getApplicableMorphAttributes(state);

  console.log('[renderDynamicForPOS] posKey =', posKey);
  console.log('[renderDynamicForPOS] state =', state);
  console.log('[renderDynamicForPOS] attrs =', attrs);

  const add = (label, el) => {
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const lab = document.createElement('label');
    lab.textContent = label;

    wrap.append(lab, el);
    nfDyn.appendChild(wrap);
    return wrap;
  };

  attrs.forEach(attr => {
    const meta = FIELD_META[attr.name];
    if (!meta) return;

    const sel = buildSelectFromAttr(meta.id, attr);

    if (preservedValues[attr.name]) {
      const postagValue = configKeyToPostagValue(attr.name, preservedValues[attr.name]);
      if (postagValue) {
        sel.value = postagValue;
      }
    }

    add(meta.label, sel);
  });

  nfDyn.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      const nextValues = collectDynamicValuesFromUI();
      renderDynamicForPOS(posKey, nextValues);
    });
  });
}


nfPos.addEventListener('change', e => {
  const currentValues = collectDynamicValuesFromUI();
  const fallbackSeedValues = collectPreservedValuesFromSeedForm();

  const preservedValues = {
    pers: currentValues.pers || fallbackSeedValues.pers || '',
    num: currentValues.num || fallbackSeedValues.num || '',
    tense: currentValues.tense || fallbackSeedValues.tense || '',
    mood: currentValues.mood || fallbackSeedValues.mood || '',
    voice: currentValues.voice || fallbackSeedValues.voice || '',
    gend: currentValues.gend || fallbackSeedValues.gend || '',
    case: currentValues.case || fallbackSeedValues.case || '',
    degree: currentValues.degree || fallbackSeedValues.degree || ''
  };

  renderDynamicForPOS(e.target.value, preservedValues);
});

// --- Prefill from clicked form (clone) ---
if (seedForm?.postag) {
  const parsed = parseMorphTag(seedForm.postag) || {};
  let posChar = seedForm.postag[0]?.toLowerCase() || '';

  if (isLatin && posChar === 'i') posChar = 'e';
  if (!isLatin && posChar === 'e') posChar = 'i';

  let seedPosKey = parsed.pos || '';

    // normalize parsed.pos into the actual config key
    if (seedPosKey) {
        const normalizedMatch = posList.find(pos =>
        String(pos.key || '').toLowerCase() === String(seedPosKey).toLowerCase() ||
        String(pos.long || '').toLowerCase() === String(seedPosKey).toLowerCase() ||
        String(pos.short || '').toLowerCase() === String(seedPosKey).toLowerCase()
        );

        seedPosKey = normalizedMatch?.key || seedPosKey;
    }

    // fallback from postag char if parsed.pos was empty or unusable
    if (!seedPosKey && posChar) {
        const match = posList.find(pos =>
        String(pos.postag || '').toLowerCase() === posChar
        );
        seedPosKey = match?.key || '';
    }

    console.log('[seedForm] parsed =', parsed);
    console.log('[seedForm] seedPosKey =', seedPosKey);

    if (seedPosKey) {
        nfPos.value = seedPosKey;

        renderDynamicForPOS(seedPosKey, {
        pers: parsed.person || '',
        num: parsed.number || '',
        tense: parsed.tense || '',
        mood: parsed.mood || '',
        voice: parsed.voice || '',
        gend: parsed.gender || '',
        case: parsed.case || '',
        degree: parsed.degree || ''
        });
    }
    }

host.querySelector('#nf-reset').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetEditorToBlankCreate();
});


// Cancel button: close the inline form editor
host.querySelector('#nf-cancel').addEventListener('click', () => {
    host.remove();
});

host.querySelector('#nf-save').addEventListener('click', async () => {
  const lemmaVal = (nfLemma.value || '').trim();
  const posKey = (nfPos.value || '').trim();
  const posChar = nfPos.selectedOptions?.[0]?.dataset?.postag || '';

  // Clear old highlights
  nfDyn.querySelectorAll('.field').forEach(f => f.classList.remove('invalid'));
  nfLemma.closest('.field')?.classList.remove('invalid');
  nfPos.closest('.field')?.classList.remove('invalid');

  const markInvalid = (el) => el?.closest('.field')?.classList.add('invalid');

  // -------------------------
  // HARD REQUIRED: Lemma + POS
  // -------------------------
  if (!lemmaVal) {
    markInvalid(nfLemma);
    await showConfirmDialog(
      'Lemma cannot be blank.',
      { titleText: 'Missing required field', okText: 'OK', cancelText: 'OK' }
    );
    nfLemma.focus();
    return;
  }

  if (!posChar) {
    markInvalid(nfPos);
    await showConfirmDialog(
      'Part of Speech cannot be blank.',
      { titleText: 'Missing required field', okText: 'OK', cancelText: 'OK' }
    );
    nfPos.focus();
    return;
  }

    // -------------------------
    // OPTIONAL FIELDS (prompt-only)
    // Only warn about fields that are currently rendered for this POS/layout
    // -------------------------
    const isBlank = (v) => !v || String(v).trim() === '' || String(v).trim() === '---';

    const labelMap = {
    'nf-person': 'Person',
    'nf-tense':  'Tense',
    'nf-mood':   'Mood',
    'nf-voice':  'Voice',
    'nf-num':    'Number',
    'nf-g':      'Gender',
    'nf-case':   'Casus',
    'nf-deg':    'Degree'
    };

    // Start with empty defaults
    const fields = {
    person: '',
    tense: '',
    mood: '',
    voice: '',
    number: '',
    gender: '',
    case: '',
    degree: ''
    };

    const missing = [];
    const addMissing = (name, el) => {
    missing.push({ name, el });
    markInvalid(el);
    };

    // Look ONLY at inputs/selects currently inside nfDyn
    nfDyn.querySelectorAll('select, input').forEach(el => {
        const label = labelMap[el.id];
        if (!label) return;

        // only count fields that are currently visible
        const fieldWrap = el.closest('.field');
        if (!fieldWrap) return;

        // If wrapper is display:none (verb layout), skip it
        if (fieldWrap.style.display === 'none') return;

        // More robust: skip if hidden due to CSS/ancestor hiding
        if (fieldWrap.offsetParent === null) return;

        const val = el.value ?? '';

        if (el.id === 'nf-person') fields.person = val;
        if (el.id === 'nf-tense')  fields.tense  = val;
        if (el.id === 'nf-mood')   fields.mood   = val;
        if (el.id === 'nf-voice')  fields.voice  = val;
        if (el.id === 'nf-num')    fields.number = val;
        if (el.id === 'nf-g')      fields.gender = val;
        if (el.id === 'nf-case')   fields.case   = val;
        if (el.id === 'nf-deg')    fields.degree = val;

        if (isBlank(val)) addMissing(label, el);
    });

    // Prompt once if any optional fields are blank
    if (missing.length > 0) {
    const names = [...new Set(missing.map(m => m.name))];

    const ok = await showConfirmDialog(
        `You left these morph fields blank:\n\n${names.join(', ')}\n\nSave anyway?`,
        { titleText: 'Missing morph fields', okText: 'Save anyway', cancelText: 'Go back' }
    );

    if (!ok) {
        missing[0]?.el?.focus?.();
        return;
    }
}

// -------------------------
// SAVE (compose supports blanks using '-' slots)
// -------------------------
const postag = composeUserPostag(posChar, fields);

// 1) Persist in IndexedDB + mark as used
try {
  await initMorphLexicon();
  const lang = getLanguage();
  await upsertForm({ lang, surface: word.form, lemma: lemmaVal, postag });
  await incrementUsage({ lang, surface: word.form, lemma: lemmaVal, postag });
  try {
    const best = await pickTopLexiconForm({ lang, surface: word.form });
    if (best && best.lemma && best.postag) {
        const bestKey = `${best.lemma.trim()}::${best.postag}`;
        const match = word.forms.find(f => `${(f.lemma || '').trim()}::${f.postag || ''}` === bestKey);
        if (match) match._count = Math.max(Number(match._count) || 0, Number(best._count) || 0);
    }
    } catch {}
} catch (err) {
  console.warn('Could not persist morph form to lexicon:', err);
}

// 2) Update in-memory immediately (include _count so sorting/preselect works)
const key = `${lemmaVal.trim()}::${postag}`;
const existingIdx = (word.forms || []).findIndex(
  f => `${(f.lemma || '').trim()}::${f.postag || ''}` === key
);

if (existingIdx >= 0) {
  const f = word.forms[existingIdx];
  f.source = f.source || 'you';
  f._count = Math.max(Number(f._count) || 0, 1);
  word.activeForm = existingIdx;
} else {
  word.forms.push({ lemma: lemmaVal, postag, source: 'you', _count: 1 });
  word.activeForm = word.forms.length - 1;
}

applyActiveSelectionToWord(word);

// 3) Merge into all tokens so other identical words can use it immediately
try {
  const lang = getLanguage();
  await mergeIntoAllTokens({ lang });
} catch (err) {
  console.warn('Could not merge lexicon forms into tokens:', err);
}

await renderUserFormsList(word, toolBody);

host.remove();

if (typeof window.fastRefreshTree === 'function') window.fastRefreshTree();

triggerAutoSave();

const docEntry = toolBody.querySelector('.morph-entry[data-index="-1"]');
const topRadio = docEntry?.querySelector('input[type="radio"]');
if (topRadio) topRadio.checked = false;

if (typeof window.renderMorphInfo === 'function') window.renderMorphInfo(word);
if (typeof window.updateXMLIfActive === 'function') window.updateXMLIfActive();
});
}