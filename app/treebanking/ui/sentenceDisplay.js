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
  index = Number(index);
  if (!Number.isFinite(index)) inex = 1;
  const tokenizedSentence = document.getElementById('tokenized-sentence');

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
} 

/**
 * --------------------------------------------------------------------------
 * FUNCTION: handleWordClick
 * --------------------------------------------------------------------------
 * handles changing head when two nodes are selected or displays morph info
 * if morph tab is active
 */

let selectedWordId = null; // keeps track of the first click(dependent word)

export function handleWordClick(wordId,word) {
  fetchMorphology(word, "grc").then(console.log);
  // If Morph tool is active → just show morph info, don’t alter tree
  if (window.isMorphActive) {
    // Clear all previous selections
    document.querySelectorAll(".token").forEach(t => t.classList.remove("selected"));
    d3.selectAll(".node").classed("selected", false);

    // Select the clicked token and its corresponding tree node
    const token = document.querySelector(`.token[data-word-id='${wordId}']`);
    const node = d3.select(`.node[id='${wordId}']`);

    if (token) token.classList.add("selected");
    if (!node.empty()) {
      node.classed("selected", true);
    }

    // Render the morph info in the tool panel
    const currentSentence = window.treebankData.find(s => s.id === `${window.currentIndex}`);
    const word = currentSentence.words.find(w => w.id === wordId);
    if (word && typeof window.renderMorphInfo === 'function') {
      window.renderMorphInfo(word);
    }

    return;
  }

  // If XML tab is active or tree locked, ignore clicks
  if (window.isReadOnly) return;

 // Otherwise, normal dependency reassignment mode
  //if there hasn't already been a selected word
  if(!selectedWordId) {
    selectedWordId = wordId;
    //selectedNodeId = wordId;
    //add visual confirmation
    const btn = document.querySelector(`button[data-word-id="${wordId}"]`);
    const node = document.querySelector(`.node[id="${wordId}"]`);
    if (btn) btn.classList.remove("highlight"), node.classList.add("selected"), btn.classList.add("selected");
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
  const prev = document.querySelector(".token.selected");
  if (prev) prev.classList.remove("selected");
  selectedWordId = null
}

export function safeDisplaySentence(targetId, options = {}) {
  const { skipXMLGuard = false } = options;

  // If we're not skipping, enforce the XML "unsaved edits" check
  if (!skipXMLGuard) {
    recomputeDirty(document.getElementById('xml-display'));

    if (window.xmlDirty) {
      const ok = confirm("You have unsaved XML edits. Discard them?");
      if (!ok) return false;   // navigation cancelled

      // User chose to discard edits → revert editor to snapshot
      discardXmlEdits();
    }
  }

  // Now it's safe to switch sentences
  displaySentence(Number(targetId));
  return true;
}
window.safeDisplaySentence = safeDisplaySentence;
