import parseTreeBankXML from "./parser.js";
import { getLanguage } from "../input/language.js";

export const default_tokenizer = `https://services.perseids.org/llt/segtok`;

/**
 * --------------------------------------------------------------------------
 * FUNCTION: getTokenizer
 * --------------------------------------------------------------------------
 * Returns a user's custom tokenizer URL or defaults to the LLT services
 * 
 * @returns {string} - tokenizer URL
 */
export function getTokenizer() {
  return localStorage.getItem("tokenizer-URL") || default_tokenizer;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: isValidLLTResponse
 * --------------------------------------------------------------------------
 * Performs basic validation of whether the provided XML string conforms to 
 * the LLT schema by checking the presence of sentence and token elements
 * 
 * NOTE: This does not perform full schema validation
 * 
 * @param {string} - XML string response from tokenization service
 * @returns {boolean} - True if XML response appears structurally valid
 */
export function isValidLLTResponse(xmlString) {
  const parser = new DOMParser();
  const xmlText = parser.parseFromString(xmlString, "text/xml");

  const parserError = xmlText.getElementsByTagName("parsererror");
  if (parserError.length > 0) {
    return false;
  }

  const sentences = xmlText.getElementsByTagName("s");
  if (sentences.length === 0) {
    return false;
  }

  const tokens = xmlText.getElementsByTagName("w");
  if (tokens.length === 0) {
    return false;
  }

  return true;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: tokenizer
 * --------------------------------------------------------------------------
 * Connects to default Perseids LLT services (outputs segmented and tokenized 
 * XML) or custom tokenizer, parses user input into a normalized XML and 
 * returns an array object of parsed sentences
 * 
 * @param {string} input - user input sentence
 * @returns {Array<Object>} - parsed sentences
 */
export async function tokenizer(input) {
  const encoded = encodeURIComponent(input);

  const response = await fetch(getTokenizer(),
    {
      method: "POST",
      headers: {
        "Content-Type" : "application/x-www-form-urlencoded",
      },
      body: "text=" + encoded,
    }
  );

  if (!response.ok) {
    throw new Error("Tokenizer Service Failed: " + response.status);
  }

  const xmlText = await response.text(); // outputs XML (different structure than internal model)

  if (!isValidLLTResponse) {
    throw new error ("Invalid LLT-compatible XML.");
  }

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