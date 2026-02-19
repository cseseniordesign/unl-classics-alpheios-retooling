import parseTreeBankXML from "./parser.js";
import { getLanguage } from "../input/language.js";

/**
 * --------------------------------------------------------------------------
 * FUNCTION: tokenizer
 * --------------------------------------------------------------------------
 * Connects to Perseids LLT services (outputs segmented and tokenized XML), 
 * parses user input into a normalized XML and returns an array object of 
 * parsed sentences
 * 
 * @param {string} input - user input sentence
 * @returns {Array<Object>} - parsed sentences
 */
export async function tokenizer(input) {
  const encoded = encodeURIComponent(input);

  const response = await fetch(
    `https://services.perseids.org/llt/segtok`,
    {
      method: "POST",
      headers: {
        "Content-Type" : "application/x-www-form-urlencoded",
      },
      body: "text=" + encoded,
    }
  );

  if (!response.ok) {
    throw new Error("LLT service failed: " + response.status);
  }

  const xmlText = await response.text(); // outputs XML (different structure than internal model)

  // normalize XML and parse into array object
  const newXML = normalizeXML(xmlText);
  const parsedSentences = parseTreeBankXML(newXML);

  parsedSentences.forEach(sentence => {
    sentence.words.forEach(word => {
      const punctuationMarks = [",", ".", "·", ";", ":"];
      if (punctuationMarks.includes(word.form)) {
        word.head = 0;
        word.relation = "AuxX";
      }
    });
  });

  return parsedSentences;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: normalizeXML
 * --------------------------------------------------------------------------
 * Parses xml string from LLT services and builds newly structured XML with 
 * morphology attributes
 * 
 * @param {string} xmlString - XML string from LLT services
 * @returns {string} - normalized XML string for treebanking
 */
function normalizeXML(xmlString) {
  const parser = new DOMParser();
  const source = parser.parseFromString(xmlString, 'text/xml');
  
  // create new XML document
  const xmlDoc = document.implementation.createDocument("", "", null);
 
  const root = xmlDoc.createElement("treebank");
  xmlDoc.appendChild(root);
  
  root.setAttribute("xml:lang", getLanguage());
  root.setAttribute("direction", localStorage.getItem("textDirection") || "");

  const sentences = source.getElementsByTagName("s");

  // add sentence elements
  Array.from(sentences).forEach((sentenceNode) => {
    const sentenceId = sentenceNode.getAttribute("n");

    const sentenceEl = xmlDoc.createElement("sentence");
    sentenceEl.setAttribute("id", sentenceId);
    sentenceEl.setAttribute("document_id", "");
    sentenceEl.setAttribute("subdoc", "");
    sentenceEl.setAttribute("span", "");

    // add token elements
    let tokenIndex = 1;

    Array.from(sentenceNode.children).forEach((token) => {
      const form = token.textContent;

      const tokenEl = xmlDoc.createElement("word");
      tokenEl.setAttribute("id", tokenIndex.toString());
      tokenEl.setAttribute("form", form);
      
      // add morphology attributes to append later
      tokenEl.setAttribute("lemma", "");
      tokenEl.setAttribute("postag", "");
      tokenEl.setAttribute("relation", "");
      tokenEl.setAttribute("head", "");

      sentenceEl.appendChild(tokenEl);

      tokenIndex++;
    });

    root.appendChild(sentenceEl);
  });

  const newXML = new XMLSerializer().serializeToString(xmlDoc);
  
  return newXML;
}