import { updateTreebankSelectionBanner} from '../ui/sentenceDisplay.js'
/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupSelector
 * --------------------------------------------------------------------------
 * Enables the "Selector" tab on the right-hand toolbar.
 * --------------------------------------------------------------------------
 */

export function setupSelector() {
  const selectBtn = document.getElementById("selector");
  if (!selectBtn) return;
  selectBtn.onmouseover = null;

  // Open/toggle ONLY on click
  selectBtn.addEventListener("click", handleSelectClick);
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: handleSelectClick
 * --------------------------------------------------------------------------
 * Handles the selector button and the tool section 
 * --------------------------------------------------------------------------
 */

function handleSelectClick() {
  window.inSelection = true;
  const selectBtn = document.getElementById("selector");
  const wasActive = selectBtn.classList.contains("active");
  const toolBody = document.getElementById("tool-body");
  // public closer 
  window.closeSelector = function () {
    selectBtn.classList.remove("active");
    selectBtn.style.backgroundColor = '#4e6476';
    // Back to treebanking mode UI
    if (window.treebankModeHTML) {
      toolBody.innerHTML = window.treebankModeHTML;
    } else {
      window.inSelection = false;
      toolBody.innerHTML =
        '<p>Treebanking mode: click a word or node to edit dependencies.</p>';
        updateTreebankSelectionBanner();
    }
  };

  // Handle the "Turn Off" toggle
  if (wasActive) {
    window.closeSelector();
    return; 
  }

  // Clear other buttons first
  const allButtons = document.querySelectorAll("#toolbar button");
  allButtons.forEach(btn => {
    btn.classList.remove("active");
    btn.style.backgroundColor = '#4e6476';
  });

  selectBtn.classList.add("active");
  selectBtn.style.backgroundColor = 'green';

  //update tool body to reflect selector option
  toolBody.innerHTML = `
   <label for="token">by token</label>
                <div class="input-container">
                    <input class = "token-input" type="text">
                    <div class="checkbox-wrapper">
                        <input type="checkbox">
                    </div>
                </div>
                <!--Add keyboard for languages here-->
                <label for="form">by Form</label>
                <div class="input-container">
                    <input type="text">
                    <div class="checkbox-wrapper">
                        <input type="checkbox">
                    </div>
                </div>
                <label for="label">by label</label>
                <!--FIll the dropdown accordingly-->
                <div class="label-dropdown">
                    <select name="" id="">
                        <option value=""></option>
                    </select>
                    <select name="" id=""></select>
                </div>
                <p>Found Tokens</p>
                <ul className = "found-tokens">
                </ul>
  `
  handleTokens();
} 

/**
 * --------------------------------------------------------------------------
 * FUNCTION: handleTokens
 * --------------------------------------------------------------------------
 * Handles the selection of tokens and highlights corresponding tokens/nodes
 * --------------------------------------------------------------------------
 */

function handleTokens() {
  const tokenInput = document.querySelector(".token-input");
  const tokens = document.querySelectorAll(".token");
  if (window.selectorInputValue) {
    tokenInput.value += window.selectorInputValue;
    updateSelection(tokenInput.value.toLowerCase());
  }
  tokenInput.addEventListener("input", () => {
    // Save the raw string to persistence
    window.selectorInputValue = tokenInput.value;
    updateSelection(tokenInput.value.toLowerCase());
  });

  function updateSelection(currentValue) {
    const tokensArr = currentValue.split(" ").filter(t => t !== "");
    window.batchSelection.clear();

    tokens.forEach(token => {
      const id = token.dataset.wordId;
      const text = token.textContent.trim().toLowerCase();

      if (tokensArr.includes(text)) {
        const foundTokenList = document.querySelector(".found-tokens");
        window.batchSelection.add(id); // Store the ID for the movement logic
        token.classList.add("selected");
        const node = document.querySelector(`.node[id="${id}"]`);
        if (node) d3.select(node).classed("selected", true);
      } else {
        token.classList.remove("selected");
        const node = document.querySelector(`.node[id="${id}"]`);
        if (node) d3.select(node).classed("selected", false);
      }
    });
  }
}
