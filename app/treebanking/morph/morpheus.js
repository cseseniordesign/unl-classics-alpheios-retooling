/**
 * --------------------------------------------------------------------------
 * FUNCTION: fetchMorphology
 * --------------------------------------------------------------------------
 * Connect to Morpheus API via perseids
 * returns a list of objects containing each instance of the given words potential morphology
 * --------------------------------------------------------------------------
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
    console.error("Failed to parse JSON:", err, rawText);
    return [];
  }

  const entry = json?.RDF?.Annotation?.Body?.rest?.entry;
  if (!entry) {
    console.warn("No morphological data found for:", word);
    return [];
  }

  // Convert to array if not already
  const entries = Array.isArray(entry) ? entry : [entry];

  //Ensure iterating through values correctly
  const val = (obj, path) =>
    path.reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);

  const results = [];

  entries.forEach(e => {
    const dict = e.dict || {};
    const inflList = Array.isArray(e.infl) ? e.infl : [e.infl];

    inflList.forEach(infl => {
      if (!infl) return;
      results.push({
        lemma: val(dict, ["hdwd", "$"]) || word,
        order: val(dict, ["order", "$"]),
        num: val(infl, ["num", "$"]),
        tense: val(infl, ["tense", "$"]),
        mood: val(infl, ["mood", "$"]),
        voice: val(infl, ["voice", "$"]),
        gender: val(dict, ["gend", "$"]) || val(infl, ["gend", "$"]),
        case: val(infl, ["case", "$"]),
      });
    });
  });

  // DEV: inspect what Morpheus is actually returning
  if (window.morphDebug) {
    console.log('[Morph] flattened results for', word, results);
  }
  return results;
}

if (typeof window !== "undefined") {
  window.fetchMorphology = fetchMorphology;
}