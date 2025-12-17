import { handleWordClick } from './sentenceDisplay.js';


export function setupEscapeHotkey() {
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
    true 
  );
}

/**
 * Setup W hotkey: move selection forward (next word).
 * Works in treebanking, morph, and relation; does nothing in XML.
 */
export function setupWHotkey() {
  if (window._treebankWReady) return;
  window._treebankWReady = true;

  window.addEventListener(
    'keydown',
    (e) => {
      const key = e.key;
      if (key !== 'w' && key !== 'W') return;

      // Don't interfere with Cmd/Ctrl/Alt shortcuts (e.g., Cmd+W)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // If a modal is open, hotkeys do nothing
      const overlay = document.getElementById('app-modal-overlay');
      if (overlay && !overlay.hidden) {
        return;
      }

      // Ignore when typing in inputs / textareas / selects / contentEditable
      const target = e.target;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      // Do not move selection while XML tab is active
      const xmlBtn = document.getElementById('xml');
      if (xmlBtn && xmlBtn.classList.contains('active')) {
        return;
      }

      handleWordStep(+1, e); // forward
    },
    true
  );
}

/**
 * Setup E hotkey: move selection backward (previous word).
 * Works in treebanking, morph, and relation; does nothing in XML.
 */
export function setupEHotkey() {
  if (window._treebankEReady) return;
  window._treebankEReady = true;

  window.addEventListener(
    'keydown',
    (e) => {
      const key = e.key;
      if (key !== 'e' && key !== 'E') return;

      // Don't interfere with Cmd/Ctrl/Alt shortcuts
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // If a modal is open, hotkeys do nothing
      const overlay = document.getElementById('app-modal-overlay');
      if (overlay && !overlay.hidden) {
        return;
      }

      // Ignore when typing in inputs / textareas / selects / contentEditable
      const target = e.target;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      // Do not move selection while XML tab is active
      const xmlBtn = document.getElementById('xml');
      if (xmlBtn && xmlBtn.classList.contains('active')) {
        return;
      }

      handleWordStep(-1, e); // backward
    },
    true
  );
}

/**
 * Shared helper: move selection forward/backward through words.
 * direction = +1 → forward (W)
 * direction = -1 → backward (E)
 *
 * Semantics (matching what you described for original Arethusa):
 *  - W: no selection → first word; otherwise → next word (if not at last).
 *  - E: no selection → last word; otherwise → previous word (if not at first).
 */
function handleWordStep(direction, e) {
  const data = window.treebankData;
  const currentIndex = window.currentIndex;

  if (!Array.isArray(data) || !currentIndex) return;

  const sentence = data.find(
    (s) => String(s.id) === String(currentIndex)
  );
  if (!sentence || !Array.isArray(sentence.words) || sentence.words.length === 0) {
    return;
  }

  const words = sentence.words;

  // Figure out what is currently selected
  let currentId = window.currentSelectedWordId;

  if (!currentId) {
    const selToken = document.querySelector('.token.selected');
    if (selToken) {
      currentId = selToken.dataset.wordId;
    } else {
      const selNode = document.querySelector('.node.selected');
      if (selNode) currentId = selNode.getAttribute('id');
    }
  }

  let idx = -1;
  if (currentId != null) {
    idx = words.findIndex(
      (w) => String(w.id) === String(currentId)
    );
  }

  let newIdx = idx;

  if (direction > 0) {
    // W: forward
    if (idx === -1) {
      newIdx = 0;                       // no selection → first word
    } else if (idx < words.length - 1) {
      newIdx = idx + 1;                 // otherwise → next
    } else {
      // move forward and WRAP at the end
      newIdx = (idx + 1) % words.length;                
    }
  } else {
    // E: backward
    if (idx === -1) {
        newIdx = words.length - 1;        // no selection → last word
    } else if (idx > 0) {
        newIdx = idx - 1;                 // otherwise → previous
    } else {
        // move backward and WRAP at the beginning
        newIdx = (idx - 1 + words.length) % words.length;
    }
  }

  const targetWord = words[newIdx];
  if (!targetWord) return;

  // Clear old selection so this behaves like a fresh click on that word
  if (typeof window.resetSelection === 'function') {
    window.resetSelection();
  }

  try {
    // Call the same handler as a normal click.
    // Your current code calls handleWordClick(word.id, word.form),
    // so we mirror that to avoid changing existing behavior.
    handleWordClick(targetWord.id, targetWord.form);
  } catch (err) {
    console.error('Keyboard word navigation failed:', err);
  }

  e.preventDefault();
  e.stopPropagation();
}