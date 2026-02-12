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
                    <input class = "token-input" type="text">
                    <div class="checkbox-wrapper">
                        <input type="checkbox">
                    </div>
                </div>
                
                <div class="keyboard-container">
                  <div class="simple-keyboard"></div>
                </div>              

                <label for="form">by Form</label>
                <div class="input-container">
                    <input class = "form-input" type="text">
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
                <ul class = "found-tokens">
                </ul>
  `;
  updateFoundTokens();
  handleTokens();
  handleForm();
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
        
        const currentLayout = keyboard.options.layoutName;
        
        // Handle shift toggle
        if (button === "{shift}" || button === "{lock}") {
          let shiftToggle;
          
          if (currentLayout === "default") {
            shiftToggle = "shift";
          } else if (currentLayout === "shift") {
            shiftToggle = "default";
          } else if (currentLayout === "diacritics") {
            shiftToggle = "diacritics-shift";
          } else if (currentLayout === "diacritics-shift") {
            shiftToggle = "diacritics";
          }
          
          keyboard.setOptions({
            layoutName: shiftToggle
          });
        }
        
        // Handle diacritics toggle
        if (button === "{diacritics}") {
          keyboard.setOptions({
            layoutName: "diacritics"
          });
        }
        
        // Handle diacritics-shift toggle
        if (button === "{diacritics-shift}") {
          keyboard.setOptions({
            layoutName: "diacritics-shift"
          });
        }
        
        // Handle return to default
        if (button === "{default}") {
          keyboard.setOptions({
            layoutName: "default"
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
    // GREEK with comprehensive diacritics
    return {
      layout: {
        default: [
          "ς ε ρ τ υ θ ι ο π {bksp}",
          "α σ δ φ γ η ξ κ λ",
          "ζ χ ψ ω β ν μ , .",
          "{diacritics} {space} {shift}"
        ],
        shift: [
          "Σ Ε Ρ Τ Υ Θ Ι Ο Π {bksp}",
          "Α Σ Δ Φ Γ Η Ξ Κ Λ",
          "Ζ Χ Ψ Ω Β Ν Μ , .",
          "{diacritics} {space} {shift}"
        ],
        diacritics: [
          "ά έ ή ί ό ύ ώ ϊ ϋ {bksp}",
          "ἀ ἁ ἂ ἃ ἄ ἅ ἆ ἇ ᾀ ᾁ",
          "ᾂ ᾃ ᾄ ᾅ ᾆ ᾇ ᾐ ᾑ ᾒ ᾓ",
          "ᾔ ᾕ ᾖ ᾗ ᾠ ᾡ ᾢ ᾣ ᾤ ᾥ",
          "ᾦ ᾧ ᾰ ᾱ ᾲ ᾳ ᾴ ᾶ ᾷ ὲ",
          "ὴ ῂ ῃ ῄ ῆ ῇ ῐ ῑ ῒ ΐ",
          "ῖ ῗ ῠ ῡ ῢ ΰ ῤ ῥ ῦ ῧ",
          "ῲ ῳ ῴ ῶ ῷ ὸ ὐ ὑ ὒ ὓ",
          "ὔ ὕ ὖ ὗ",
          "{default} {space} {shift}"
        ],
        "diacritics-shift": [
          "Ά Έ Ή Ί Ό Ύ Ώ Ϊ Ϋ {bksp}",
          "Ἀ Ἁ Ἂ Ἃ Ἄ Ἅ Ἆ Ἇ ᾈ ᾉ",
          "ᾊ ᾋ ᾌ ᾍ ᾎ ᾏ ᾘ ᾙ ᾚ ᾛ",
          "ᾜ ᾝ ᾞ ᾟ ᾨ ᾩ ᾪ ᾫ ᾬ ᾭ",
          "ᾮ ᾯ Ᾰ Ᾱ Ὰ Ά ᾼ Ὲ Έ Ὴ",
          "Ή ῌ Ῐ Ῑ Ὶ Ί Ῠ Ῡ Ὺ Ύ",
          "Ῥ ῼ Ὸ Ό Ὑ Ὓ Ὕ Ὗ",
          "{default} {space} {shift}"
        ]
      },
      display: {
        "{bksp}": "⌫",
        "{shift}": "⇧",
        "{lock}": "⇪",
        "{space}": "Space",
        "{diacritics}": "◌́◌̀",
        "{diacritics-shift}": "◌́◌̀",
        "{default}": "ABC"
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
  } else if (language == 'lat') {
    // Latin keyboard with macrons
    return {
      layout: {
        default: [
          "q w e r t y u i o p {bksp}",
          "a s d f g h j k l",
          "z x c v b n m",
          "ā ē ī ō ū",
          "{space} {shift}"
        ],
        shift: [
          "Q W E R T Y U I O P {bksp}",
          "A S D F G H J K L",
          "Z X C V B N M",
          "Ā Ē Ī Ō Ū",
          "{space} {shift}"
        ]
      },
      display: {
        "{bksp}": "⌫",
        "{shift}": "⇧",
        "{lock}": "⇪",
        "{space}": "Space"
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
        window.batchSelection.add(id); // Store the ID for the movement logic
        token.classList.add("selected");
        const node = document.querySelector(`.node[id="${id}"]`);
        updateFoundTokens();
        if (node) d3.select(node).classed("selected", true);
      } else {
        token.classList.remove("selected");
        const node = document.querySelector(`.node[id="${id}"]`);
        if (node) d3.select(node).classed("selected", false);
      }
    });
  }
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: handleForm
 * --------------------------------------------------------------------------
 * Handles the selection by form and highlights corresponding tokens/nodes
 * --------------------------------------------------------------------------
 */

function handleForm() {
  const formInput = document.querySelector(".form-input");
  const tokens = document.querySelectorAll(".token");
  if (window.formInputValue) {
    formInput.value += window.formInputValue;
    updateSelection(formInput.value.toLowerCase());
  }
  formInput.addEventListener("input", () => {
    // Save the raw string to persistence
    window.formInputValue = formInput.value;
    updateSelection(formInput.value.toLowerCase());
  });

  function updateSelection(currentValue) {
    const formsArr = currentValue.split(" ").filter(t => t !== "");
    window.batchSelection.clear();
    tokens.forEach(token => {
      const id = token.dataset.wordId;
      const sentences = Array.isArray(window.treebankData) ? window.treebankData : [];
      const currentSentence = sentences.find(s => s.id === String(window.currentIndex));
      const word = currentSentence?.words?.find(w => String(w.id) === String(id));
      const form = formParser(word.postag[0]);
      if (formsArr.includes(form)) {
        updateFoundTokens()
        window.batchSelection.add(id); // Store the ID for the movement logic
        token.classList.add("selected");
        const node = document.querySelector(`.node[id="${id}"]`);
        if (node) d3.select(node).classed("selected", true);
      } else {
        token.classList.remove("selected");
        const node = document.querySelector(`.node[id="${id}"]`);
        if (node) d3.select(node).classed("selected", false);
        updateFoundTokens()
      }
    });
  }
} 

/**
 * --------------------------------------------------------------------------
 * FUNCTION: formParser
 * --------------------------------------------------------------------------
 * converts the postag to corresponding part of speach
 * --------------------------------------------------------------------------
 */
function formParser(posChar) {
  switch (posChar) {
    case 'v':
      return 'verb';
    case 'p':
      return 'pron';
    case 'n':
      return 'noun';
    case 'l':
      return 'art';

    // ========================
    //     ADJECTIVE  (a)
    // ========================
    case 'a':
      return 'adj';

    // ========================
    //      NUMERAL (m)
    // ========================
    case 'm':
      return 'num';

    // ========================
    //      ADVERB  (d)
    // ========================
    case 'd':
      return 'adv';

    // ========================
    //  Conjunction (c),
    //  Adposition (r),
    //  Interjection (i),
    //  Punctuation/Unknown (u)
    // ========================
    case 'c':
      return 'conj';
    case 'r':
      return 'adp';
    case 'i':
      return 'int';
    case 'u':
      return 'pun'

    // ========================
    //     DEFAULT / UNKNOWN
    // ========================
    default:
      return 'unknown'
}
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: updateFoundTokens
 * --------------------------------------------------------------------------
 * Updates list of found tokens
 * --------------------------------------------------------------------------
 */
export function updateFoundTokens() {
  let wordsArr = [];
  // if in the selection tab
  if (inSelection) {
    const foundTokenList = document.querySelector(".found-tokens");
    //reset the found tokens
    foundTokenList.replaceChildren();
    const sentences = Array.isArray(window.treebankData) ? window.treebankData : [];
    const currentSentence = sentences.find(s => s.id === String(window.currentIndex));
    window.batchSelection.forEach((id) => {
      const word = currentSentence?.words?.find(w => String(w.id) === String(id));
      if (!word || wordsArr.includes(word.form)) return; 
      wordsArr.push(word.form);
      const tokenButton = document.createElement('button');
      tokenButton.textContent = word.form;
      tokenButton.className = "batch-token-btn"; 
      const listItem = document.createElement('li');
      listItem.append(tokenButton);
      foundTokenList.append(listItem);
      tokenButton.addEventListener("click", () => (removeTokenButton(word.form)));
  });
    }
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: removeTokenButton
 * --------------------------------------------------------------------------
 * Removes selection of the tokens/nodes 
 * associated with the clicked token button
 * --------------------------------------------------------------------------
 */
function removeTokenButton(targetForm) {
  const sentences = Array.isArray(window.treebankData) ? window.treebankData : [];
  const currentSentence = sentences.find(s => s.id === String(window.currentIndex));
  const currentBatchIds = [...window.batchSelection];
  currentBatchIds.forEach((batchId) => {  
  const batchWord = currentSentence?.words?.find(w => String(w.id) === String(batchId));
  if (batchWord.form == targetForm) {
    window.batchSelection.delete(batchId)
    const token = document.querySelector(`.token[data-word-id="${batchId}"]`)
    if (token) token.classList.remove("selected");
    const node = document.querySelector(`.node[id="${batchId}"]`);
    if (node) d3.select(node).classed("selected", false);} 
  })  
  updateFoundTokens();
}
    