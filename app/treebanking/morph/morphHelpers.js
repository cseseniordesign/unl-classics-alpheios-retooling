// ===== POS color utilities =====
const POS_COLORS = {
  v: '#c65a5a', // verb
  c: '#c77d9b', // conjunction
  d: '#e69109', // adverb
  i: '#b29100', // interjection
  n: '#487a6f', // noun
  a: '#5a78c6', // adjective
  r: '#5a9b6b', // adposition
  l: '#a6784d', // article
  p: '#7a5aa9', // pronoun
  u: '#444',    // punctuation
  m: '#888',    // numeral
  '': '#444' // unknown/other
};

export function composeUserPostag(posChar, fields) {
  // Always produce 9 characters
  const tag = Array(9).fill('-');

  // POS always goes in slot 0
  tag[0] = posChar || '-';

  switch (posChar) {

    // ========================
    //        VERB  (v)
    // ========================
    case 'v':
      // Slot meanings for verbs:
      // 1 = person
      // 2 = number
      // 3 = tense
      // 4 = mood
      // 5 = voice
      // 6 = gender (for participles)
      // 7 = case   (for participles)
      // 8 = degree (rare, usually '-')
      if (fields.person) tag[1] = fields.person;
      if (fields.number) tag[2] = fields.number;
      if (fields.tense)  tag[3] = fields.tense;
      if (fields.mood)   tag[4] = fields.mood;
      if (fields.voice)  tag[5] = fields.voice;

      // participles / verbal adjectives:
      if (fields.gender) tag[6] = fields.gender;
      if (fields.case)   tag[7] = fields.case;
      if (fields.degree) tag[8] = fields.degree;

      return tag.join('');


    // ========================
    //      PRONOUN  (p)
    // ========================
    case 'p':
      // pronoun uses:
      // 1 = person (pronouns have it)
      // 2 = number
      // 6 = gender
      // 7 = case
      if (fields.person) tag[1] = fields.person;
      if (fields.number) tag[2] = fields.number;
      if (fields.gender) tag[6] = fields.gender;
      if (fields.case)   tag[7] = fields.case;
      return tag.join('');


    // ========================
    //     NOUN/ARTICLE (n,l)
    // ========================
    case 'n':
    case 'l':
      // 2 = number
      // 6 = gender
      // 7 = case
      if (fields.number) tag[2] = fields.number;
      if (fields.gender) tag[6] = fields.gender;
      if (fields.case)   tag[7] = fields.case;
      return tag.join('');


    // ========================
    //     ADJECTIVE  (a)
    // ========================
    case 'a':
      // 2 = number
      // 6 = gender
      // 7 = case
      // 8 = degree
      if (fields.number) tag[2] = fields.number;
      if (fields.gender) tag[6] = fields.gender;
      if (fields.case)   tag[7] = fields.case;
      if (fields.degree) tag[8] = fields.degree;
      return tag.join('');


    // ========================
    //      NUMERAL (m)
    // ========================
    case 'm':
      // Same structure as nouns:
      if (fields.number) tag[2] = fields.number;
      if (fields.gender) tag[6] = fields.gender;
      if (fields.case)   tag[7] = fields.case;
      return tag.join('');


    // ========================
    //      ADVERB  (d)
    // ========================
    case 'd':
      // Only degree matters
      if (fields.degree) tag[8] = fields.degree;
      return tag.join('');


    // ========================
    //  Conjunction (c),
    //  Adposition (r),
    //  Interjection (i),
    //  Punctuation/Unknown (u)
    // ========================
    case 'c':
    case 'r':
    case 'i':
    case 'u':
      // Nothing except POS
      return tag.join('');


    // ========================
    //     DEFAULT / UNKNOWN
    // ========================
    default:
      return tag.join('');
  }
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: parseMorphTag
 * --------------------------------------------------------------------------
 * Converts a compact 9-character morphological tag (e.g. "v3spia---")
 * into a structured object describing its grammatical features.
 */
export function parseMorphTag(tag = '') {
  const t = tag.split('');
  const obj = {
    pos: t[0] || '-',
    person: t[1] || '-',
    number: t[2] || '-',
    tense:  t[3] || '-',
    mood:   t[4] || '-',
    voice:  t[5] || '-',
    gender: t[6] || '-',
    case:   t[7] || '-',
    degree: t[8] || '-'
  };
  return obj;
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
  return POS_COLORS[ch] || POS_COLORS[''];
}
