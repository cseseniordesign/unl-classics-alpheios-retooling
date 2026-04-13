import { createNodeHierarchy } from '../tree/treeRender.js';
import { initializeKeyboard, chooseKeyboard } from '../xml/selector.js';
import { triggerAutoSave } from '../xml/saveXML.js';
import { displaySentence } from '../ui/sentenceDisplay.js';
import { showConfirmDialog } from '../ui/modal.js';
 
window.atInsertionBefore = false;
let insertionLetter = 'a';
 
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
  artificialTokenBtn.addEventListener("click", handleArtificialTokenClick);
}
 
function handleArtificialTokenClick() {
  window.atInsertionBefore = false;
 
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
 
  const allButtons = document.querySelectorAll("#toolbar button");
  allButtons.forEach(btn => {
    btn.classList.remove("active");
    btn.style.backgroundColor = '#4e6476';
  });
 
  artificialTokenBtn.classList.add("active");
  artificialTokenBtn.style.backgroundColor = 'green';
  insertionLetter = 'a';
 
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
 
      /* --- List view styles --- */
      .at-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
 
      .at-list-empty {
        text-align: center;
        font-size: 13px;
        color: #888;
        margin-top: 16px;
      }
 
      .at-list-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 8px;
        border-radius: 4px;
        cursor: pointer;
        border: 1px solid transparent;
        margin-bottom: 4px;
        transition: background 0.12s;
      }
      .at-list-item:hover {
        background: #e8edf1;
      }
      .at-list-item.at-list-selected {
        background: #d6e4f0;
        border-color: #4e6476;
      }
 
      .at-list-form {
        font-size: 15px;
        font-weight: 600;
        color: #222;
        flex: 1;
      }
 
      .at-list-type {
        font-size: 11px;
        color: #888;
        background: #eee;
        border-radius: 3px;
        padding: 1px 5px;
      }
 
      .at-list-pos {
        font-size: 11px;
        color: #666;
      }
    </style>
 
    <div class="at-panel">
 
      <div class="at-top-buttons">
        <button class="at-btn active" id="at-create-btn">Create</button>
        <button class="at-btn" id="at-list-btn">List</button>
      </div>
 
      <!-- CREATE VIEW -->
      <div id="at-create-view">
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
          <button class="at-icon-btn" id="place-infront" title="Toggle insertion side">→</button>
        </div>
   
        <div class="at-add-btn-wrapper">
          <button class="at-add-btn" id="at-add-token-btn">Add token</button>
        </div>
      </div>
 
      <!-- LIST VIEW -->
      <div id="at-list-view" style="display:none;">
        <ul class="at-list" id="at-token-list"></ul>
      </div>
 
    </div>
  `;
 
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const keyboardDiv = document.querySelector('.simple-keyboard');
      if (keyboardDiv) initializeKeyboard();
    });
  });
 
  const createBtn = toolBody.querySelector("#at-create-btn");
  const listBtn   = toolBody.querySelector("#at-list-btn");
  const createView = toolBody.querySelector("#at-create-view");
  const listView   = toolBody.querySelector("#at-list-view");
 
  createBtn.style.backgroundColor = 'green';
  listBtn.style.backgroundColor = '#4e6476';
 
  function showCreateView() {
    createBtn.style.backgroundColor = 'green';
    listBtn.style.backgroundColor = '#4e6476';
    createBtn.classList.add("active");
    listBtn.classList.remove("active");
    createView.style.display = '';
    listView.style.display = 'none';
    clearAtHighlights();
  }
 
  function showListView() {
    listBtn.style.backgroundColor = 'green';
    createBtn.style.backgroundColor = '#4e6476';
    listBtn.classList.add("active");
    createBtn.classList.remove("active");
    createView.style.display = 'none';
    listView.style.display = '';
    renderAtList();
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
 
  window.onAtAnchorSelected = function () {
    selectWordBtn.style.backgroundColor = '#4e6476';
    const anchor = getAnchorWord();
    const insertionDisplay = document.querySelector("#at-insertion-display");
    if (insertionDisplay && anchor) {
      const position = window.atInsertionBefore ? 'in front of' : 'behind';
      insertionDisplay.textContent = `${position} [${anchor.form}]`;
    }
  };
 
  const placeInfrontBtn = toolBody.querySelector("#place-infront");
  placeInfrontBtn.addEventListener("click", () => {
    window.atInsertionBefore = !window.atInsertionBefore;
    placeInfrontBtn.textContent = window.atInsertionBefore ? '←' : '→';
    placeInfrontBtn.style.backgroundColor = window.atInsertionBefore ? '#4e6476' : 'green';
 
    const anchor = getAnchorWord();
    const insertionDisplay = document.querySelector("#at-insertion-display");
    if (insertionDisplay && anchor) {
      const position = window.atInsertionBefore ? 'in front of' : 'behind';
      insertionDisplay.textContent = `${position} [${anchor.form}]`;
    }
  });
 
  function getAnchorWord() {
    const sentence = window.treebankData?.find(s => s.id === String(window.currentIndex));
    return sentence?.words.find(w => String(w.id) === String(window.atSelectedWordId));
  }
 
  // Add token button
  const addTokenBtn = toolBody.querySelector("#at-add-token-btn");
  addTokenBtn.addEventListener("click", async () => {
    const anchor = getAnchorWord();
    if (!anchor) {
      const cancelBtn = document.getElementById("app-modal-cancel");
      const oldDisplay = cancelBtn ? cancelBtn.style.display : "";

      if (cancelBtn) cancelBtn.style.display = "none";

      await showConfirmDialog(
        "No anchor word selected.",
        {
          titleText: "Artificial Token",
          okText: "Okay",
          cancelText: "Cancel"
        }
      );

      if (cancelBtn) cancelBtn.style.display = oldDisplay;
      return;
    }
 
    const visualRep = toolBody.querySelector(".token-input").value;
    const tokenType = toolBody.querySelector("#at-token-type").value;
    const anchorId  = String(anchor.id).padStart(4, '0');
    const insertion_id = getNextInsertionId(anchorId, getCurrentArtificialTokens());
 
    const newToken = {
      id: getNextWordId(),
      form: visualRep || `[${getATCount() + 1}]`,
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
    const sentence = window.treebankData?.find(s => s.id === String(window.currentIndex));
    return sentence?.words.filter(w => w.artificial) || [];
  }
 
  function getNextWordId() {
    const sentence = window.treebankData?.find(s => s.id === String(window.currentIndex));
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
 
  // ---------------------------------------------------------------------------
  // LIST VIEW LOGIC
  // ---------------------------------------------------------------------------
 
  let selectedAtId = null;
 
  function clearAtHighlights() {
    selectedAtId = null;
    if (window.batchSelection) window.batchSelection.clear();
    document.querySelectorAll(".token").forEach(t => t.classList.remove("selected"));
    if (typeof d3 !== "undefined") {
      d3.selectAll(".node").classed("selected", false);
    }
  }
 
  function highlightToken(wordId) {
    // Clear previous highlights
    clearAtHighlights();
 
    selectedAtId = String(wordId);
 
    // Highlight sentence token
    const token = document.querySelector(`.token[data-word-id="${wordId}"]`);
    if (token) token.classList.add("selected");
 
    // Highlight tree node
    const node = document.querySelector(`.node[id="${wordId}"]`);
    if (node && typeof d3 !== "undefined") {
      d3.select(node).classed("selected", true);
    }
 
    if (window.batchSelection) window.batchSelection.add(String(wordId));
  }
 
  function renderAtList() {
    const listEl = toolBody.querySelector("#at-token-list");
    if (!listEl) return;
 
    listEl.replaceChildren();
 
    const artificialTokens = getCurrentArtificialTokens();
 
    if (artificialTokens.length === 0) {
      const empty = document.createElement("p");
      empty.className = "at-list-empty";
      empty.textContent = "No artificial tokens in this sentence.";
      listEl.appendChild(empty);
      return;
    }
 
    artificialTokens.forEach(w => {
      const item = document.createElement("li");
      item.className = "at-list-item";
      if (String(w.id) === selectedAtId) item.classList.add("at-list-selected");
 
      const formSpan = document.createElement("span");
      formSpan.className = "at-list-form";
      formSpan.textContent = w.form;
 
      const typeSpan = document.createElement("span");
      typeSpan.className = "at-list-type";
      typeSpan.textContent = w.artificial;
 
      item.appendChild(formSpan);
      item.appendChild(typeSpan);
 
      // Click to select
      item.addEventListener("click", () => {
        highlightToken(w.id);
        // Update selected state on all items
        listEl.querySelectorAll(".at-list-item").forEach(el =>
          el.classList.remove("at-list-selected")
        );
        item.classList.add("at-list-selected");
      });
 
      // Hover highlight
      item.addEventListener("mouseenter", () => {
        const token = document.querySelector(`.token[data-word-id="${w.id}"]`);
        if (token && String(w.id) !== selectedAtId) token.classList.add("selected");
        const node = document.querySelector(`.node[id="${w.id}"]`);
        if (node && typeof d3 !== "undefined" && String(w.id) !== selectedAtId) {
          d3.select(node).classed("selected", true);
        }
      });
 
      item.addEventListener("mouseleave", () => {
        // Only remove highlight if this item isn't the selected one
        if (String(w.id) !== selectedAtId) {
          const token = document.querySelector(`.token[data-word-id="${w.id}"]`);
          if (token) token.classList.remove("selected");
          const node = document.querySelector(`.node[id="${w.id}"]`);
          if (node && typeof d3 !== "undefined") {
            d3.select(node).classed("selected", false);
          }
        }
      });
 
      listEl.appendChild(item);
    });
  }
}