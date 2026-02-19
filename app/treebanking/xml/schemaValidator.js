import { createsCycle } from "../tree/treeUtils.js";
import { getLanguage, normalizeLang } from "../input/language.js";

const BASE_VALID_POS = new Set([
  'n','v','a','d','p','r','c','l','m','i','u','-','x'
]);

function validPosForLang(lang) {
  const L = normalizeLang(lang);
  const set = new Set(BASE_VALID_POS);

  if (L === 'lat') {
    set.add('e');    // exclamation allowed in Latin
    set.delete('l'); // optional: if you want to disallow article in Latin schema too
  } else if (L === 'grc') {
    set.delete('e'); // explicitly NOT allowed in Greek
  }

  return set;
}

const VALID_ATTRS = ['id', 'form', 'lemma', 'postag', 'relation', 'head'];

// Not currently in use
// === POS-specific whitelist of postag positions (0-based indexes) ===
// These are positions that may contain a letter; all others must be '-'.
// 0 = POS, 1 = Person, 2 = Number, 3 = Tense, 4 = Mood, 5 = Voice, 6 = Gender, 7 = Casus, 8 = Degree/Extra
const POSTAG_ALLOWED_POSITIONS = {
    n: [2, 6, 7],       // number, gender, casus
    v: [1, 2, 3, 4, 5, 6, 7, 8], // all
    a: [2, 6, 7, 8],    // number, gender, casus, degree
    d: [8],             // degree             
    p: [1, 2, 6, 7],    // person, number, gender, casus 
    r: [],              // adpositions
    c: [],              // conjunctions
    l: [2, 6, 7],       // number, gender, casus
    m: [2, 6, 7],       // number, gender, casus
    i: [],              // interjections
    u: [],              // punctuation/unknown
    '-': []
};

export const BASE_REL = new Set([
  'PRED','SBJ','OBJ','ATR','ADV',
  'AUXP','AUXC','AUXY','AUXZ','AUXV','AUXR','AUXG','AUXX','AUXK',
  'COORD','ATV','ATVV','PNOM','OCOMP','APOS','EXD'
]);

export const REL_SUFFIXES = new Set([
    'CO', 'AP'
]);

/**
 * Helper: detect dummy / filler nodes like [0], [1], [foo]
 * or nodes missing both lemma and postag.
 */
function isDummyWord(wordEl) {
  const form = wordEl.getAttribute('form') || '';
  const lemma = wordEl.getAttribute('lemma') || '';
  const postag = wordEl.getAttribute('postag') || '';

  const isBracketed = /^\[[^\]]*\]$/.test(form); // e.g. [0], [1], [dummy]
  const isEmptyMorph = lemma.trim() === '' && postag.trim() === '';
  return isBracketed || isEmptyMorph;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: validateTreebankSchema
 * --------------------------------------------------------------------------
 * Validates the structure and morphology of a Treebank XML document.
 *
 * Key behavior change (to match "fresh" Arethusa-like XML):
 * - head="" is allowed (means unset) and SKIPS numeric/range/cycle checks
 * - relation="" is allowed (means unset) and SKIPS relation validation
 * - postag="" is allowed (means unset) and SKIPS postag validation
 *
 * @param {XMLDocument} xmlDoc - Parsed XML document.
 * @returns {boolean} true if valid, throws Error otherwise.
 */
export function validateTreebankSchema(xmlDoc) {
  const lang = getLanguage();
  const VALID_POS = validPosForLang(lang);
  const isLatin = normalizeLang(lang) === 'lat';

  const sentences = xmlDoc.querySelectorAll('sentence');
  if (!sentences.length)
    throw new Error('XML must contain at least one <sentence>.');

  sentences.forEach((s, si) => {
    const sid = s.getAttribute('id') || `(sentence ${si + 1})`;

    // 1) Look at ALL element children, not just <word>
    const children = Array.from(s.children).filter(n => n.nodeType === 1);
    if (!children.length) {
      throw new Error(`Sentence ${sid} must contain at least one <word>.`);
    }

    // 2) Fail fast on any non-<word> element (catches <wrod>, <Word>, etc.)
    children.forEach(el => {
      const name = (el.localName || el.tagName || '').toLowerCase();
      if (name !== 'word') {
        throw new Error(
          `Invalid element <${el.tagName}> found inside sentence ${sid}. Expected <word>.`
        );
      }
    });

    const words = /** @type {Element[]} */ (children);
    const idSet = new Set();

    words.forEach((w, wi) => {
      // --- Check required attributes first ---
      VALID_ATTRS.forEach(attr => {
        if (!w.hasAttribute(attr)) {
          throw new Error(
            `<word> at index ${wi + 1} in sentence ${sid} is missing required attribute "${attr}".`
          );
        }
      });

      const wid = (w.getAttribute('id') || `${wi + 1}`).trim();
      const relation = (w.getAttribute('relation') ?? '').trim();
      const postag = (w.getAttribute('postag') ?? '').trim();
      const head = (w.getAttribute('head') ?? '').trim();

      // Keep track of IDs to ensure uniqueness
      if (idSet.has(wid)) {
        throw new Error(`Duplicate id="${wid}" found. Word IDs must be unique.`);
      }
      idSet.add(wid);

      // --- ID validity ---
      if (!/^\d+$/.test(wid)) {
        throw new Error(`Word id="${wid}" must be a numeric value.`);
      }

      // --- Head validity ---
      // Allow head="" (unset) → skip numeric/range/cycle checks
      if (head !== "") {
        if (head === wid) {
          throw new Error(`Word id="${wid}" cannot head itself.`);
        }
        if (!/^-?\d+$/.test(head)) {
          throw new Error(`Word id="${wid}" has non-numeric head "${head}".`);
        }

        const headNum = Number(head);
        const maxId = words.length;

        if (headNum < 0 || headNum > maxId) {
          throw new Error(
            `Word id="${wid}": head="${head}" is out of range. Valid heads are 0–${maxId}.`
          );
        }

        // Cycle detection only makes sense when head is set
        if (createsCycle(words, String(wid), String(head))) {
          throw new Error(
            `Cycle detected: setting head="${head}" for id="${wid}" would create a dependency loop.`
          );
        }
      }

      // --- Dummy words (allowed) ---
      // For dummy words, allow blank relation/postag/head — they can be filled later.
      if (isDummyWord(w)) {
        return;
      }

      // --- Postag validation ---
      // Allow postag="" (unset)
      if (postag !== "") {
        const pos = postag[0]?.toLowerCase() || '';
        if (!isLatin && pos === 'e') {
          throw new Error(`Word id="${wid}": POS 'e' (exclamation) is only allowed in Latin.`);
        }
        if (!VALID_POS.has(pos))
          throw new Error(`Invalid POS '${pos}' in word id="${wid}".`);

        if (postag.length !== 9)
          throw new Error(
            `Word id="${wid}": postag must be exactly 9 characters (has ${postag.length}).`
          );

      // Detect invalid characters directly (RELAXED + allow '_' globally)
      for (let i = 0; i < postag.length; i++) {
        const ch = postag[i];

        // Person slot is ALWAYS index 1, regardless of POS
        const isPersonSlot = (i === 1);

        const validChar = isPersonSlot
          ? /^[a-z1-3-_]$/.test(ch)   // person slot: letters, 1-3, '-', '_'
          : /^[a-z-_]$/.test(ch);    // other slots: letters, '-', '_'

        if (!validChar) {
          throw new Error(
            `Word id="${wid}": invalid character '${ch}' at position ${i + 1} in postag '${postag}'. ` +
            (isPersonSlot
              ? "Only lowercase letters, digits 1–3, '-', and '_' are allowed in the person slot."
              : "Only lowercase letters, '-', and '_' are allowed.")
          );
        }
      }
      }

      // --- Relation validation ---
      // Allow relation="" (unset)
      if (relation !== "") {
        const relRaw = relation.trim();
        const rel = relRaw.toUpperCase();

        // placeholder allowed
        if (rel === '---') {
          // OK
        }
        // exact base relation allowed
        else if (BASE_REL.has(rel)) {
          // OK
        }
        // possible composite form
        else if (rel.includes('_')) {
          const parts = rel.split('_');
          const base = parts[0];
          const suffixes = parts.slice(1);

          const allSuffixesValid =
            BASE_REL.has(base) &&
            suffixes.every(suf => REL_SUFFIXES.has(suf));

          if (!allSuffixesValid) {
            throw new Error(
              `Word id="${wid}": Invalid relation '${relRaw}'.`
            );
          }
        }
        // otherwise invalid
        else {
          throw new Error(
            `Word id="${wid}": Invalid relation '${relRaw}'.`
          );
        }
      }
    });
  });

  return true;
}