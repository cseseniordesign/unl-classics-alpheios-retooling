/* ============================================================================
    IMPORTS
   ============================================================================ */
import parseTreeBankXML from './app/treebanking/xml/parser.js';
import { handleFileUpload, loadTreebankData } from './app/treebanking/xml/xmlLoader.js';
import { setupXMLTool } from './app/treebanking/xml/xmlTool.js';
import { setupMorphTool } from './app/treebanking/morph/morphTool.js';
import { setupSentenceSelector } from './app/treebanking/ui/navigation.js';
import { setupResizeHandle, displaySentence } from './app/treebanking/ui/sentenceDisplay.js';
import { compactTree, expandTree, fitTreeToView, focusOnNode } from './app/treebanking/tree/treeUtils.js';
import { saveCurrentTreebank } from './app/treebanking/xml/saveXML.js';
import { undoButton, redoButton } from './app/treebanking/xml/undo.js';
import { createTable, switchToTree } from './app/treebanking/table/tableRender.js';
import { setupSentenceTool } from './app/treebanking/ui/sentenceTool.js';
import { setupRelationTool } from './app/treebanking/relation/relationTool.js';
import { tokenizer } from './app/treebanking/xml/tokenizer.js';
import { setLanguage } from "./app/treebanking/input/language.js"; 
import {setupSelector} from "./app/treebanking/xml/selector.js";
import { updateTreebankSelectionBanner } from "./app/treebanking/ui/sentenceDisplay.js";

window.handleFileUpload = handleFileUpload;
window.batchSelection = new Set();
window.selectorInputValue = "";
window.formInputValue = "";

window.root = null;
window.svg = null;
window.gx = null;
window.idParentPairs = null;
window.verticalSpacing = 1;
window.displaySentence = displaySentence;
window.appMode = "";

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
function handleExit() {
  const exit = document.querySelector("#exit");
  exit.addEventListener("click", ()=> {
    if(confirm("Are you sure you want to exit?") == true){
      localStorage.removeItem("xmlContent");
      localStorage.removeItem("treebankData");
      sessionStorage.removeItem("userInput");
      window.uploadedFileHandle = null;
      window.treebankData = null;
      window.location = './index.html';
    }
  });
}


function setupHistoryButton() {
    const button = document.getElementById("history");
    if (button) {
        button.addEventListener("click", function() {
            alert("Sorry, this feature is not yet implemented. Please look forward to using it in future updates!");
        });
    }
}

function setupCommentButton() {
    const button = document.getElementById("comment");
    if (button) {
        button.addEventListener("click", function() {
            alert("Sorry, this feature is not yet implemented. Please look forward to using it in future updates!");
        });
    }
}

function setupSettingsButton() {
    const button = document.getElementById("settings");
    if (button) {
        button.addEventListener("click", function() {
            alert("Sorry, this feature is not yet implemented. Please look forward to using it in future updates!");
        });
    }
}

function setupLanguageButton() {
    const button = document.getElementById("language");
    if (button) {
        button.addEventListener("click", function() {
            alert("Sorry, this feature is not yet implemented. Please look forward to using it in future updates!");
        });
    }
}

function setupaTButton() {
    const button = document.getElementById("aT");
    if (button) {
        button.addEventListener("click", function() {
            alert("Sorry, this feature is not yet implemented. Please look forward to using it in future updates!");
        });
    }
}

function setupNoneButton() {
  const button = document.getElementById("none");
  if (button) {
    button.addEventListener("click", function() {
      console.log('Button clicked!');
      
      // Check the batch selection
      console.log('batchSelection exists?', window.batchSelection);
      console.log('batchSelection size:', window.batchSelection?.size);
      console.log('batchSelection contents:', Array.from(window.batchSelection || []));
        
      // Check what selected elements exist
      const selectedElements = document.querySelectorAll('.selected');
      console.log('Found selected elements:', selectedElements.length);
      console.log('Selected elements:', selectedElements);
        
      // Check D3 nodes
      const selectedNodes = d3.selectAll('.node.selected');
      console.log('Found selected nodes:', selectedNodes.size());
        
      // Now try to clear
      window.batchSelection?.clear();
        
      selectedElements.forEach(element => {
        console.log('Removing selected from:', element);
        element.classList.remove('selected');
      });
        
      d3.selectAll('.node.selected').classed('selected', false);
        
      console.log('After clear - batchSelection size:', window.batchSelection?.size);
      updateTreebankSelectionBanner();
    });
  }
}

function setupUnusedButton() {
  const button = document.getElementById("unused");
  if (!button) return;
  
  let isHighlighted = false;
  
  button.addEventListener("click", function() {
    isHighlighted = !isHighlighted;
    
    if (isHighlighted) {
    
      // Highlight and select all unhung words
      const currentSentence = window.treebankData.find(s => s.id === `${window.currentIndex}`);
      if (!currentSentence || !currentSentence.words) return;
      
      currentSentence.words.forEach(word => {
        // Check if word has no head (unhung)
        if (!word.head || word.head === "" || word.head === null) {
          const wordId = String(word.id);
          
          // Add to batch selection
          window.batchSelection.add(wordId);
          
          // Highlight the token
          const token = document.querySelector(`.token[data-word-id="${wordId}"]`);
          if (token) token.classList.add("selected");
          
          // Highlight the node
          const node = d3.select(`.node[id="${wordId}"]`);
          if (node) node.classed("selected", true);
        }
      });
      
      button.classList.add("active"); // Make button darker
      updateTreebankSelectionBanner(); // Update the banner to show selections
      
    } else {
      // Clear batch selection
      window.batchSelection.clear();
      
      // Remove all highlights
      document.querySelectorAll('.token.selected').forEach(el => {
        el.classList.remove('selected');
      });
      
      d3.selectAll('.node.selected').classed('selected', false);
      
      button.classList.remove("active"); // Remove dark state
      updateTreebankSelectionBanner(); // Update the banner
    }
  });
}

function setupHighlightButton() {
  const button = document.getElementById("highlight");
  if (!button) return;
  
  let isHighlighted = false; // Track state
  
  button.addEventListener("click", function() {
    isHighlighted = !isHighlighted; // Toggle
    
    if (isHighlighted) {
      // Highlight all unhung words
      const currentSentence = window.treebankData.find(s => s.id === `${window.currentIndex}`);
      if (!currentSentence || !currentSentence.words) return;
      
      currentSentence.words.forEach(word => {
        // Check if word has no head (unhung)
        if (!word.head || word.head === "" || word.head === null) {
          const wordId = String(word.id);
          
          // Highlight the token
          const token = document.querySelector(`.token[data-word-id="${wordId}"]`);
          if (token) token.classList.add("selected");
          
          // Highlight the node
          const node = d3.select(`.node[id="${wordId}"]`);
          if (node) node.classed("selected", true);
        }
      });
      
      button.classList.add("active"); // Make button darker
      
    } else {
      // Remove all highlights
      document.querySelectorAll('.token.selected').forEach(el => {
        el.classList.remove('selected');
      });
      
      d3.selectAll('.node.selected').classed('selected', false);
      
      button.classList.remove("active"); // Remove dark state
    }
  });
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
export function showToast(message) {
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
  let initializedFromUserInput = false;
  setLanguage(localStorage.getItem("textLanguage") || "grc");
  const userInput = sessionStorage.getItem("userInput");
  const rawUploadedData = localStorage.getItem("treebankData");

  // --- Load and render ---
  if (userInput) {
    // Parse user input 
    const parsedSentences = await tokenizer(userInput);
    window.treebankData = parsedSentences;
    window.appMode = "userInput";

    initializedFromUserInput = true;

    // Clear any previous XML upload to avoid mixing pipelines
    localStorage.removeItem("xmlContent");
  }

  if (!initializedFromUserInput) {
    sessionStorage.removeItem("userInput");
    
    const raw = localStorage.getItem("treebankData");
    
    if (!raw) { 
      await loadTreebankData();
    }
    else {
      const data = JSON.parse(raw);
      window.treebankData = data;
      window.appMode = "uploadXML";
    }
  }

  if (window.treebankData) {
    await displaySentence(1);
  }

  //handle exit
  handleExit();
  
  // --- Initialize UI ---
  setupSentenceSelector();
  setupResizeHandle();
  setupXMLTool();
  setupMorphTool();
  setupRelationTool();

  // --- Buttons ---
  setupSaveButton();
  setupTreeButtons();
  setupUndoButton();
  setupRedoButton();
  setupSentenceTool();  
  setupSelector();
  setupHistoryButton();
  setupCommentButton();
  setupSettingsButton();
  setupLanguageButton();
  setupaTButton();
  setupNoneButton();
  setupUnusedButton();
  setupHighlightButton();
});
