import parseTreeBankXML from './parser.js';

/**
 * --------------------------------------------------------------------------
 * FUNCTION: loadTreebankData
 * --------------------------------------------------------------------------
 * Loads and parses the Treebank XML file only once, then caches it globally.
 *
 * @returns {Promise<Array<Object>>} Resolves once XML is fetched and parsed into an array of sentence objects.
 *          Each sentence has { id, words: [...] }.
 */
export async function loadTreebankData() {
  // Use the cached dataset if already available
  if (window.treebankData) return window.treebankData;

  try {
    // Fetch the XML file and read it as plain text
    const response = await fetch('/unl-classics-alpheios-retooling/assets/treebank.xml'');
    const xmlText = await response.text();

    // Parse the XML into structured JS objects via parser.js
    window.treebankData = parseTreeBankXML(xmlText);
    return window.treebankData;
  } catch (err) {
    console.error('Error loading XML:', err);
    return [];
  }
}
