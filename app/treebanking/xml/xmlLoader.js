import parseTreeBankXML from './parser.js';

/**
 * --------------------------------------------------------------------------
 * FUNCTION: handleFileUpload
 * --------------------------------------------------------------------------
 * Takes the xml file, reads it and stringifies it
 *
 * Calls loadTreeBankData to load and parse the treebank information
 * Changes the url to the treebanking webpage 
 * 
 */
export function handleFileUpload() {
    const fileInput = document.getElementById("file");
    const file = fileInput.files[0];

    if (!file) return;

    // Check it's XML
    if (!file.name.toLowerCase().endsWith(".xml")) {
        alert("Please upload an XML file.");
        fileInput.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
        const xmlContent = event.target.result; // <--- raw XML content as STRING
        // load the treebank data and open up treebanking webpage
        loadTreebankData(xmlContent);
        window.location.href = "./treebanking.html";
    };

    reader.onerror = function () {
        alert("Error reading file.");
    };

    reader.readAsText(file, 'UTF-8');
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: loadTreebankData
 * --------------------------------------------------------------------------
 * Loads and parses the Treebank XML file only once, then caches it globally.
 *
 * @returns {Promise<Array<Object>>} Resolves once XML is fetched and parsed into an array of sentence objects.
 *          Each sentence has { id, words: [...] }.
 */
export async function loadTreebankData(xmlContent) {
  if (!xmlContent) {
    if (window.treebankData) return window.treebankData;
    try {
      const response = await fetch('../../assets/treebank.xml');
      const xmlText = await response.text();
      window.treebankData = parseTreeBankXML(xmlText);
      return window.treebankData;
    } catch (err) {
      console.error('Error loading XML:', err);
      return [];
    }
  } else {
    try {
      // Use the raw XML string directly
      localStorage.setItem("xmlContent", xmlContent);
      const parsed = parseTreeBankXML(xmlContent);
      localStorage.setItem("treebankData", JSON.stringify(parsed));
      return window.treebankData;
    } catch (err) {
      console.error('Error parsing uploaded XML:', err);
      return [];
    }
  }
}

window.handleFileUpload = handleFileUpload;