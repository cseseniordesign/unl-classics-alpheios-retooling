import { clearStacks } from "../xml/undo.js";
import { displaySentence, safeDisplaySentence } from '../ui/sentenceDisplay.js';
import { setupEHotkey, setupEscapeHotkey, setupSaveHotkey, setupTabHotkeys, setupUndoRedoHotkeys, setupWHotkey, } from '../ui/hotKeys.js';
/**
 * --------------------------------------------------------------------------
 * FUNCTION: updateNavigationButtons
 * --------------------------------------------------------------------------
 * Enables or disables "first/back/next/last" buttons as needed.
 *
 * @param {number} index - Current active sentence index.
 * @returns {void} Runs synchronously to update navigation button states.
 */
export function updateNavigationButtons(index) {
  if (window.inSelection){
    const foundTokenList = document.querySelector(".found-tokens");
    //reset the found tokens
    const formInput = document.querySelector(".form-input");
    const tokenInput = document.querySelector(".token-input");
    tokenInput.value = "";
    formInput.value = "";
    foundTokenList.replaceChildren();
    //handleTokens();
    //handleForm();
  }
  document.getElementById('first').disabled = (index <= 1);
  document.getElementById('back').disabled  = (index <= 1);
  document.getElementById('next').disabled  = (index >= window.totalSentences);
  document.getElementById('last').disabled  = (index >= window.totalSentences);
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupSentenceSelector
 * --------------------------------------------------------------------------
 * Populates and manages the dropdown menu that lists all sentence IDs.
 *
 * @returns {void} Runs synchronously to populate and manage the sentence dropdown.
 */
export function setupSentenceSelector() {
  clearStacks();
  setupEscapeHotkey();
  setupWHotkey();
  setupEHotkey();
  setupTabHotkeys();
  setupUndoRedoHotkeys();
  setupSaveHotkey();

  document.getElementById('file-name').textContent = localStorage.getItem("uploadedFileName") || "";
  localStorage.removeItem("uploadedFileName");
  
  const select = document.getElementById('sentence-select');
  if (!select) return;

  select.innerHTML = '';

  const data = window.treebankData;
  if (!data || !data.length) return;

  data.forEach(sentence => {
    const opt = document.createElement('option');
    opt.value = sentence.id;

    const sentenceText = Array.isArray(sentence.words) ? 
    sentence.words.map(w => w.form).join(' ') : ' ';
    const preview = sentenceText.length <= 20 ? sentenceText : sentenceText.slice(0, 20) + '...';

    opt.textContent = `${sentence.id}: ${preview}`;
    select.appendChild(opt);
  });

  select.value = window.currentIndex || 1;

  // Listener
  select.addEventListener('change', async (e) => {
    const selectedId = parseInt(e.target.value, 10);
    const ok = safeDisplaySentence(selectedId);

    if (!ok) {
      // User hits "cancel"
      select.value = window.currentIndex;
    }
  });
}


/**
 * --------------------------------------------------------------------------
 * FUNCTION: updateSentenceSelector
 * --------------------------------------------------------------------------
 * Keeps dropdown visually synchronized with the displayed sentence.
 *
 * @param {number} index - Current active sentence index.
 * @returns {void} Runs synchronously to keep dropdown in sync with the displayed sentence.
 */
export function updateSentenceSelector(index) {
  const select = document.getElementById('sentence-select');
  if (select) select.value = index;
}

