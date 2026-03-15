import { showToast } from '../../../main.js'
import { getActiveTagset, setActiveTagset } from '../tags/tagsetStore.js';
import { initTagsetSelector } from '../tags/tagsetSelector.js';
import { isValidLLTResponse } from '../xml/tokenizer.js';
import { getRegistryEntry } from '../tags/tagsetRegistry.js';

let userPickedTagset = false;

// Attach click event after input page loads for the edit button
document.getElementById("editBtn").addEventListener("click", sendSentence);

// Toggles advanced options section
document.getElementById("toggleAdvanced").addEventListener("click", () => {
  document.getElementById("advancedOptions").classList.toggle("open")
});

// Loads previously saved tokenizer (if any)
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("tokenizer-URL");
  if (saved) {
    document.getElementById("tokenizer-URL").value = saved;
  }
});

// Save and Reset buttons
document.getElementById("saveTokenizer").addEventListener("click", handleSave);
document.getElementById("resetTokenizer").addEventListener("click", handleReset);

/**
 * --------------------------------------------------------------------------
 * FUNCTION: sendSentence
 * --------------------------------------------------------------------------
 * Sends input sentence to the treebanking page.
 * Validates that text, language, direction, AND annotation format are set.
 */
function sendSentence() {
  const input = document.getElementById("input-text").value.trim();

  if (!input) {
    showToast("Please input a sentence.");
    return;
  }

  const direction = document.querySelector('input[name="direction"]:checked');
  const language  = document.querySelector('input[name="lang"]:checked');

  if (language == null) {
    showToast("Please select a sentence language.");
    return;
  }
  if (direction == null) {
    showToast("Please select a sentence direction.");
    return;
  }

  // If user didn't explicitly pick a tagset this run, don't reuse an old one
  if (!userPickedTagset) {
    localStorage.removeItem("activeTagsetId");
    setActiveTagset(null);
  }

  // Validate that an annotation format has been loaded
  var tagset = getActiveTagset();
  if (!tagset) {
    if(language.value === "grc") {
      tagset = getRegistryEntry("aldt-grc"); // default to ALDT-GRC for Greek if no selection
    }else if(language.value === "lat") {
      tagset = getRegistryEntry("aldt-lat"); // default to ALDT-LAT for Latin if no selection
    } else {
      showToast("Please select an annotation format.");
      return;
    }
  }

  localStorage.setItem("textDirection", direction.value);
  localStorage.setItem("textLanguage", language.value);

  // Persist the tagset id so treebanking.html can reload it if needed
  localStorage.setItem("activeTagsetId", tagset.id);

  // Save default and/or user tokenization parameters
  saveTokenizerParams();

  // Store user input
  window.sessionStorage.setItem("userInput", input);

  // Redirect to treebanking page
  window.location.href = "treebanking.html";

}

  initTagsetSelector({
    containerId: 'tagset-selector-root',
    onLoaded: (config) => {
      userPickedTagset = !!config?.id;
      // The config is now in tagsetStore — treebanking.html will read it on load.
      // Optionally auto-set the language radio to match the tagset's language.
      const langMap = { grc: 'lang-grc', lat: 'lang-lat', eng: 'lang-eng', per: 'lang-per' };
      const radioId = langMap[config.lang];
      if (radioId) {
        const radio = document.getElementById(radioId);
        if (radio) radio.checked = true;
      }
    }
  });
  
/**
 * --------------------------------------------------------------------------
 * FUNCTION: handleSave
 * --------------------------------------------------------------------------
 * Handles save button, validates service, and saves URL if valid
 */
async function handleSave() {
  const url = document.getElementById("tokenizer-URL").value.trim();
  
  if (!url) {
    showToast("Please enter a URL.");
    return;
  }

  try {
    await validateTokenizer(url);
    localStorage.setItem("tokenizer-URL", url);
    showToast("Tokenizer service saved sucessfully.");
  } catch (err) {
    showToast("Invalid Tokenizer Service: " + err.message);
  }
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: handleReset
 * --------------------------------------------------------------------------
 * Handles reset button click, clears storage, and clears input
 */
function handleReset() {
  localStorage.removeItem("tokenizer-URL");
  document.getElementById("tokenizer-URL").value = "";
  showToast("Tokenizer Service Reset to Default");
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: validateTokenizer
 * --------------------------------------------------------------------------
 * Validates tokenizer service
 * 
 * @returns {boolean} - True if valid tokenizer
 */
async function validateTokenizer(url) {
  const testResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "text=test",
  });

  if (!testResponse.ok) {
    throw new Error("Service returned " + testResponse.status);
  }

  const xmlText = await testResponse.text();

  if (!isValidLLTResponse(xmlText)) {
    throw new Error("Response is not LLT-compatible XML.");
  }

  return true;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: saveTokenizerParams
 * --------------------------------------------------------------------------
 * Saves default and/or user tokenization parameters 
 */
 function saveTokenizerParams() {
  const split = document.getElementById("split-enclitics").checked;
  const shift = document.getElementById("shift-enclitics").checked;

  const params = {
    splitting: split,
    shifting: shift,
  };

  sessionStorage.setItem("tokenizerParams", JSON.stringify((params)));
}
