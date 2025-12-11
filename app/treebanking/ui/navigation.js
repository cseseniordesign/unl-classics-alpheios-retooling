import { createTable } from "../table/tableRender.js";
import { clearStacks } from "../xml/undo.js";
import { displaySentence, safeDisplaySentence } from '../ui/sentenceDisplay.js';
import { recomputeDirty, getCurrentSentenceXML } from '../xml/xmlTool.js';

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
  clearStacks();
  setupEscapeHotkey();
  const select = document.getElementById('sentence-select');
  if (!select) return;

  select.innerHTML = '';

  const data = window.treebankData;
  if (!data || !data.length) return;

  data.forEach(sentence => {
    const opt = document.createElement('option');
    opt.value = sentence.id;
    opt.textContent = `${sentence.id}`;
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

// --------------------------------------------------------------------------
// Global Escape hotkey: exit tools back to treebanking mode
// --------------------------------------------------------------------------
function setupEscapeHotkey() {
  // Make sure we only install this once
  if (window._treebankEscapeReady) return;
  window._treebankEscapeReady = true;

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;

      // 1) If a modal is open, do NOTHING here.
      //    (modal.js will decide what to do)
      const overlay = document.getElementById('app-modal-overlay');
      if (overlay && !overlay.hidden) {
        return;
      }

      // 2) If a toolbar tab is active, ESC = "go back to treebanking mode"
      const active = document.querySelector('#toolbar button.active');
      if (
        active &&
        ['morph', 'relation', 'sentence-tools', 'xml'].includes(active.id)
      ) {
        active.click();          // uses existing button logic
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 3) Otherwise, ESC = "deselect current node/token" in treebanking mode
      if (typeof window.resetSelection === 'function') {
        const hasTokenSel = document.querySelector('.token.selected');
        const hasNodeSel  = document.querySelector('.node.selected');
        const hasId       = !!window.currentSelectedWordId;

        if (hasTokenSel || hasNodeSel || hasId) {
          window.resetSelection();
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    true // capture so it runs early, but we still check the modal first
  );
}