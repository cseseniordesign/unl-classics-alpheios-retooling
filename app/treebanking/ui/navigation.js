import { createTable } from "../table/tableRender.js";

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
  const select = document.getElementById('sentence-select');
  if (!select) return;

  // Clear existing dropdown options
  select.innerHTML = '';

  const data = window.treebankData;
  if (!data || !data.length) return;

  // Populate new options from available sentences
  data.forEach(sentence => {
    const opt = document.createElement('option');
    opt.value = sentence.id;
    opt.textContent = `${sentence.id}`;
    select.appendChild(opt);
  });

  // Default to currently displayed sentence
  select.value = window.currentIndex || 1;

  // On selection change, show the chosen sentence
  select.addEventListener('change', (e) => {
    const selectedId = parseInt(e.target.value);
    displaySentence(selectedId);
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