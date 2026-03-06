/**
 * tagsetStore.js
 * --------------
 * Simple state store for the active tagset selection.
 *
 * Holds the loaded TagsetConfig and exposes helpers used by the
 * morph editor, relation picker, and parser throughout the app.
 *
 * Usage:
 *   import { setActiveTagset, getActiveTagset, onTagsetChange } from './tagsetStore.js';
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _activeConfig = null;
const _listeners = [];

// ===== POS color utilities =====
const FALLBACK_POS_COLORS = {
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Store a loaded tagset config as the active one.
 * Notifies all registered listeners.
 *
 * @param {object} config - A TagsetConfig returned by tagsetConfig.loadTagsetConfig()
 */
export function setActiveTagset(config) {
  _activeConfig = config || null;
  _rebuildPosIndex(config);
  _listeners.forEach(fn => fn(config));
}

/**
 * Returns the currently active TagsetConfig, or null if none loaded yet.
 * @returns {object|null}
 */
export function getActiveTagset() {
  return _activeConfig;
}

/**
 * Register a callback to be called whenever the active tagset changes.
 * @param {function} fn
 */
export function onTagsetChange(fn) {
  _listeners.push(fn);
}

// ---------------------------------------------------------------------------
// Convenience accessors
// (These return safe empty arrays/strings if no tagset is loaded)
// ---------------------------------------------------------------------------

/** All POS categories for the active tagset */
export function getPosList() {
  return _activeConfig?.posCategories || [];
}

/** Morph attributes for a given POS value (e.g. 'v', 'n') */
export function getMorphAttributes(posValue) {
  return _activeConfig?.morphAttributes?.[posValue] || [];
}

/** All relation labels for the active tagset */
export function getRelations() {
  return _activeConfig?.relations || [];
}

/** Whether the active tagset includes morphology annotation */
export function hasMorphology() {
  return _activeConfig?.hasMorph ?? true;
}

/** The tag format string: 'positional9' | 'ud' | 'none' */
export function getTagFormat() {
  return _activeConfig?.tagFormat || 'positional9';
}

/** The active tagset's id (e.g. 'aldt', 'pedalion') */
export function getActiveTagsetId() {
  return _activeConfig?.id || null;
}

/** The active tagset's human-readable label */
export function getActiveTagsetLabel() {
  return _activeConfig?.label || 'None';
}

/** The active tagset's primary language code */
export function getActiveTagsetLang() {
  return _activeConfig?.lang || null;
}

/** POS lookup helpers (postagChar -> metadata) */
let _posByPostag = null;

function _rebuildPosIndex(config) {
  _posByPostag = Object.create(null);
  const list = config?.posCategories || [];
  for (const p of list) {
    const key = (p.postag || '').toString().trim().toLowerCase();
    if (!key) continue;
    _posByPostag[key] = {
      long:  p.long  || key,
      short: p.short || key,
      color: p.color || '',
      postag: key,
    };
  }
}

export function getPosMeta(postagChar) {
  const k = (postagChar || '').toString().trim().toLowerCase();
  return (_posByPostag && _posByPostag[k]) ? _posByPostag[k] : null;
}

export function getPosColorByChar(postagChar) {
  const k = (postagChar || '').toString().trim().toLowerCase();
  const cfg = getPosMeta(k)?.color;
  return cfg || FALLBACK_POS_COLORS[k] || FALLBACK_POS_COLORS[''];
}
