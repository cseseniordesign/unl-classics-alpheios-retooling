/**
 * =============================================================================
 * MORPH LEXICON (IndexedDB) — Persistent User Forms + “Most Used” Ranking
 * =============================================================================
 *
 * Purpose
 * -------
 * Arethusa’s sponsor expectation:
 *   1) If a user creates a morph form for a word, it should persist between sessions
 *      (until they use a new browser profile / clear storage).
 *   2) If that word appears again (same sentence / other sentence / other treebank),
 *      the user-added form should be available everywhere.
 *   3) “Most used” forms should be preferred (sorted to the top, and usable for
 *      preselect logic elsewhere).
 *
 * This module implements a small persistent “lexicon” using IndexedDB:
 *   - Stores user-added forms keyed by (language + normalized surface form + lemma + postag)
 *   - Tracks usage counts and timestamps to support “most used” ranking
 *   - Exposes helpers to merge lexicon forms into per-token word objects
 *
 * Notes
 * -----
 * - This is frontend-only persistence (no backend). Data stays in the user’s browser.
 * - IndexedDB is async and avoids UI jank vs localStorage when the lexicon grows.
 * - This file does NOT decide UI preselect behavior; it provides the data needed.
 * =============================================================================
 */

const DB_NAME = 'arethusa_morph_lexicon';
const DB_VERSION = 2;
const STORE_FORMS = 'forms';

let _dbPromise = null;

/**
 *
 * ------------------------------------------------------------------------
 * FUNCTION: openDB
 * ------------------------------------------------------------------------
 * Opens (or creates) the IndexedDB database and ensures the object store and
 * indexes exist. Uses a cached promise so the DB is opened only once.
 *
 * Schema
 * ------
 * Store: "forms" (keyPath: "id")
 * Index: "bySurface" on [lang, surfaceKey]
 *
 * @returns {Promise<IDBDatabase>} resolved database instance
 */
function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
    const db = req.result;

    // Create store if it doesn't exist yet
    let store;
    if (!db.objectStoreNames.contains(STORE_FORMS)) {
        store = db.createObjectStore(STORE_FORMS, { keyPath: 'id' });
        store.createIndex('bySurface', ['lang', 'surfaceKey'], { unique: false });
    } else {
        store = req.transaction.objectStore(STORE_FORMS);
        // index already exists in your v1 schema; if not, you'd create it here
    }

    // No special migration needed: old rows just won't have `source` set.
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return _dbPromise;
}

/**
 *
 * ------------------------------------------------------------------------
 * FUNCTION: initMorphLexicon
 * ------------------------------------------------------------------------
 * Public initializer that ensures the IndexedDB database is ready.
 * Call this once during app startup or after loading a treebank.
 *
 * @returns {Promise<void>}
 */
export async function initMorphLexicon() {
  await openDB();
}

/**
 *
 * ------------------------------------------------------------------------
 * FUNCTION: withStore
 * ------------------------------------------------------------------------
 * Convenience wrapper to open a transaction and pass the object store
 * to a callback. Resolves when the transaction completes.
 *
 * @param {"readonly"|"readwrite"} mode - transaction mode
 * @param {(store: IDBObjectStore) => void} fn - callback that performs store ops
 * @returns {Promise<void>} resolves when tx completes successfully
 */
async function withStore(mode, fn) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FORMS, mode);
    const store = tx.objectStore(STORE_FORMS);

    try {
      fn(store);
    } catch (e) {
      reject(e);
      return;
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 *
 * ------------------------------------------------------------------------
 * FUNCTION: normalizeSurface
 * ------------------------------------------------------------------------
 * Normalizes a surface form to produce a stable key across sentences/treebanks.
 * This is intentionally conservative (trim + lowercase) to avoid surprises.
 * If you later want accent-stripping for Greek, do it here.
 *
 * @param {string} surface - raw token surface form (e.g., word.form)
 * @returns {string} normalized surface key
 */
function normalizeSurface(surface) {
  return (surface || '').trim().toLowerCase();
}

/**
 *
 * ------------------------------------------------------------------------
 * FUNCTION: makeFormId
 * ------------------------------------------------------------------------
 * Constructs the unique primary key for a lexicon entry.
 * The key encodes the fields we consider “the same form”:
 *   (language, normalized surface form, lemma, postag)
 *
 * @param {string} lang - language code (e.g., "grc", "lat")
 * @param {string} surfaceKey - normalized surface key
 * @param {string} lemma - lemma string
 * @param {string} postag - postag string
 * @returns {string} unique ID for the stored record
 */
function makeFormId(lang, surfaceKey, lemma, postag) {
  return `${lang}::${surfaceKey}::${lemma || ''}::${postag || ''}`;
}

/**
 *
 * ------------------------------------------------------------------------
 * FUNCTION: upsertForm
 * ------------------------------------------------------------------------
 * Ensures a form exists in the lexicon. If it already exists, this does nothing.
 * This is used when the user creates a new form (so it persists across sessions).
 *
 * Stored defaults:
 *   count    = 0 (usage can be incremented separately)
 *   lastUsed = 0
 *
 * @param {Object} args
 * @param {string} args.lang - language code (e.g., "grc", "lat")
 * @param {string} args.surface - raw token surface form
 * @param {string} args.lemma - lemma for the form
 * @param {string} args.postag - postag for the form
 * @returns {Promise<void>}
 */
export async function upsertForm({ lang, surface, lemma, postag, source = 'you' }) {
  const surfaceKey = normalizeSurface(surface);
  if (!lang || !surfaceKey) return;

  const id = makeFormId(lang, surfaceKey, lemma, postag);

  await withStore('readwrite', (store) => {
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (existing) return;

      store.put({
        id,
        lang,
        surfaceKey,
        surfaceRaw: surface || '',
        lemma: lemma || '',
        postag: postag || '',
        source: source || 'you',
        count: 0,
        lastUsed: 0
      });
    };
  });
}

/**
 *
 * ------------------------------------------------------------------------
 * FUNCTION: incrementUsage
 * ------------------------------------------------------------------------
 * Increments the usage count for a form and updates lastUsed timestamp.
 * If the form does not exist yet (e.g., a Morpheus suggestion selected first),
 * this will create it.
 *
 * This is the backbone of “most used” ranking.
 *
 * @param {Object} args
 * @param {string} args.lang - language code
 * @param {string} args.surface - raw token surface form
 * @param {string} args.lemma - lemma string
 * @param {string} args.postag - postag string
 * @returns {Promise<void>}
 */
export async function incrementUsage({ lang, surface, lemma, postag, source = 'you' }) {
  const surfaceKey = normalizeSurface(surface);
  if (!lang || !surfaceKey) return;

  const id = makeFormId(lang, surfaceKey, lemma, postag);
  const now = Date.now();

  await withStore('readwrite', (store) => {
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const row = getReq.result;

      if (!row) {
        store.put({
          id,
          lang,
          surfaceKey,
          surfaceRaw: surface || '',
          lemma: lemma || '',
          postag: postag || '',
          source: source || 'you',
          count: 1,
          lastUsed: now
        });
        return;
      }

      row.count = (row.count || 0) + 1;
      row.lastUsed = now;
      if (!row.source) row.source = source || 'you';
      store.put(row);
    };
  });
}

function normalizeStoredSource(src) {
  const s = String(src || '').trim().toLowerCase();
  if (s === 'document') return 'document';           // probably won't be stored, but safe
  if (s.includes('morpheus')) return 'bsp/morpheus';
  return 'you';
}

/**
 *
 * ------------------------------------------------------------------------
 * FUNCTION: getFormsForSurface
 * ------------------------------------------------------------------------
 * Fetches all lexicon forms for a given (language + surface form) and returns
 * them sorted by:
 *   1) count desc
 *   2) lastUsed desc
 *
 * Returned objects are normalized to the shape used in Arethusa Lite:
 *   { lemma, postag, source:"you", _count }
 *
 * @param {Object} args
 * @param {string} args.lang - language code
 * @param {string} args.surface - raw token surface form
 * @returns {Promise<Array<{lemma:string, postag:string, source:string, _count:number}>>}
 */
export async function getFormsForSurface({ lang, surface }) {
  const surfaceKey = normalizeSurface(surface);
  if (!lang || !surfaceKey) return [];

  const db = await openDB();

  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FORMS, 'readonly');
    const idx = tx.objectStore(STORE_FORMS).index('bySurface');

    const req = idx.getAll([lang, surfaceKey]);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  rows.sort((a, b) => (b.count || 0) - (a.count || 0) || (b.lastUsed || 0) - (a.lastUsed || 0));

  return rows.map(r => ({
    lemma: r.lemma || '',
    postag: r.postag || '',
    source: normalizeStoredSource(r.source),
    _count: r.count || 0
  }));
}

/**
 *
 * ------------------------------------------------------------------------
 * FUNCTION: mergeFormsIntoWord
 * ------------------------------------------------------------------------
 * Merges lexicon forms for word.form into the token’s local `word.forms` array.
 * This is how user forms show up on every instance of the word across sentences
 * and across newly-loaded treebanks.
 *
 * This function does NOT set activeForm. It only ensures availability.
 *
 * @param {Object} args
 * @param {string} args.lang - language code
 * @param {Object} args.word - token object (expects `form` and `forms`)
 * @returns {Promise<Array<{lemma:string, postag:string, source:string, _count:number}>>}
 */
export async function mergeFormsIntoWord({ lang, word }) {
  if (!word) return [];
  word.forms ||= [];

  const forms = await getFormsForSurface({ lang, surface: word.form });

  for (const f of forms) {
    const exists = word.forms.some(x => (x.lemma || '') === f.lemma && (x.postag || '') === f.postag);
    if (!exists) {
        word.forms.push({
            lemma: f.lemma,
            postag: f.postag,
            source: f.source,
            _count: f._count || 0
        });
    } else {
    // If it exists, still refresh count so sorting works
    const match = word.forms.find(x => (x.lemma || '') === f.lemma && (x.postag || '') === f.postag);
    if (match) match._count = Math.max(Number(match._count) || 0, Number(f._count) || 0);
    }
  }

  return forms;
}

/**
 *
 * ------------------------------------------------------------------------
 * FUNCTION: mergeIntoAllTokens
 * ------------------------------------------------------------------------
 * Walks the current in-memory treebank (`window.treebankData`) and merges
 * lexicon forms into every token. Call this after parsing/loading a treebank,
 * and optionally right after creating a new form so it appears everywhere
 * immediately.
 *
 * @param {Object} args
 * @param {string} args.lang - language code
 * @returns {Promise<void>}
 */
export async function mergeIntoAllTokens({ lang }) {
  const data = window.treebankData || [];
  for (const s of data) {
    for (const w of (s.words || [])) {
      await mergeFormsIntoWord({ lang, word: w });
    }
  }
}

/**
 *
 * ------------------------------------------------------------------------
 * FUNCTION: pickTopLexiconForm
 * ------------------------------------------------------------------------
 * Helper utility for “most used preselect” logic. This does NOT mutate anything;
 * it simply returns the best lexicon form (already usage-sorted).
 *
 * Use this in UI code when deciding what to preselect:
 *   - if it returns a form, you may set word.activeForm accordingly.
 *
 * @param {Object} args
 * @param {string} args.lang - language code
 * @param {string} args.surface - raw token surface form
 * @returns {Promise<{lemma:string, postag:string, source:string, _count:number} | null>}
 */
export async function pickTopLexiconForm({ lang, surface }) {
  const forms = await getFormsForSurface({ lang, surface });
  return forms.length ? forms[0] : null;
}

export async function deleteLexiconForm({ lang, surface, lemma, postag }) {
  if (!lang) return;
  const surfaceKey = normalizeSurface(surface);
  const id = makeFormId(lang, surfaceKey, lemma, postag);

  await withStore('readwrite', (store) => {
    store.delete(id);
  });
}

