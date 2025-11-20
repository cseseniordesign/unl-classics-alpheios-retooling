/* ============================================================================
    IMPORTS
   ============================================================================ */
import parseTreeBankXML from './app/treebanking/xml/parser.js';
import { loadTreebankData } from './xml/xmlLoader.js';
import { setupXMLTool } from './app/treebanking/xml/xmlTool.js';
import { setupMorphTool } from './app/treebanking/morph/morphTool.js';
import { setupSentenceSelector } from './app/treebanking/ui/navigation.js';
import { setupResizeHandle, displaySentence } from './app/treebanking/ui/sentenceDisplay.js';
import { compactTree, expandTree, fitTreeToView, focusOnNode } from './app/treebanking/tree/treeUtils.js';
import { saveCurrentTreebank } from './app/treebanking/xml/saveXML.js';
import { undoButton, redoButton } from './app/treebanking/xml/undo.js';
import { createTable, switchToTree } from './app/treebanking/table/tableRender.js';

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
  await loadTreebankData();
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
});
