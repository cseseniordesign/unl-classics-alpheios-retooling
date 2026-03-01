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
  _activeConfig = config;
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
