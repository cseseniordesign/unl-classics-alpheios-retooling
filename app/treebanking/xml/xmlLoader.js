import parseTreeBankXML from './parser.js';
import { validateXML } from "../libs/xmllint/index-browser.mjs"; 


function captureTreebankMeta(xmlDoc) {
  const root = xmlDoc?.documentElement;
  if (!root || root.nodeName !== "treebank") return;

  const meta = {
    version: root.getAttribute("version") || null,
    format: root.getAttribute("format") || null,
    xmlLang: (root.getAttribute("xml:lang") || root.getAttribute("lang") || "").toLowerCase() || null,
    direction: root.getAttribute("direction") || null,
    xmlnsSaxon: root.getAttribute("xmlns:saxon") || null,
  };
  window.treebankMeta = meta;
  localStorage.setItem("treebankMeta", JSON.stringify(meta));
}


/**
 * Checks the XML for the xml:lang attribute and validates the code.
 * @param {Document} xmlDoc - The parsed XML DOM document
 * @returns {true|null} - True, or null if invalid
 */
async function validateLanguage(xmlDoc) {
    const root = xmlDoc.documentElement;
    
    // Check for xml:lang (standard) or lang (fallback)
    const lang = root.getAttribute("xml:lang") || root.getAttribute("lang");

    if (!lang) {
        alert("Validation Error: Missing 'xml:lang' attribute in <treebank>.");
        return null;
    }
    const ok = await isRealISOLanguage(lang.toLowerCase());
    if (!ok) {
        alert(`Validation Error: '${lang}' Unsupported language code in XML. Please use valid code eg.('grc','lat'). `);
        return null;
    }
    //set the window language to the lang attribute if its valid
    window.treeBankLang = lang;
    return true;
}

/**
 * checks to see if the code is in the valid languages json
 */
async function isRealISOLanguage(code) {
    try {
        const response = await fetch("../../../assets/languages.json")
        const languageCodes = await response.json();
        return languageCodes.some(langObj => langObj.Id.toLowerCase() === code.toLowerCase());
    } catch (error) {
       console.error("Could not load language database:", error);
    }
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: validate
 * --------------------------------------------------------------------------
 * Validates XML content against the provided XSD schema.
 */
async function validate(xmlContent) {
  const schema = await fetch("/app/treebanking/schemas/treebank-1.7.xsd").then(r => r.text());
  const result = await validateXML({
    xml: xmlContent,
    schema
  });

  if (result.errors && result.errors.length > 0) {
    console.error("Validation errors:", result.errors);
    return false;
  }
  return true;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: handleFileUpload
 * --------------------------------------------------------------------------
 * Handles file upload, validates XML against schema, then loads treebank data.
 */
export function handleFileUpload() {

  localStorage.removeItem("xmlContent");
  localStorage.removeItem("treebankData");

  const fileInput = document.getElementById("file");
  const file = fileInput.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".xml")) {
    alert("Please upload an XML file.");
    fileInput.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = async function (event) {
    const xmlInput = event.target.result;

    // Validate XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlInput, "text/xml");
    const langCode = await validateLanguage(xmlDoc);
    captureTreebankMeta(xmlDoc);

    if (!langCode) {
        fileInput.value = "";
        return;
    }

    const isValid = await validate(xmlInput);
    if (!isValid) {
      alert("File not valid.");
      fileInput.value = "";
      return;
    }

    // If valid, parse and open treebank window and capture meta
    captureTreebankMeta(xmlDoc);   
    loadTreebankData(xmlInput);

    const stored = JSON.parse(localStorage.getItem("treebankData"));

    fileInput.value = "";

    window.location.href = "./treebanking.html";
  };

  reader.readAsText(file, "UTF-8");
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: loadTreebankData
 * --------------------------------------------------------------------------
 * Loads and parses the Treebank XML file.
 */
export async function loadTreebankData(xmlContent) {
  if (!xmlContent) {
    if (window.treebankData) return window.treebankData;
    try {
      const response = await fetch('../../../assets/treebank.xml');
      const xmlText = await response.text();
      const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
      captureTreebankMeta(xmlDoc);
      window.treebankData = parseTreeBankXML(xmlText);
      return window.treebankData;
    } catch (err) {
      console.error('Error loading XML:', err);
      return [];
    }
  } else {
    try {
      localStorage.setItem("xmlContent", xmlContent);
      const parsed = parseTreeBankXML(xmlContent);
      localStorage.setItem("treebankData", JSON.stringify(parsed));
      window.treebankData = parsed;
      return window.treebankData;
    } catch (err) {
      console.error('Error parsing uploaded XML:', err);
      return [];
    }
  }
}

// Expose globally for inline HTML calls
window.handleFileUpload = handleFileUpload;
