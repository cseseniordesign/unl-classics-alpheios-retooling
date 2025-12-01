/* ============================================================================
    IMPORTS
   ============================================================================ */
import parseTreeBankXML from './xml/parser.js';
import { handleFileUpload, loadTreebankData } from './xml/xmlLoader.js';
import { setupXMLTool } from './xml/xmlTool.js';
import { setupMorphTool } from './morph/morphTool.js';
import { setupSentenceSelector } from './ui/navigation.js';
import { setupResizeHandle, displaySentence } from './ui/sentenceDisplay.js';
import { compactTree, expandTree, fitTreeToView, focusOnNode } from './tree/treeUtils.js';
import { saveCurrentTreebank } from './xml/saveXML.js';
import { undoButton, redoButton } from './xml/undo.js';
import { createTable, switchToTree } from './table/tableRender.js';
import { setupSentenceTool } from './ui/sentenceTool.js';

window.root = null;
window.svg = null;
window.gx = null;
window.idParentPairs = null;
window.verticalSpacing = 1;
window.displaySentence = displaySentence;

export var isTableVisible = false;

/* ============================================================================
    BUTTON & INTERFACE EVENTS
   ============================================================================ */


function setupSaveButton() {
  const button = document.getElementById("save");
  if (button) {
    button.addEventListener("click", saveCurrentTreebank);
  }
}

function setupUndoButton() {
    const button = document.getElementById("undo");
    if (button) {
        button.addEventListener("click", undoButton);
    }
}

function setupRedoButton() {
    const button = document.getElementById("redo");
    if (button) {
        button.addEventListener("click", redoButton);
    }
}

/**  
 *
 * ------------------------------------------------------------------------
 * FUNCTION: showToast
 * ------------------------------------------------------------------------
 * 
 * Handles display of floating message 
 * 
 * @returns {void} shows toast message on UI
 */
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  setTimeout(() => (toast.style.opacity = "0"), 2300);
  toast.style.opacity = "1";
}

function setupTreeButtons() {
  const compactBtn = document.getElementById("compact");
  const expandBtn  = document.getElementById("expand");
  const centerBtn  = document.getElementById("center");
  const rootBtn    = document.getElementById("focus-root");
  const selectionBtn = document.getElementById("focus-selection");
  const tableBtn = document.getElementById("table");

  // Compact / Expand
  compactBtn?.addEventListener("click", compactTree);
  expandBtn?.addEventListener("click", expandTree);

  // Center (fit to view)
  centerBtn?.addEventListener("click", () => {
    fitTreeToView(window.svg, window.gx, window.container, window.zoom, window.margin);
  });

  // Focus Root — focuses the syntactic root node
  rootBtn?.addEventListener("click", () => {
    if (window.root && typeof focusOnNode === "function") {
      focusOnNode(window.root);
    } else {
      console.warn("Root node not found.");
    }
  });

  // Focus Selection — focuses whichever node or token is selected
  selectionBtn?.addEventListener("click", () => {
    let targetNode = null;

    // Priority 1: Use selected node from tree (set in drawNodes)
    if (window.selectedNode) {
      targetNode = window.selectedNode;
    } 
    // Fallback: if a sentence token is selected, match it to a node
    else {
      const selectedToken = document.querySelector(".token.selected");
      if (selectedToken) {
        const wordId = selectedToken.dataset.wordId;
        targetNode = window.root?.descendants().find(n => n.data.id === wordId);
      }
    }

    // Focus if found, warn if not
    if (targetNode && typeof focusOnNode === "function") {
      focusOnNode(targetNode);
    } else {
      showToast("Please select a node in the tree or a word in the sentence.");
    }
  });

  // Table Button - Swaps between tree and table view
  tableBtn?.addEventListener("click", () => {
    if (isTableVisible) {
      switchToTree(window.currentIndex);            // remove or hide the table
      isTableVisible = false;    // update flag
    } else {
      createTable(window.currentIndex); // show the table
      isTableVisible = true;            // update flag
    }
  });
}

/* ============================================================================
    INITIALIZATION ENTRY POINT
   ============================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // --- Load and render ---
  const raw = localStorage.getItem("treebankData");
  if (!raw) { 
    //console.warn("No treebank data found");
    //return;
    await loadTreebankData();
  }
  else {
    const data = JSON.parse(raw);
    window.treebankData = data;
  }
  await displaySentence(1);
  // --- Initialize UI ---
  setupSentenceSelector();
  setupResizeHandle();
  setupXMLTool();
  setupMorphTool();

  // --- Buttons ---
  setupSaveButton();
  setupTreeButtons();
  setupUndoButton();
  setupRedoButton();
  setupSentenceTool();  
});