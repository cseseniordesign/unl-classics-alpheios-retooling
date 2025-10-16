/**
 * Parses a full Treebank XML containing multiple <sentence> elements.
 * Returns a structured array of sentence objects, each with its own words.
 *
 * @param {string} xmlString - The XML file contents as a string
 * @returns {Array<Object>} - Array of parsed sentences { id, words: [...] }
 */
export default function parseTreeBankXML(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");

  // Select *all* <sentence> elements
  const sentences = Array.from(xmlDoc.querySelectorAll("sentence"));
  if (!sentences.length) {
    console.error("No <sentence> elements found in XML.");
    return [];
  }

  // Helper: parse attributes (reuses your alias logic)
  const parseWordAttributes = wordEl => {
    const wordObj = {};

    for (const attr of wordEl.attributes) {
      wordObj[attr.name] = attr.value;

      if (attr.name.startsWith("alph:")) {
        const alias = attr.name.split(":")[1];
        wordObj[alias] = attr.value;
      }

      if (attr.name.startsWith("sgdt:")) {
        const alias = "sgdt_" + attr.name.split(":")[1];
        wordObj[alias] = attr.value;
      }
    }

    wordObj.word = wordEl.getAttribute("form") || "";
    wordObj.head = wordEl.getAttribute("head") || "";
    wordObj.lemma = wordEl.getAttribute("lemma") || "";
    wordObj.postag = wordEl.getAttribute("postag") || "";
    wordObj.relation = wordEl.getAttribute("relation") || "";

    const text = wordEl.textContent.trim();
    if (text) {
      wordObj.textContent = text;
    }

    return wordObj;
  });

  /**
   * wordNodes param is the array of words from an XML file
   * with all of the data that is attatched to their object.
   * @param {*} wordNodes 
   */
  function createNodeHierarchy (wordNodes) {
    const idParentPairs = wordNodes.map(d => ({
    id: d.id,
    parentId: d.head === "0" ? null : d.head
    }));
    const root = d3.stratify()
      .id((d) => d.id)
      .parentId((d) => d.head)
     (idParentPairs);

     return root;
  }

  // Debug output – displays the parsed data in a table format in console
  console.table(wordObjects, ["id","form", "lemma", "relation", "postag", "head"]);
  const root = createNodeHierarchy(wordObjects);
  return wordObjects;


}
