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
import { getRegistryEntry } from './app/treebanking/tags/tagsetRegistry.js';
import { loadTagsetConfig } from './app/treebanking/tags/tagsetConfig.js';
import { setActiveTagset, getPosMeta, onTagsetChange, getActiveTagset } from './app/treebanking/tags/tagsetStore.js';
import { setupaT } from './app/treebanking/aT/aT.js';

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
onTagsetChange(() => logActiveTagset('onTagsetChange'));


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
  if(!exit) return;
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

// function setupaTButton() {
//     const button = document.getElementById("aT");
//     if (button) {
//         button.addEventListener("click", function() {
//             setupaT();
//         });
//     }
// }

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
        
      // Clear batch first
      window.batchSelection?.clear();

      if (typeof window.resetSelection === "function") {
        window.resetSelection();
      } else {
        document.querySelectorAll(".token.selected, .token.highlight")
          .forEach(el => el.classList.remove("selected", "highlight"));
        if (typeof d3 !== "undefined") {
          d3.selectAll(".node.selected, .node.highlight")
            .classed("selected", false)
            .classed("highlight", false);
        }
      }
        
      d3.selectAll('.node.selected').classed('selected', false);
        
      console.log('After clear - batchSelection size:', window.batchSelection?.size);
      updateTreebankSelectionBanner();

      // ---------------------------------------------------------
      // Clear tool UIs that depend on selection (Morph + Relation)
      // ---------------------------------------------------------

      // Morph
      if (window.isMorphActive) {
        const pinned = document.getElementById('morph-pinned');
        const hover  = document.getElementById('morph-hover');
        if (pinned) pinned.innerHTML = `<p style="padding:8px;">Click a word to view morphological info.</p>`;
        if (hover)  hover.innerHTML  = '';
      }

      // Relation
      if (window.isRelationActive) {
        const pinned = document.getElementById('relation-pinned');
        const hover  = document.getElementById('relation-hover');
        if (pinned) pinned.innerHTML = `<p style="padding:8px;">Click a word to edit its dependency relation.</p>`;
        if (hover)  hover.innerHTML  = '';
      }

      // Selector
      if (typeof window.resetSelectorUI === "function") {
        window.resetSelectorUI();
      } else {
        // Selector tab may not be initialized/open; at least clear found list if present
        const found = document.querySelector(".found-tokens");
        if (found) found.replaceChildren();
        window.selectorInputValue = "";
        window.formInputValue = "";
      }
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
    fitTreeToView(window.svg, window.gx, window.container, window.zoom, window.margin, true);
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

function logActiveTagset(where = 'unknown') {
  const cfg = getActiveTagset();

  console.groupCollapsed(`[tagset] ${where}`);
  if (!cfg) {
    console.warn('[tagset] no active config');
    console.groupEnd();
    return;
  }

  console.log('id:', cfg.id);
  console.log('label:', cfg.label);
  console.log('lang:', cfg.lang);
  console.log('tagFormat:', cfg.tagFormat);
  console.log('hasMorph:', cfg.hasMorph);
  console.log('_sourceDistFile:', cfg._sourceDistFile);

  console.log('posCategories:', cfg.posCategories?.length ?? 0);
  console.log('relations:', cfg.relations ? Object.keys(cfg.relations).length : 0);

  // Show a quick sample of POS meta (first ~10)
  const sample = (cfg.posCategories || []).slice(0, 10).map(p => ({
    postag: p.postag,
    short: p.short,
    long: p.long,
    color: p.color,
  }));
  console.table(sample);

  // Sanity checks for common ALDT chars
  console.log("meta('n'):", getPosMeta('n'));
  console.log("meta('v'):", getPosMeta('v'));
  console.log("meta('c'):", getPosMeta('c'));

  console.groupEnd();
}

async function restoreTagsetFromStorage() {
  // console.log('[tagset] restoreTagsetFromStorage() running');

  const id = localStorage.getItem('activeTagsetId');
  // console.log('[tagset] stored id =', id);
  if (!id) return;

  const entry = getRegistryEntry(id);
  // console.log('[tagset] registry entry =', entry);
  if (!entry) return;

  console.log('[tagset] distFile =', entry.distFile);

  const cfg = await loadTagsetConfig(entry.distFile, entry);
  if (!cfg) return;

  // attach trace before storing
  cfg._sourceDistFile = entry.distFile;

  setActiveTagset(cfg);
  // logActiveTagset('after restoreTagsetFromStorage');

  console.log('[tagset] loaded cfg =', cfg);
  console.log('[tagset] active set to', cfg.id);
}

/* ============================================================================
    INITIALIZATION ENTRY POINT
   ============================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  let initializedFromUserInput = false;
  await restoreTagsetFromStorage();
  setLanguage(localStorage.getItem("textLanguage") || "grc");
  const userInput = sessionStorage.getItem("userInput");

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
  setupNoneButton();
  setupUnusedButton();
  setupHighlightButton();
  setupaT();
});
