/**
 * tagsetConfig.js
 * ---------------
 * Loads a compiled arethusa-configs dist JSON file and extracts
 * the values the treebanking  needs:
 *
 *   posCategories   — array of { value, label } for part-of-speech
 *   morphAttributes — map of posValue → array of { name, label, values: [{value, label}] }
 *   relations       — array of { value, label } for dependency relations
 *   tagFormat       — 'positional9' | 'ud' | 'none'
 *   hasMorph        — boolean
 *
 * The arethusa dist JSON has a deeply nested structure. This module
 * normalizes it into a flat, predictable shape regardless of which
 * tagset was loaded.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// tagsetConfig.js

/**
 * Loads a tagset dist JSON and returns a normalized TagsetConfig.
 * If you pass the registry entry, we stamp id/label/lang/hasMorph onto the config
 * so downstream code (tagsetStore, UI, tree coloring) can rely on them.
 *
 * @param {string} distFile - path/URL to the dist JSON
 * @param {object|null} entry - optional registry entry { id, label, lang, hasMorph, ... }
 */
export async function loadTagsetConfig(distFile, meta = null) {
  const res = await fetch(distFile);
  if (!res.ok) {
    throw new Error(`Failed to fetch dist file: ${distFile} (${res.status})`);
  }

  const distJson = await res.json();
  if (!distJson) {
    throw new Error(`Dist JSON empty/undefined: ${distFile}`);
  }

  const cfg = parseDistJson(distJson, distFile);

  // Attach registry metadata (dist files usually don't include these)
  if (meta) {
    cfg.id      = meta.id      ?? cfg.id;
    cfg.label   = meta.label   ?? cfg.label;
    cfg.lang    = meta.lang    ?? cfg.lang;
    cfg.beta    = meta.beta    ?? cfg.beta;
    cfg.format  = meta.format  ?? cfg.format;
    cfg.hasMorph = meta.hasMorph ?? cfg.hasMorph;
  }

  return cfg;
}

// ---------------------------------------------------------------------------
// Internal parser
// ---------------------------------------------------------------------------

/**
 * Normalizes an arethusa dist JSON into a TagsetConfig.
 *
 * Arethusa dist JSONs vary by tagset but share a common skeleton:
 *
 * {
 *   "plugins": {
 *     "morph": {
 *       "posAttributes": { ... },   // POS definitions
 *       "attributes": { ... }       // per-POS morph attribute definitions
 *     },
 *     "depTree": {
 *       "relations": [ ... ]        // dependency relation labels
 *     }
 *   }
 * }
 *
 * Some configs use "dependency" instead of "depTree", and some store
 * relations under plugins.relations directly. We handle all variants.
 */
function parseDistJson(raw, registryEntry) {
  const plugins = raw?.plugins || {};
  const morph = plugins?.morph ?? {};
  const rel   = plugins?.relation ?? {};

  const posCategories  = extractPOS(plugins);
  const morphAttributes = extractMorphAttributes(plugins, posCategories);
  const relations       = extractRelations(plugins);
  const tagFormat       = detectTagFormat(raw, registryEntry);

  return {
    // Identity
    id:        registryEntry.id,
    label:     registryEntry.label,
    format:    registryEntry.format,
    lang:      registryEntry.lang,
    hasMorph:  registryEntry.hasMorph,
    beta:      registryEntry.beta || false,

    // Extracted values
    posCategories:   extractPOS(morph),
    morphAttributes: extractMorphAttributes(morph),
    relations:       extractRelations(rel),
    tagFormat,

    // Raw source preserved for debugging
    _raw: raw,
  };
}

// ---------------------------------------------------------------------------
// POS extraction
// ---------------------------------------------------------------------------

function extractPOS(morph) {
  const posValues = morph?.attributes?.pos?.values ?? {};
  return Object.entries(posValues).map(([key, v]) => ({
    short:   v.short   ?? key,
    long:    v.long    ?? key,
    postag:  v.postag  ?? '',
    color:   v.style?.color ?? '',
  }));
}

// ---------------------------------------------------------------------------
// Morph attribute extraction
// ---------------------------------------------------------------------------

function extractMorphAttributes(morph) {
  const attrs = morph?.attributes ?? {};
  const result = {};

  for (const [attrName, attrDef] of Object.entries(attrs)) {
    if (attrName === 'pos') continue;
    if (!attrDef || typeof attrDef !== 'object') continue;

    const values = {};
    for (const [valKey, valDef] of Object.entries(attrDef.values ?? {})) {
      values[valKey] = {
        short:  valDef.short  ?? valKey,
        long:   valDef.long   ?? valKey,
        postag: valDef.postag ?? '',
      };
    }

    result[attrName] = {
      long:   attrDef.long  ?? attrName,
      short:  attrDef.short ?? attrName,
      rules:  attrDef.rules ?? [],
      values,
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Relation label extraction
// ---------------------------------------------------------------------------

function extractRelations(relPlugin) {
  return relPlugin?.relations?.labels ?? {};
}

// ---------------------------------------------------------------------------
// Tag format detection
// ---------------------------------------------------------------------------

function detectTagFormat(raw, registryEntry) {
  if (!registryEntry.hasMorph) return 'none';

  // UD configs use feature=value pairs, not positional strings
  if (registryEntry.format === 'conllu') return 'ud';

  // Most ALDT-derived configs use a 9-character positional tag
  const format = registryEntry.format || '';
  if (['aldt', 'smyth', 'jmh_lat', 'jmh_grc', 'persian',
       'lyon_lat', 'lyon_grc', 'pedalion'].includes(format)) {
    return 'positional9';
  }

  return 'positional9'; // safe default
}
