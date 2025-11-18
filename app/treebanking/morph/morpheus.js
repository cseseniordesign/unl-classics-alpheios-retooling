function normalizePerson(p) {
  const s = (p || '').toString().toLowerCase().trim();
  if (!s) return '';
  if (s === '1' || s === '1st' || s.startsWith('first'))  return '1';
  if (s === '2' || s === '2nd' || s.startsWith('second')) return '2';
  if (s === '3' || s === '3rd' || s.startsWith('third'))  return '3';
  return '';
}

// safe nested getter
function val(obj, path) {
  return path.reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

/**
 * Connect to Morpheus API via Perseids.
 * Returns one flat result object per <infl> in ALL lemma entries.
 */
export async function fetchMorphology(word, lang) {
  const engine = lang === "grc" ? "morpheusgrc" : "morpheuslat";
  const url = `https://services.perseids.org/bsp/morphologyservice/analysis/word?lang=${lang}&engine=${engine}&word=${encodeURIComponent(word)}`;

  const response = await fetch(url);
  const rawText = await response.text();

  let json;
  try {
    json = JSON.parse(rawText);
  } catch (err) {
    console.error("Failed to parse JSON from Morpheus:", err, rawText);
    return [];
  }

  const results = [];

  // Top-level can be a single object or an array of objects
  const items = Array.isArray(json) ? json : [json];

  items.forEach(item => {
    const annRaw = item?.RDF?.Annotation;
    if (!annRaw) return;

    // (Rarely) Annotation itself could be an array, so be defensive
    const annotations = Array.isArray(annRaw) ? annRaw : [annRaw];

    annotations.forEach(ann => {
      const bodyRaw = ann?.Body;
      if (!bodyRaw) return;

      // 🔴 THIS is the important bit:
      // Body can be a single object OR an array, where each Body = one lemma
      const bodies = Array.isArray(bodyRaw) ? bodyRaw : [bodyRaw];

      bodies.forEach(body => {
        const entryRaw = body?.rest?.entry;
        if (!entryRaw) return;

        const entries = Array.isArray(entryRaw) ? entryRaw : [entryRaw];

        entries.forEach(e => {
          const dict = e.dict || {};
          const inflList = Array.isArray(e.infl) ? e.infl : [e.infl];

          inflList.forEach(infl => {
            if (!infl) return;

            const rawPOS =
              val(infl, ["pofs", "$"]) ||
              val(dict, ["pofs", "$"]) ||
              val(infl, ["pos", "$"])  ||
              val(dict, ["pos", "$"]);

            const rawPerson =
              val(infl, ["pers", "$"]) ||
              val(infl, ["person", "$"]);

            results.push({
              // lemma can change between Body elements: ω, εἰμί, πηρός, τίς, ...
              lemma:  val(dict, ["hdwd", "$"]) || word,
              order:  val(dict, ["order", "$"]),
              pos:    rawPOS || '',                         // "verb", "adverb", "conjunction", ...
              person: normalizePerson(rawPerson),           // -> "1" | "2" | "3" | ""
              num:    val(infl, ["num", "$"]),
              tense:  val(infl, ["tense", "$"]),
              mood:   val(infl, ["mood", "$"]),
              voice:  val(infl, ["voice", "$"]),
              gender: val(dict, ["gend", "$"]) || val(infl, ["gend", "$"]),
              case:   val(infl, ["case", "$"])
            });
          });
        });
      });
    });
  });

  if (typeof window !== "undefined" && window.morphDebug) {
    const uniquePOS = [...new Set(results.map(r => r.pos))];
    console.log('[Morph] flattened results for', word, results);
    console.log('[Morph] unique POS values:', uniquePOS);
  }

  return results;
}

// Expose for console testing
if (typeof window !== "undefined") {
  window.fetchMorphology = fetchMorphology;
}