import { loadTreebankData } from '../xml/xmlLoader.js';
import { updateNavigationButtons, updateSentenceSelector } from './navigation.js';
import { getPOSChar, colorForPOS, createsCycle } from '../tree/treeUtils.js';
import { createNodeHierarchy } from '../tree/treeRender.js';
import { triggerAutoSave } from '../xml/saveXML.js';
import { saveState } from '../xml/undo.js';
import { fetchMorphology } from '../morph/morpheus.js';
import { isTableVisible } from '../main.js';
import { createTable } from '../table/tableRender.js';
import { recomputeDirty, discardXmlEdits } from '../xml/xmlTool.js';
import { showConfirmDialog } from './modal.js';

/**
 * --------------------------------------------------------------------------
 * FUNCTION: displaySentence
 * --------------------------------------------------------------------------
 * Renders the given sentence and its dependency tree.
 * Keeps UI buttons and dropdown synchronized with the current view.
 *
 * @param {number} index - Sentence ID (numeric) to display.
 * @returns {Promise<void>} Resolves after loading data and rendering the selected sentence and its tree.
 */
export async function displaySentence(index) {
  // Get the URL parameter for the input sentence
  const params = new URLSearchParams(window.location.search);
  const sentenceInput = params.get("sentence");
  
  // displays sentence from input page and returns (does not render tree yet)
  if (sentenceInput) {
    document.getElementById("input-sentence").textContent = sentenceInput;
    window.rawSentence = sentenceInput; // global variable to store input sentence
    return;
  }

  index = Number(index);
  if (!Number.isFinite(index)) index = 1;

  const tokenizedSentence = document.getElementById('tokenized-sentence');
  if (!tokenizedSentence) return;

  // Whenever we change sentences, completely reset tool state.
  if (window.isMorphActive && typeof window.closeMorphTool === "function") {
    window.closeMorphTool();
  }
  if (window.isRelationActive && typeof window.closeRelationTool === "function") {
    window.closeRelationTool();
  }
  if (typeof window.resetSelection === "function") {
    window.resetSelection();
  }

  // Ensure the dataset is loaded before proceeding
  const data = await loadTreebankData();
  if (!data || data.length === 0) {
    console.warn('No treebank data available.');
    return;
  }

  // If Morph tool is open, close it when changing sentences
  if (window.isMorphActive && typeof window.closeMorphTool === 'function') {
    window.closeMorphTool();
  }

  // Whenever we change sentences, clear any existing word/tree selection.
  if (typeof window.resetSelection === 'function') {
    window.resetSelection();
  }

  // Clear previously displayed sentence text
  tokenizedSentence.textContent = '';

  // Constrain the requested index to available range
  window.totalSentences = data.length;
  if (index < 1) index = 1;
  if (index > window.totalSentences) index = window.totalSentences;
  window.currentIndex = index;

  // Sync UI controls for navigation and dropdown
  updateNavigationButtons(index);
  updateSentenceSelector(index);

  // Locate the sentence matching the given ID
  const sentence = data.find(s => s.id === `${index}`);
  if (!sentence) {
    console.warn(`Sentence with id=${index} not found.`);
    return;
  }

  // Render tokens inline above the tree 
    sentence.words.forEach((word) => {
    const button = document.createElement("button");
    button.textContent = word.form + " ";
    button.classList.add("token");
    button.dataset.wordId = word.id;
    button.dataset.pos = getPOSChar(word);
    button.style.color = colorForPOS(word);   // sentence token font color

    // Add click interaction for Morph, Relation, and Focus modes
    button.addEventListener("click", (event) => handleWordClick(word.id,word.form));

  tokenizedSentence.appendChild(button);
});

  // Generate and display the D3 dependency tree
  createNodeHierarchy(index);

  if (isTableVisible) {
    document.querySelector("#sandbox table").remove();
    createTable(index);
  }

  // Refresh XML panel if open
  if (typeof window.updateXMLIfActive === 'function') {
    window.updateXMLIfActive();
  }

  if (typeof window.setupWordHoverSync === 'function') {
    window.setupWordHoverSync();
  }
  
  // Keep the Sentence tools panel in sync with the current sentence
  if (typeof window.refreshSentenceToolUI === 'function') {
    window.refreshSentenceToolUI();
  }
} 

/**
 * --------------------------------------------------------------------------
 * FUNCTION: handleWordClick
 * --------------------------------------------------------------------------
 * handles changing head when two nodes are selected or displays morph info
 * if morph tab is active
 */

let selectedWordId = null; // keeps track of the first click(dependent word)

export function handleWordClick(wordId, word) {
  fetchMorphology(word, "grc").then(console.log);

  const tokenEl = document.querySelector(`button[data-word-id="${wordId}"]`) ||
                  document.querySelector(`.token[data-word-id="${wordId}"]`);
  const nodeSel = (typeof d3 !== 'undefined')
    ? d3.select(`.node[id="${wordId}"]`)
    : null;

    // 1) Morph tool active → select + show morph (no head changes)
  if (window.isMorphActive) {
    // Clear previous selection
    document.querySelectorAll(".token.selected")
      .forEach(t => t.classList.remove("selected"));
    if (typeof d3 !== 'undefined') {
      d3.selectAll(".node.selected").classed("selected", false);
    }

    // Highlight current token + node
    if (tokenEl) tokenEl.classList.add("selected");
    if (nodeSel && !nodeSel.empty()) nodeSel.classed("selected", true);

    // Remember which word is selected
    window.currentSelectedWordId = wordId;

    // Show morph info for this word
    if (typeof window.renderMorphInfo === "function" &&
        Array.isArray(window.treebankData)) {
      const currentSentence = window.treebankData.find(
        s => s.id === `${window.currentIndex}`
      );
      const w = currentSentence?.words.find(w => w.id === wordId);
      if (w) {
        window.renderMorphInfo(w);
      }
    }
    return;
  }

  // 2) Relation tool active → select + show relation (no head changes)
  if (window.isRelationActive) {
    // Clear previous selection
    document.querySelectorAll(".token.selected")
      .forEach(t => t.classList.remove("selected"));
    if (typeof d3 !== 'undefined') {
      d3.selectAll(".node.selected").classed("selected", false);
    }

    // Highlight current token + node
    if (tokenEl) tokenEl.classList.add("selected");
    if (nodeSel && !nodeSel.empty()) nodeSel.classed("selected", true);

    // Remember which word is selected
    window.currentSelectedWordId = wordId;

    // Show relation info for this word
    if (typeof window.renderRelationInfo === "function" &&
        Array.isArray(window.treebankData)) {
      const currentSentence = window.treebankData.find(
        s => s.id === `${window.currentIndex}`
      );
      const w = currentSentence?.words.find(w => w.id === wordId);
      if (w) {
        window.renderRelationInfo(w);
      }
    }
    return;
  }

  // 3) Read-only → do nothing
  if (window.isReadOnly) return;

  // 4) Default: dependency reassignment (two-click head changing)
  if (!selectedWordId) {
    selectedWordId = wordId;

    // Clear any previous visual selection
    document.querySelectorAll(".token.selected").forEach(t => t.classList.remove("selected"));
    if (typeof d3 !== 'undefined') {
      d3.selectAll(".node.selected").classed("selected", false);
    }

    if (tokenEl) tokenEl.classList.add("selected");
    if (nodeSel && !nodeSel.empty()) nodeSel.classed("selected", true);

    window.currentSelectedWordId = wordId;
    return;
  }

  //remove highlight if same word clicked twice and reset selection
  const newHeadId = wordId;
  if(selectedWordId === newHeadId) {
    const btn = document.querySelector(`button[data-word-id="${wordId}"]`);
    const node = document.querySelector(`.node[id="${wordId}"]`);
    node.classList.remove("selected"),btn.classList.remove("selected");
    resetSelection();
    return;
  }

  const currentSentence = window.treebankData.find(s => s.id === `${window.currentIndex}`);
  //gets dependent node (first selected node)
  const dependent = currentSentence.words.find(word => word.id === selectedWordId);
  //gets indepenent node (second selected node)
  const independent = currentSentence.words.find(word => word.id === newHeadId);

  //remove highlight when second word is selected
  const btnNewHead = document.querySelector(`button[data-word-id="${newHeadId}"]`);
  if (btnNewHead) btnNewHead.classList.remove("highlight");

  saveState();
  if (createsCycle(currentSentence.words, selectedWordId, newHeadId)) {
    // Flip logic — make the old head now depend on the selected word
    independent.head = dependent.head;
    triggerAutoSave();
  } else if(dependent) {
    // Normal assignment
    dependent.head = newHeadId;
    triggerAutoSave();
  }
  
  createNodeHierarchy(window.currentIndex);

  resetSelection();
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupResizeHandle
 * --------------------------------------------------------------------------
 * Enables vertical resizing between the sentence box and the tree view.
 * User can drag the divider to control how much space each occupies.
 *
 * @returns {void} Runs synchronously to enable resizing interaction between sentence and tree view.
 */
export function setupResizeHandle() {
  const treeView     = document.getElementById('tree-view');
  const sentenceBox  = document.getElementById('sentence');
  const resizeHandle = document.getElementById('resize-handle');
  if (!treeView || !sentenceBox || !resizeHandle) return;

  let isResizing = false;
  let startY;
  let startHeight;

  // Start resizing on mousedown
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = sentenceBox.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    e.preventDefault();
  });

  // Adjust height dynamically as mouse moves
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const dy = e.clientY - startY;
    const newHeight = startHeight + dy;
    const parentHeight = treeView.offsetHeight;
    const minHeight = 50;
    const maxHeight = parentHeight * 0.85;

    if (newHeight >= minHeight && newHeight <= maxHeight) {
      sentenceBox.style.height = `${newHeight}px`;
      sentenceBox.style.overflowY = 'auto';
    }
  });

  // Stop resizing on mouse release
  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = 'default';
  });
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: resetSelection
 * --------------------------------------------------------------------------
 * resets the first selected word 
 */
function resetSelection() {
  // Clear any selected token(s) in the sentence bar
  document.querySelectorAll(".token.selected").forEach(t => t.classList.remove("selected"));

  // Clear any selected node(s) in the tree
  if (typeof d3 !== 'undefined') {
    d3.selectAll(".node.selected").classed("selected", false);
  }

  // Clear selection state
  selectedWordId = null;
  window.currentSelectedWordId = null;
}

// Make it available to other modules (XML tool, etc.)
window.resetSelection = resetSelection;

export async function safeDisplaySentence(targetId, options = {}) {
  const { skipXMLGuard = false } = options;

  // If we're not skipping, enforce the XML "unsaved edits" check
  if (!skipXMLGuard) {
    recomputeDirty(document.getElementById('xml-display'));

    if (window.xmlDirty) {
      const ok = await showConfirmDialog(
        "You have unsaved XML edits. Discard them?",
        {
          titleText: "Discard XML edits?",
          okText: "Discard",
          cancelText: "Cancel"
        }
      );
      if (!ok) return false;   // navigation cancelled

      // User chose to discard edits → revert editor to snapshot
      discardXmlEdits();
    }
  }

  // Close any active tools before switching sentences
  if (window.isMorphActive && typeof window.closeMorphTool === "function") {
    window.closeMorphTool();
  }
  if (window.isRelationActive && typeof window.closeRelationTool === "function") {
    window.closeRelationTool();
  }
  if (typeof window.resetSelection === "function") {
    window.resetSelection();
  }

  displaySentence(Number(targetId));
  return true;
}
window.safeDisplaySentence = safeDisplaySentence;

