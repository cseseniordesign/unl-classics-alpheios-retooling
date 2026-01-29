import { loadTreebankData } from '../xml/xmlLoader.js';
import { updateNavigationButtons, updateSentenceSelector } from './navigation.js';
import { getPOSChar, colorForPOS, createsCycle } from '../tree/treeUtils.js';
import { createNodeHierarchy } from '../tree/treeRender.js';
import { triggerAutoSave } from '../xml/saveXML.js';
import { saveState } from '../xml/undo.js';
import { fetchMorphology } from '../morph/morpheus.js';
import { isTableVisible } from '../../../main.js';
import { createTable } from '../table/tableRender.js';
import { recomputeDirty, discardXmlEdits } from '../xml/xmlTool.js';
import { showConfirmDialog } from './modal.js';
import { getLanguage, isMorpheusSupported } from '../input/language.js';

// ---------------------------------------------------------------------------
// Treebank mode banner helpers
// ---------------------------------------------------------------------------
window.selectedWordId = window.selectedWordId ?? null;
// Capture the initial Treebanking-mode UI so tools can restore it later
if (!window.treebankModeHTML) {
  const toolBody = document.getElementById('tool-body');
  if (toolBody) {
    window.treebankModeHTML = toolBody.innerHTML;
  }
}

function updateTreebankSelectionBanner(wordId) {
  const rowEl    = document.getElementById("treebank-selected-node");
  const tokenEl  = document.getElementById("tb-node-token");
  const metaEl   = document.getElementById("tb-node-meta");

  if (!rowEl || !tokenEl || !metaEl) return;

  const sentences = Array.isArray(window.treebankData) ? window.treebankData : [];
  const currentSentence = sentences.find(s => s.id === String(window.currentIndex));
  const word = currentSentence?.words?.find(w => String(w.id) === String(wordId));

  if (!word) {
    rowEl.classList.add("hidden");
    tokenEl.textContent = "";
    metaEl.textContent  = "";
    return;
  }

  // Main token text
  tokenEl.textContent = word.form || "(blank)";

  // Build a compact meta line:  #ID · lemma · POS · relation
  const lemma  = word._displayLemma || word.lemma || "";
  const postag = (word._displayPostag || word.postag || "").split(/[\s-]/)[0] || "";
  const rel    = word.relation || "";

  const bits = [`#${word.id}`];
  if (lemma)  bits.push(lemma);
  if (postag) bits.push(postag);
  if (rel)    bits.push(rel);

  metaEl.textContent = bits.join(" · ");

  rowEl.classList.remove("hidden");
}

function clearTreebankSelectionBanner() {
  const rowEl    = document.getElementById("treebank-selected-node");
  const tokenEl  = document.getElementById("tb-node-token");
  const metaEl   = document.getElementById("tb-node-meta");

  if (!rowEl || !tokenEl || !metaEl) return;

  rowEl.classList.add("hidden");
  tokenEl.textContent = "";
  metaEl.textContent  = "";
}


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
  // Check whether the sentence comes from XML or user input
  window.appMode = window.sessionStorage.getItem("userInput") ? "userInput" : "uploadXML";

  index = Number(index);
  if (!Number.isFinite(index)) index = 1;

  const tokenizedSentence = document.getElementById('tokenized-sentence');

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

  if (!tokenizedSentence) {
        // If the element isn't found, stop here so we don't crash the script
        console.warn("Display target 'tokenized-sentence' not found. Waiting for DOM...");
        return; 
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

  // Clear any "changing head for" banner when switching sentences
  clearTreebankSelectionBanner();

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

    // checks to see if it receives the select classlist?

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
export function handleWordClick(wordId, word) {
  const lang = getLanguage();
  if (isMorpheusSupported(lang)) {
    fetchMorphology(word, lang);
  }

  const tokenEl = document.querySelector(`button[data-word-id="${wordId}"]`) ||
                  document.querySelector(`.token[data-word-id="${wordId}"]`);
  const nodeSel = (typeof d3 !== 'undefined')
    ? d3.select(`.node[id="${wordId}"]`)
    : null;

  const toolBody = document.getElementById('tool-body');
  // If Morph/Relation is open, update the side panel,
  // but DO NOT interrupt the normal head-change click flow.
  if ((window.isMorphActive || window.isRelationActive) && Array.isArray(window.treebankData)) {
    const currentSentence = window.treebankData.find(s => s.id === `${window.currentIndex}`);
    const w = currentSentence && currentSentence.words
      ? currentSentence.words.find(x => String(x.id) === String(wordId))
      : null;

    if (w) {
      if (window.isMorphActive) window.renderMorphInfo(w);
      if (window.isRelationActive) window.renderRelationInfo(w);
    }
  }

  
  const currentSentence = window.treebankData.find(s => s.id === `${window.currentIndex}`);
  const newHeadId = String(wordId);

  //Check if the "Selector" tool is active or if we have multiple selected words
  const selectedElements = document.querySelectorAll(".token.selected, .node.selected");
  
  // Get unique IDs of all selected words
  const selectedIds = new Set();
  selectedElements.forEach(el => {
    const id = el.dataset.wordId || el.id;
    if (id) selectedIds.add(String(id));
  });

  //Logic for when we have multiple selections
  if (selectedIds.size > 0) {
    // If the user clicks one of the already selected words, do nothing or reset
    if (selectedIds.has(newHeadId)) {
        resetSelection();
        return;
    }

    saveState();
    let changesMade = false;

    selectedIds.forEach(depId => {
        const dependent = currentSentence.words.find(w => String(w.id) === String(depId));
        
        if (dependent && String(dependent.id) !== newHeadId) {
            // Prevent cycles for each word being moved
            if (!createsCycle(currentSentence.words, depId, newHeadId)) {
                dependent.head = newHeadId;
                changesMade = true;
            } else {
                console.warn(`Cycle detected for word ${depId}. Skipping.`);
            }
        }
    });

    if (changesMade) {
        triggerAutoSave();
        createNodeHierarchy(window.currentIndex);
    }
    resetSelection();
    return; 
  }

  //const newHeadId = wordId;

  if (String(selectedWordId) === String(newHeadId)) {
    const btn = document.querySelector(`button[data-word-id="${wordId}"]`);
    const node = document.querySelector(`.node[id="${wordId}"]`);
    if (node) node.classList.remove("selected");
    if (btn) btn.classList.remove("selected");
    resetSelection();
    return;
  }

  // If we are about to perform a head change (meaning: we already have a dependent),
  // and a tool is open, clear the tool panel so it doesn't fight head-change.
  const aboutToChangeHead = (selectedWordId !== null && String(selectedWordId) !== String(newHeadId));

  if (aboutToChangeHead) {
    if (window.isMorphActive) {
      const pinned = document.getElementById("morph-pinned");
      const hover  = document.getElementById("morph-hover");

      // Keep the panel structure intact so hover rendering still has a place to go
      if (pinned) pinned.innerHTML = "";
      if (hover)  hover.innerHTML = "";
    }

    if (window.isRelationActive) {
      const pinned = document.getElementById("relation-pinned");
      const hover  = document.getElementById("relation-hover");

      if (pinned) pinned.innerHTML =  "";
      if (hover)  hover.innerHTML = "";
    }
  }

  
  //gets dependent node (first selected node)

  // If no dependent has been selected yet, this click is the dependent selection.
  // Let your existing selection/highlight logic run (wherever you set selectedWordId),
  // but do NOT do head-change work yet.
  if (!selectedWordId) {
    selectedWordId = String(wordId);

    // Clear any previous visual selection
    document.querySelectorAll(".token.selected").forEach(t => t.classList.remove("selected"));
    if (typeof d3 !== 'undefined') {
      d3.selectAll(".node.selected").classed("selected", false);
    }

    // Highlight the dependent (first click)
    if (tokenEl) tokenEl.classList.add("selected");
    if (nodeSel && !nodeSel.empty()) nodeSel.classed("selected", true);

    window.currentSelectedWordId = String(wordId);

    // Restore treebank banner 
    updateTreebankSelectionBanner(wordId);

    return;
  }
  const dependent = currentSentence.words.find(word => word.id === selectedWordId);
  //gets indepenent node (second selected node)
  const independent = currentSentence.words.find(word => word.id === newHeadId);

  //remove highlight when second word is selected
  const btnNewHead = document.querySelector(`button[data-word-id="${newHeadId}"]`);
  if (btnNewHead) btnNewHead.classList.remove("highlight");

  if (!dependent || !independent) {
    resetSelection();
    return;
  }

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
  // Clear any selected/highlighted token(s) in the sentence bar
  document
    .querySelectorAll(".token.selected, .token.highlight")
    .forEach(t => t.classList.remove("selected", "highlight"));

  // ALSO clear button-based tokens (your code often selects buttons)
  document
    .querySelectorAll('button.selected, button.highlight, button[data-word-id].selected, button[data-word-id].highlight')
    .forEach(b => b.classList.remove("selected", "highlight"));

  // Clear any selected/highlighted node(s) in the tree
  if (typeof d3 !== 'undefined') {
    d3.selectAll(".node.selected").classed("selected", false);
    d3.selectAll(".node.highlight").classed("highlight", false);
  } else {
    document.querySelectorAll(".node.selected, .node.highlight")
      .forEach(n => n.classList.remove("selected", "highlight"));
  }

  // Clear selection state
  selectedWordId = null;                 
  window.currentSelectedWordId = null;

  // If you also track this globally anywhere:
  if ("selectedWordId" in window) window.selectedWordId = null;

  // Hide the "changing head for" banner row
  clearTreebankSelectionBanner();

  if (window.isMorphActive) {
    const pinned = document.getElementById("morph-pinned");
    const hover  = document.getElementById("morph-hover");
    if (pinned) pinned.innerHTML = `<p style="padding:8px;">Click a word to view morphological info.</p>`;
    if (hover)  hover.innerHTML = "";
  }
  if (window.isRelationActive) {
    const pinned = document.getElementById("relation-pinned");
    const hover  = document.getElementById("relation-hover");
    if (pinned) pinned.innerHTML = `<p style="padding:8px;">Click a word to edit its dependency relation.</p>`;
    if (hover)  hover.innerHTML = "";
  }
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

