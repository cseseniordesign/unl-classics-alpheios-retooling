import { getPosColorByChar, getActiveTagset, getMorphAttribute, getPostagSchema, getPosValues, attributeApplies, getPosList   } from "../tags/tagsetStore.js";

// ===== POS color utilities =====
const POS_COLORS = {
  v: '#c65a5a', // verb
  c: '#c77d9b', // conjunction
  d: '#e69109', // adverb
  i: '#b29100', // interjection
  e: '#b29100', // exclamation
  n: '#487a6f', // noun
  a: '#5a78c6', // adjective
  r: '#5a9b6b', // adposition
  l: '#a6784d', // article
  p: '#7a5aa9', // pronoun
  u: '#444',    // punctuation
  m: '#888',    // numeral
  '': '#444', // unknown/other
  x: '#000000ff' // irregular
};

function _norm(s) {
  return (s ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' '); // collapses spaces + newlines
}

const UI_KEY_TO_CFG = {
  person: 'pers',
  number: 'num',
  gender: 'gend',
  case: 'case',
  tense: 'tense',
  mood: 'mood',
  voice: 'voice',
  degree: 'degree',
  pos: 'pos'
};

const CFG_KEY_TO_UI = {
  pers: 'person',
  num: 'number',
  gend: 'gender',
  case: 'case',
  tense: 'tense',
  mood: 'mood',
  voice: 'voice',
  degree: 'degree',
  pos: 'pos'
};

export function normalizeValueToConfigKey(attrDef, input) {
  const s = (input ?? '').toString().trim().toLowerCase();
  if (!s) return '';

  const values = attrDef?.values || {};
  for (const [key, def] of Object.entries(values)) {
    if (s === String(key).toLowerCase()) return key;
    if (s === String(def?.short || '').toLowerCase()) return key;
    if (s === String(def?.long || '').toLowerCase()) return key;
    if (s === String(def?.postag || '').toLowerCase()) return key;
  }

  return '';
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

export function buildMorphStateFromUI(posChar, fields = {}, posKeyOverride = '') {
  const posValues = getPosValues();

  let posKey = normalizePosKey(posKeyOverride);

  if (!posKey) {
    for (const [key, def] of Object.entries(posValues)) {
      if (String(def?.postag || '').toLowerCase() === String(posChar || '').toLowerCase()) {
        posKey = key;
        break;
      }
    }
  }

  console.log('[buildMorphStateFromUI]', {
    posChar,
    fields,
    posKeyOverride,
    posKey
  });

  const state = { pos: posKey };

  Object.entries(UI_KEY_TO_CFG).forEach(([uiKey, cfgKey]) => {
    if (uiKey === 'pos') return;

    const attrDef = getMorphAttribute(cfgKey);
    if (!attrDef) {
      state[cfgKey] = '';
      return;
    }

    state[cfgKey] = normalizeValueToConfigKey(attrDef, fields[uiKey]);
  });

  return state;
}

export function applyMorphMappings(retrieverKey, rawResult) {

  const cfg = getActiveTagset();

  const m = cfg?.mappings?.[retrieverKey];

  if (window.morphMapDebug) {
    console.groupCollapsed(`[morph-map] retriever=${retrieverKey}`);
    console.log('cfg:', cfg);
    console.log('has cfg.mappings?', !!cfg?.mappings);
    console.log('has plugins.morph.mappings?', !!cfg?.plugins?.morph?.mappings);
    console.log('has main.plugins.morph.mappings?', !!cfg?.main?.plugins?.morph?.mappings);
    console.log('mapping found?', !!m);
    console.log('mapping keys:', m ? Object.keys(m) : null);
    console.log('rawResult:', rawResult);
    console.groupEnd();
  }

  if (!m || !rawResult || typeof rawResult !== 'object') return rawResult;

  const out = { ...rawResult };

  // -----------------------------
  // 1) Attribute name mappings
  // -----------------------------
  const attrMap = m.attributes || {};
  for (const [fromKey, toKey] of Object.entries(attrMap)) {
    if (fromKey in out && !(toKey in out)) {
      out[toKey] = out[fromKey];
    }
    // optional: delete out[fromKey]; // if you want to fully normalize
  }

  // -----------------------------
  // 2) Value mappings per attribute
  // -----------------------------
  const valueMaps = m.values || {};
  for (const [attrName, table] of Object.entries(valueMaps)) {
    if (!table) continue;

    const rawVal = out[attrName];
    if (rawVal == null) continue;

    const k = _norm(rawVal);

    // build a normalized lookup once per call
    let mapped = null;
    for (const [fromVal, toVal] of Object.entries(table)) {
      if (_norm(fromVal) === k) {
        mapped = toVal;
        break;
      }
    }

    if (mapped != null) out[attrName] = mapped;
  }

  return out;
}

export function composeUserPostag(posChar, fields, posKeyOverride = '') {
  const schema = getPostagSchema();
  const posValues = getPosValues();

  const state = buildMorphStateFromUI(posChar, fields, posKeyOverride);
  const tag = Array(schema.length).fill('-');

  schema.forEach((slotName, i) => {

    if (slotName === 'pos') {
      const posDef = posValues[state.pos];
      tag[i] = posDef?.postag || posChar || '-';
      return;
    }

    const attrDef = getMorphAttribute(slotName);

    if (!attrDef) {
      return;
    }

    const applies = attributeApplies(attrDef, state);

    if (!applies) {
      return;
    }

    const selectedKey = state[slotName];

    if (!selectedKey) {
      return;
    }

    if (!selectedKey) return;

    const valueDef = attrDef.values?.[selectedKey];

    if (!valueDef?.postag) return;

    tag[i] = valueDef.postag;
  });

  console.log('[composeUserPostag] output', tag.join(''));
  return tag.join('');
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: parseMorphTag
 * --------------------------------------------------------------------------
 * Converts a compact 9-character morphological tag (e.g. "v3spia---")
 * into a structured object describing its grammatical features.
 */
export function parseMorphTag(tag = '') {
  const schema = getPostagSchema();
  const posValues = getPosValues();
  const attrs = getActiveTagset()?.morphAttributes || {};
  const chars = String(tag || '').split('');
  const state = {};

  schema.forEach((slotName, i) => {
    const ch = chars[i] || '-';
    if (ch === '-') return;

    if (slotName === 'pos') {
      for (const [key, def] of Object.entries(posValues)) {
        if (String(def?.postag || '').toLowerCase() === ch.toLowerCase()) {
          state.pos = key;
          break;
        }
      }
      return;
    }

    const attrDef = attrs[slotName];
    if (!attrDef) return;

    for (const [key, def] of Object.entries(attrDef.values || {})) {
      if (String(def?.postag || '').toLowerCase() === ch.toLowerCase()) {
        state[CFG_KEY_TO_UI[slotName] || slotName] = key;
        break;
      }
    }
  });

  return {
    pos: state.pos || '-',
    person: state.person || '-',
    number: state.number || '-',
    tense: state.tense || '-',
    mood: state.mood || '-',
    voice: state.voice || '-',
    gender: state.gender || '-',
    case: state.case || '-',
    degree: state.degree || '-'
  };
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: ensureFormsArray
 * --------------------------------------------------------------------------
 * Ensures that a given word object has a .forms array for storing user forms.
 */
export function ensureFormsArray(word) {
  if (!word.forms) {
    word.forms = [];
  }
  return word.forms;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: ensureDocumentSnapshot
 * --------------------------------------------------------------------------
 * Stores the original lemma and postag in `_doc` if not already present.
 * This allows the system to restore the XML values after user edits.
 * Keep original XML values safe and use shadow fields for rendering
 */
export function ensureDocumentSnapshot(word) {
  if (!word) return;
  if (!word._doc) {
    word._doc = {
      lemma:  (word.lemma  || '').trim(),
      postag: (word.postag || '').trim()
    };
  }
  // default display = document
  if (word._displayLemma === undefined)  word._displayLemma  = word._doc.lemma;
  if (word._displayPostag === undefined) word._displayPostag = word._doc.postag;
  word.source = 'document';
}

export function colorForTag(tag) {
  const ch = (tag && tag[0]) ? tag[0].toLowerCase() : '';
  return getPosColorByChar(ch) || '';
}
