import { showToast } from '/main.js'
import { getActiveTagset } from '/app/treebanking/tags/tagsetStore.js';
import { initTagsetSelector } from '/app/treebanking/tags/tagsetSelector.js';

// Attach click event after input page loads for the edit button
document.getElementById("editBtn").addEventListener("click", sendSentence);

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

  // Validate that an annotation format has been loaded
  const tagset = getActiveTagset();
  if (!tagset) {
    showToast("Please select an annotation format.");
    return;
  }

  localStorage.setItem("textDirection", direction.value);
  localStorage.setItem("textLanguage", language.value);

  // Persist the tagset id so treebanking.html can reload it if needed
  localStorage.setItem("activeTagsetId", tagset.id);

  // Store user input
  window.sessionStorage.setItem("userInput", input);

  // Redirect to treebanking page
  window.location.href = "treebanking.html";

}

  initTagsetSelector({
    containerId: 'tagset-selector-root',
    onLoaded: (config) => {
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
