/**
 * This function handles parsing of the XML file
 * It takes in xmlString from an XML file and parses the text
 * 
 * It dynamically includes all fields, keeps punctuation, automatically
 * creates aliases for namespaced attributes
 * (e.g. "alph:pofs" -> "pofs") for easier access in dot form.
 * 
 * @param {string} xmlString - The XML file contents as a string
 * @returns {Array<Object>} - An array of word objects with all attributes preserved
 */
export default function parseTreeBankXML(xmlString) {
  const parser = new DOMParser();

  // Parses an XML file's text and returns a document
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");

  // Selects first <sentence> element
  const sentence = xmlDoc.querySelector("sentence");
  if (!sentence) {
    console.error("No <sentence> found in XML.");
    return [];
  }

  // Select all <word> elements from the sentence
  const wordElements = Array.from(sentence.querySelectorAll("word"));

  // Convert each <word> into a JS object with its attributes
  const wordObjects = wordElements.map(wordEl => {
    const wordObj = {};

    // Copy every attribute (preserves all data, even if XML adds more fields)
    for (const attr of wordEl.attributes) {
      wordObj[attr.name] = attr.value;
      
      // Create short aliases for easier dot-style access
      // Example: alph:pofs -> word.pofs = "noun"
      if (attr.name.startsWith("alph:")) {
        const alias = attr.name.split(":")[1];
        wordObj[alias] = attr.value;
      }

      // For any sgdt:* fields, prefix them to avoid collisions (sgdt_case, etc.)
      if (attr.name.startsWith("sgdt:")) {
        const alias = "sgdt_" + attr.name.split(":")[1];
        wordObj[alias] = attr.value;
      }
    }

    // Also include key standard fields explicitly for clarity
    wordObj.word = wordEl.getAttribute("form") || "";
    wordObj.head = wordEl.getAttribute("head") || "";
    wordObj.lemma = wordEl.getAttribute("lemma") || "";
    wordObj.postag = wordEl.getAttribute("postag") || "";
    wordObj.relation = wordEl.getAttribute("relation") || "";

    // Preserve text content (for cases with punctuation or inner text)
    const text = wordEl.textContent.trim();
    if (text) {
      wordObj.textContent = text;
    }

    return wordObj;
  });

  // Debug output – displays the parsed data in a table format in console
  console.table(wordObjects, ["id","form", "lemma", "relation", "postag", "head"]);

  return wordObjects;
}