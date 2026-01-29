/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupSelector
 * --------------------------------------------------------------------------
 * Enables the "Selector" tab on the right-hand toolbar.
 * --------------------------------------------------------------------------
 */

export function setupSelector() {
  const selectBtn = document.getElementById("selector");
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
      toolBody.innerHTML =
        '<p>Treebanking mode: click a word or node to edit dependencies.</p>';
    }
  };

  // Handle the "Turn Off" toggle
  if (wasActive) {
    window.closeSelector();
    return; // Stop execution here
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
  tokenInput.addEventListener("input", ()=>{
    const tokensArr = tokenInput.value.split(" ");
    tokens.forEach(token => {
      if (tokensArr.includes(token.textContent.trim())) {
        const id = token.dataset.wordId;
        //the selected classlist sets the background to yellow
        token.classList.add("selected");
        // get corresponding node and add class list selected
        const node = document.querySelector(`.node[id="${id}"]`);
        node.classList.add("selected");
      }
      //checks if words are removed from the input
      else if (!tokensArr.includes(token.textContent.trim()) && token.classList.contains("selected")) {
        const id = token.dataset.wordId;
        token.classList.remove("selected");
        const node = document.querySelector(`.node[id="${id}"]`);
        node.classList.remove("selected");
      }
    });
  });
}
