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
 * XML) or custom tokenizer with user parameters, parses user input into a 
 * normalized XML and returns an array object of parsed sentences
 * 
 * @param {string} input - user input sentence
 * @returns {Array<Object>} - parsed sentences
 */
export async function tokenizer(input) {
  // get default and/or user tokenization parameters
  let params = {
    splitting: false,
    shifting: false,
  };

  const stored = sessionStorage.getItem("tokenizerParams");
  if (stored) {
    try { params = JSON.parse(stored); } catch(_) {}
  }

  // If the user has configured a custom tokenizer URL, use it (remote path).
  // Otherwise use the built-in client-side tokenizer so there is no external
  // dependency and no CORS failure when running locally.
  const customURL = localStorage.getItem("tokenizer-URL");
  if (customURL) {
    return remoteTokenizer(input, customURL, params);
  }
  return clientTokenizer(input, params);
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: clientTokenizer
 * --------------------------------------------------------------------------
 * Fully client-side tokenizer — no network request required.
 * Splits input text into sentences then into word/punctuation tokens,
 * replicating the output structure of the LLT remote service.
 *
 * Sentence splitting: splits after sentence-ending punctuation marks
 *   (. ? ! · for Greek; treats ; as sentence boundary too).
 * Token splitting: splits on whitespace, then separates leading/trailing
 *   punctuation from word tokens so each punctuation mark is its own token.
 * Enclitic splitting (splitting=true): splits Greek enclitics on -τε, -τι,
 *   -νε, -θε at word boundaries (basic heuristic).
 *
 * @param {string} input - raw user text
 * @param {Object} params - { splitting: bool, shifting: bool }
 * @returns {Array<Object>} - parsed sentence objects matching parseTreeBankXML output
 */
function clientTokenizer(input, params) {
  const lang      = getLanguage();
  const direction = localStorage.getItem("textDirection") || "";
  const PUNCT     = [",", ".", "·", ";", ":", "?", "!", "...", "-", "(", ")", "`", "'", '"', "«", "»"];

  // ── 1. Split into sentences ─────────────────────────────────────────────
  // Sentence boundaries: . ? ! and Greek · (middle dot) and ; (Greek semicolon U+037E)
  // Keep the punctuation as its own token rather than discarding it.
  const sentenceEndRe = /([.?!·;])\s*/g;

  // Annotate end positions
  const rawSentences = [];
  let last = 0;
  let m;
  const workText = input.trim();

  // Split at sentence-ending punct, keeping the punct char
  const parts = workText.split(/(?<=[.?!·;])\s+/);

  // ── 2. Tokenize each sentence ───────────────────────────────────────────
  function tokenizeSentence(text) {
    // Split on whitespace first
    const roughTokens = text.trim().split(/\s+/).filter(Boolean);
    const tokens = [];

    roughTokens.forEach(raw => {
      // Peel leading punctuation
      let cur = raw;
      while (cur.length > 0 && PUNCT.includes(cur[0])) {
        tokens.push(cur[0]);
        cur = cur.slice(1);
      }
      // Peel trailing punctuation (accumulate, then push reversed)
      const trailingPunct = [];
      while (cur.length > 0 && PUNCT.includes(cur[cur.length - 1])) {
        trailingPunct.unshift(cur[cur.length - 1]);
        cur = cur.slice(0, -1);
      }
      if (cur.length > 0) {
        // Basic enclitic splitting for Greek if requested
        if (params.splitting && lang === "grc") {
          const encliticRe = /(τε|τι|νε|θε)$/;
          const match = cur.match(encliticRe);
          if (match && cur.length > match[0].length) {
            tokens.push(cur.slice(0, -match[0].length));
            tokens.push(match[0]);
          } else {
            tokens.push(cur);
          }
        } else {
          tokens.push(cur);
        }
      }
      trailingPunct.forEach(p => tokens.push(p));
    });

    return tokens;
  }

  // ── 3. Build the parsed sentences array ─────────────────────────────────
  // Match the shape that parseTreeBankXML would return.
  const parsedSentences = parts
    .map(part => part.trim())
    .filter(Boolean)
    .map((sentText, sIdx) => {
      const tokens = tokenizeSentence(sentText);
      const words = tokens.map((form, tIdx) => {
        const isPunct = PUNCT.includes(form);
        return {
          id:       String(tIdx + 1),
          form,
          word:     form,
          lemma:    "",
          postag:   "",
          relation: isPunct ? "AuxX" : "",
          head:     isPunct ? 0 : "",
        };
      });
      return { id: String(sIdx + 1), words };
    });

  return parsedSentences;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: remoteTokenizer
 * --------------------------------------------------------------------------
 * Calls a user-configured remote tokenizer service (LLT-compatible).
 * Only used when the user has set a custom tokenizer URL in Advanced Options.
 *
 * @param {string} input  - raw user text
 * @param {string} url    - tokenizer service URL
 * @param {Object} params - { splitting: bool, shifting: bool }
 * @returns {Array<Object>} - parsed sentence objects
 */
async function remoteTokenizer(input, url, params) {
  const encoded  = encodeURIComponent(input);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "text=" + encoded + "&splitting=" + params.splitting + "&shifting=" + params.shifting,
  });

  if (!response.ok) {
    throw new Error("Tokenizer Service Failed: " + response.status);
  }

  const xmlText = await response.text();

  if (!isValidLLTResponse(xmlText)) {
    throw new Error("Invalid LLT-compatible XML response from tokenizer.");
  }

  const newXML = normalizeXML(xmlText);
  const parsedSentences = parseTreeBankXML(newXML);

  parsedSentences.forEach(sentence => {
    sentence.words.forEach(word => {
      const punctuationMarks = [",", ".", "·", ";", ":", "?", "!", "...", "-", "(", ")", "`", "'", '"', "«", "»"];
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