import { createNodeHierarchy } from '../tree/treeRender.js';
import { initializeKeyboard, chooseKeyboard } from '../xml/selector.js';
import { triggerAutoSave } from '../xml/saveXML.js';
import { displaySentence } from '../ui/sentenceDisplay.js';
 
window.atInsertionBefore = true;
let insertionLetter = 'a'; // next available letter suffix
 
 
/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupaT
 * --------------------------------------------------------------------------
 * Enables the "Artificial Token" tab on the right-hand toolbar.
 * --------------------------------------------------------------------------
 */
 
export function setupaT() {
  const artificialTokenBtn = document.getElementById("aT");
  if (!artificialTokenBtn) return;
  artificialTokenBtn.onmouseover = null;
  // Open/toggle ONLY on click
  artificialTokenBtn.addEventListener("click", handleArtificialTokenClick);
}

function handleArtificialTokenClick() {
  window.atInsertionBefore = true;

  const artificialTokenBtn = document.getElementById("aT");
  const wasActive = artificialTokenBtn.classList.contains("active");
  const toolBody = document.getElementById("tool-body");
 
  window.closeArtificialToken = function () {    
    artificialTokenBtn.classList.remove("active");
    artificialTokenBtn.style.backgroundColor = '#4e6476';
    if (window.treebankModeHTML) {
      toolBody.innerHTML = window.treebankModeHTML;
    } else {
      toolBody.innerHTML = '<p>Treebanking mode: click a word or node to edit dependencies.</p>';
    }
  };
 
  if (wasActive) {
    window.closeArtificialToken();
    return;
  }
 
  // Clear other buttons
  const allButtons = document.querySelectorAll("#toolbar button");
  allButtons.forEach(btn => {
    btn.classList.remove("active");
    btn.style.backgroundColor = '#4e6476';
  });
 
  artificialTokenBtn.classList.add("active");
  artificialTokenBtn.style.backgroundColor = 'green';
  insertionLetter = 'a';
 
  // Inject the subscreen HTML
  toolBody.innerHTML = `
    <style>
      .at-panel { padding: 4px 0; }
 
      .at-top-buttons {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-bottom: 14px;
      }
 
      .at-btn {
        padding: 7px 24px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        background: #4e6476;
        color: #fff;
        transition: background 0.15s;
      }
      .at-btn:hover { background: #4e6476; }
      .at-btn.active { background: #4e6476; }
 
      .at-field-label {
        display: block;
        text-align: center;
        margin-bottom: 5px;
        font-size: 13.5px;
        color: #333;
      }
 
      .at-text-input, .at-select {
        width: 100%;
        padding: 6px 8px;
        border: 1px solid #b0b8c1;
        border-radius: 3px;
        background: #fff;
        font-size: 14px;
        color: #333;
        margin-bottom: 12px;
        outline: none;
        box-sizing: border-box;
      }
      .at-text-input:focus, .at-select:focus { border-color: #4e6476; }
 
      .at-insertion-label {
        text-align: center;
        font-size: 13.5px;
        color: #333;
        margin-bottom: 6px;
      }
 
      .at-insertion-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 16px;
      }
 
      .at-insertion-text {
        flex: 1;
        padding: 6px 8px;
        border: 1px solid #b0b8c1;
        border-radius: 3px;
        background: #fff;
        font-size: 13.5px;
        color: #333;
      }
 
      .at-icon-btn {
        width: 36px;
        height: 34px;
        background: #4e6476;
        border: none;
        border-radius: 3px;
        color: white;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.15s;
      }
      .at-icon-btn:hover { background: #4e6476; }
 
      .at-add-btn-wrapper { display: flex; justify-content: center; }
 
      .at-add-btn {
        padding: 8px 28px;
        background: #4e6476;
        color: #fff;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
      }
      .at-add-btn:hover { background: #4e6476; }
 
      .token-input {
        width: 100%;
        padding: 10px 8px;
        border: 1px solid #b0b8c1;
        border-radius: 3px;
        background: #fff;
        font-size: 16px;
        color: #333;
        margin-bottom: 12px;
        outline: none;
        box-sizing: border-box;
      }
      .token-input:focus { border-color: #4e6476; }
 
    </style>
 
    <div class="at-panel">
 
      <div class="at-top-buttons">
        <button class="at-btn active" id="at-create-btn">Create</button>
        <button class="at-btn" id="at-list-btn">List</button>
      </div>
 
      <label class="at-field-label" for="at-visual-rep">
        Visual representation of new token (optional)
      </label>
 
      <input class="token-input" type="text">
      <div class="simple-keyboard"></div>
 
      <select class="at-select" id="at-token-type">
        <option value="elliptic">elliptic</option>
      </select>
 
      <p class="at-insertion-label">Insertion Point</p>
      <div class="at-insertion-row">
        <div class="at-insertion-text" id="at-insertion-display">
          Please select a word
        </div>
        <button class="at-icon-btn" id="select-word" title="Select Word">◈</button>
    
        <button class="at-icon-btn" id="place-infront" title="Toggle insertion side">←</button>
      </div>
 
      <div class="at-add-btn-wrapper">
        <button class="at-add-btn" id="at-add-token-btn">Add token</button>
      </div>
 
    </div>
  `;
 
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const keyboardDiv = document.querySelector('.simple-keyboard');
      if (keyboardDiv) initializeKeyboard();
    });
  });
 
  // Create / List toggle
  const createBtn = toolBody.querySelector("#at-create-btn");
  const listBtn   = toolBody.querySelector("#at-list-btn");
 
  // Auto Toggle to Create view on open
  createBtn.style.backgroundColor = 'green'
  listBtn.style.backgroundColor = '#4e6476';
 
  function showCreateView() {
    createBtn.style.backgroundColor = 'green';
    listBtn.style.backgroundColor = '#4e6476';
    createBtn.classList.add("active");
    listBtn.classList.remove("active");
    // restore your original panel content here
  }
 
  function showListView() {
    listBtn.style.backgroundColor = 'green';
    createBtn.style.backgroundColor = '#4e6476';
    listBtn.classList.add("active");
    createBtn.classList.remove("active");
    // blank for now
  }
 
  createBtn.addEventListener("click", showCreateView);
  listBtn.addEventListener("click", showListView);
 
  createBtn.click();
 
 
  // Select word for anchoring new token
  const selectWordBtn = toolBody.querySelector("#select-word");
  selectWordBtn.addEventListener("click", () => {
    window.atSelectingAnchor = true;
    selectWordBtn.style.backgroundColor = 'green';
  });
 
 
  // Place in front of / behind selected word
  // Default: atInsertionBefore = false → arrow points LEFT (← = in front of word)
  // Toggled: atInsertionBefore = true  → arrow points RIGHT (→ = behind word)
  const placeInfrontBtn = toolBody.querySelector("#place-infront");
  placeInfrontBtn.addEventListener("click", () => {
    window.atInsertionBefore = !window.atInsertionBefore;
 
    // ← = insert in front of the word (default, not-before in array terms)
    // → = insert behind the word
    placeInfrontBtn.textContent = window.atInsertionBefore ? '→' : '←';
    placeInfrontBtn.style.backgroundColor = window.atInsertionBefore ? 'green' : '#4e6476';
 
    const anchor = getAnchorWord();
    const insertionDisplay = document.querySelector("#at-insertion-display");
    if (insertionDisplay && anchor) {
      const position = window.atInsertionBefore ? 'behind' : 'in front of';
      insertionDisplay.textContent = `${position} [${anchor.form}]`;
    }
  });
 
  function getAnchorWord() {
    const sentence = window.treebankData?.find(s => s.id === String(window.currentIndex));
    return sentence?.words.find(w => String(w.id) === String(window.atSelectedWordId));
  }
 
 
  // Add token button
  const addTokenBtn = toolBody.querySelector("#at-add-token-btn");
  addTokenBtn.addEventListener("click", () => {
    const anchor = getAnchorWord();
    if (!anchor) {
      alert("No anchor word selected.");
      return;
    }
 
    const visualRep = toolBody.querySelector(".token-input").value;
    const tokenType = toolBody.querySelector("#at-token-type").value;
    const anchorId  = String(anchor.id).padStart(4, '0');
 
    const insertion_id = getNextInsertionId(anchorId, getCurrentArtificialTokens());
 
    const newToken = {
      id: getNextWordId(),
      form: visualRep || `[${getATCount()}]`,
      insertion_id,
      artificial: tokenType,
      relation: "",
      head: ""
    };
 
    insertTokenIntoSentence(newToken);
 
  });
 
  function getNextInsertionId(anchorPrefix, existingTokens) {
  const taken = existingTokens
    .filter(t => t.insertion_id?.startsWith(anchorPrefix))
    .map(t => t.insertion_id.slice(-1));
  return anchorPrefix + 'abcdefghijklmnopqrstuvwxyz'
    .split('')
    .find(l => !taken.includes(l));
  }
 
  function getCurrentArtificialTokens() {
    const sentence = window.treebankData
      ?.find(s => s.id === String(window.currentIndex));
    return sentence?.words.filter(w => w.artificial) || [];
  }
 
  function getNextWordId() {
    const sentence = window.treebankData
      ?.find(s => s.id === String(window.currentIndex));
    return String((sentence?.words.length || 0) + 1);
  }
 
  function getATCount() {
    return getCurrentArtificialTokens().length;
  }
 
  function insertTokenIntoSentence(newToken) {
    const sentence = window.treebankData?.find(s => s.id === String(window.currentIndex));
    if (!sentence) return;
 
    const anchorIndex = sentence.words.findIndex(w => String(w.id) === String(window.atSelectedWordId));
    if (anchorIndex === -1) return;
 
    const spliceIndex = window.atInsertionBefore ? anchorIndex : anchorIndex + 1;
    sentence.words.splice(spliceIndex, 0, newToken);
 
    createNodeHierarchy(window.currentIndex);
    displaySentence(window.currentIndex);
    triggerAutoSave();
  }
}