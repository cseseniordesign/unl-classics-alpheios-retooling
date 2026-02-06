import { getLanguage } from "../input/language.js";
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
                    <input id="token-input" class = "token-input" type="text">
                    <div class="checkbox-wrapper">
                        <input type="checkbox">
                    </div>
                </div>
                
                <div class="keyboard-container">
                  <!-- Keyboard will be rendered here -->
                  <div class="simple-keyboard"></div>
                </div>              

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
  `;
  handleTokens();
  
  // Wait for DOM to be ready, then check if element exists before initializing
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const keyboardDiv = document.querySelector('.simple-keyboard');
      if (keyboardDiv) {
        console.log('Keyboard div found, initializing...');
        initializeKeyboard();
      } else {
        console.error('Keyboard div not found in DOM!');
      }
    });
  });
} 

/**
 * --------------------------------------------------------------------------
 * FUNCTION: initializeKeyboard
 * --------------------------------------------------------------------------
 * Initializes the simple-keyboard instance for the token input
 * --------------------------------------------------------------------------
 */

function initializeKeyboard() {
  const tokenInput = document.querySelector(".token-input");
  const keyboardDiv = document.querySelector('.simple-keyboard');
  
  if (!keyboardDiv) {
    console.error('Cannot initialize: .simple-keyboard element not found');
    return;
  }
  
  if (!tokenInput) {
    console.error('Cannot initialize: .token-input element not found');
    return;
  }
  
  // Check if SimpleKeyboard is available in different ways
  let KeyboardConstructor = null;
  
  if (typeof window.SimpleKeyboard !== 'undefined') {
    KeyboardConstructor = window.SimpleKeyboard;
  } else if (typeof SimpleKeyboard !== 'undefined') {
    KeyboardConstructor = SimpleKeyboard;
  } else {
    console.error('SimpleKeyboard library not loaded!');
    return;
  }
  
  try {
    console.log('Creating keyboard with constructor:', KeyboardConstructor);

    const keyboardConfig = chooseKeyboard();
    
    // Initialize the keyboard - it will automatically find .simple-keyboard
    const keyboard = new KeyboardConstructor.default({
      onChange: input => {
        tokenInput.value = input;
        // Trigger the input event so handleTokens can process it
        tokenInput.dispatchEvent(new Event('input'));
      },
      onKeyPress: button => {
        console.log("Button pressed:", button);
        
        // Handle shift toggle
        if (button === "{shift}" || button === "{lock}") {
          const currentLayout = keyboard.options.layoutName;
          const shiftToggle = currentLayout === "default" ? "shift" : "default";
          
          keyboard.setOptions({
            layoutName: shiftToggle
          });
        }
      },
      theme: "hg-theme-default hg-layout-default",
      layout: keyboardConfig.layout,
      display: keyboardConfig.display
    });

    // Update keyboard when input changes (typing directly)
    tokenInput.addEventListener('input', (event) => {
      keyboard.setInput(event.target.value);
    });
    
  } catch (error) {
    console.error('Error initializing keyboard:', error);
    console.error('Error stack:', error.stack);
  }
}

function chooseKeyboard() {
 const language = getLanguage();
 if (language == 'grc') {
    // GREEK
    return {
      layout: {
        default: [
          "ς ε ρ τ υ θ ι ο π {bksp}",
          "{lock} α σ δ φ γ η ξ κ λ",
          "{shift} ζ χ ψ ω β ν μ , . {shift}",
          "{space}"
        ],
        shift: [
          "Σ Ε Ρ Τ Υ Θ Ι Ο Π {bksp}",
          "{lock} Α Σ Δ Φ Γ Η Ξ Κ Λ",
          "{shift} Ζ Χ Ψ Ω Β Ν Μ , . {shift}",
          "{space}"
        ]
      },
      display: {
        "{bksp}": "⌫",
        "{shift}": "⇧",
        "{lock}": "⇪",
        "{space}": "Space"
      }
    };
  } else if (language == 'lat') {
    // LATIN
    return {
      layout: {
        default: [
          "q w e r t y u i o p {bksp}",
          "{lock} a s d f g h j k l",
          "{shift} z x c v b n m {shift}",
          "ā ē ī ō ū {space}"
        ],
        shift: [
          "Q W E R T Y U I O P {bksp}",
          "{lock} A S D F G H J K L",
          "{shift} Z X C V B N M {shift}",
          "Ā Ē Ī Ō Ū {space}"
        ]
      },
      display: {
        "{bksp}": "⌫",
        "{shift}": "⇧",
        "{lock}": "⇪",
        "{space}": "Space"
      }
    };
  } else if (language == 'fas') {
    // PERSIAN/FARSI
    return {
      layout: {
        default: [
          "ض ص ث ق ف غ ع ه خ ح ج {bksp}",
          "{lock} ش س ی ب ل ا ت ن م ک",
          "{shift} ظ ط ز ر ذ د پ و {shift}",
          "{space}"
        ],
        shift: [
          "ۀ ٌ ٍ ً ُ ِ َ ّ ] [ {bksp}",
          "{lock} ؤ ئ ي إ أ آ ة » « :",
          "{shift} ك ژ ٰ ٓ ٔ ؛ ء ، {shift}",
          "{space}"
        ]
      },
      display: {
        "{bksp}": "⌫",
        "{shift}": "⇧",
        "{lock}": "⇪",
        "{space}": "فاصله"
      }
    };
  } else if (language == 'ara') {
    // ARABIC
    return {
      layout: {
        default: [
          "ض ص ث ق ف غ ع ه خ ح ج {bksp}",
          "{lock} ش س ي ب ل ا ت ن م ك",
          "{shift} ئ ء ؤ ر ى ة و ز ظ ط {shift}",
          "{space}"
        ],
        shift: [
          "َ ً ُ ٌ ِ ٍ ّ ْ ] [ {bksp}",
          "{lock} \\ ٰ ٓ ٔ لأ أ ـ ، / :",
          "{shift} ~ } { لإ إ ' × ؛ < > {shift}",
          "{space}"
        ]
      },
      display: {
        "{bksp}": "⌫",
        "{shift}": "⇧",
        "{lock}": "⇪",
        "{space}": "مسافة"
      }
    };
  } else {
    // ENGLISH/DEFAULT
    return {
      layout: {
        default: [
          "q w e r t y u i o p {bksp}",
          "{lock} a s d f g h j k l",
          "{shift} z x c v b n m , . {shift}",
          "{space}"
        ],
        shift: [
          "Q W E R T Y U I O P {bksp}",
          "{lock} A S D F G H J K L",
          "{shift} Z X C V B N M , . {shift}",
          "{space}"
        ]
      },
      display: {
        "{bksp}": "⌫",
        "{shift}": "⇧",
        "{lock}": "⇪",
        "{space}": "Space"
        }
    };
  }
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