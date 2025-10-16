import parseTreeBankXML from './parser.js'
/**
 * This function handles the XML file selector and currently
 * just returns the file. It is possible to instead of returning,
 * having the function call another and passing in file while
 * doing so. Because this is called by an event. It is the first
 * step and might not want to finish right away.
 * @returns file
 */
function getLocalTreebankXML() {
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];

    //THIS WILL NOT ALWAYS RETURN, IT WILL
    //FUNNEL INTO ANOTHER FUNCTION
    //DELTE THIS COMMENT WHEN THAT IS DONE.
    return file;
}

// parses treebank.xml 
// adds the words to the main page
const tokenizedSentence = document.getElementById('tokenized-sentence');
fetch('/assets/treebank.xml')
.then(response=> response.text())
.then(xmlText=> {
  // Parse XML into a list of word objects
  const data = parseTreeBankXML(xmlText);

  // Ensures only one sentence is displayed at a time
  tokenizedSentence.textContent = "";

  //gets sentence with a certain id
  //should change to start with 1 and decrement/increment by users command
  const sentence = data.find(sentence=> sentence.id === "1");

  //need a way to track sentence bounds 
  //so user can't go outside of them
  if (sentence === undefined) {
    alert("No sentence found!")
  }
  else {
    // Display each word's form on the page
    sentence.words.forEach((word)=> {
    tokenizedSentence.append(`${word.form} `);
  })
  }

})
// Error handling to catch XML load or network issues
.catch(err => console.error("Error loading XML:", err));


// NEEDS TO SAVE THE FILE FROM parseTreeBAnkXML not working yet
function saveLocal() {
  if (confirm("Would you like to save this treebank?")) {
    const doctype = new XMLSerializer().serializeToString(document.doctype);
    const html = document.documentElement.outerHTML;
    const fullHTML = doctype + "\n" + html;

    const blob = new Blob([fullHTML], { type: "text/html" });
    const fileName = "Treebank.html";
    const el = document.createElement('a');
    el.href = URL.createObjectURL(blob);
    el.download = fileName;

    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
    URL.revokeObjectURL(el.href);
  }
}

// Find the save button once the page has loaded
document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("save");
  button.addEventListener("click", saveLocal);
});

/**
 * Vertical resize interaction
 * 
 * This adds interactivity to the handle between the sentence
 * and the tree view. Users can drag it to resize the sentence box
 * vertically while the tree-bank area automatically adjusts.
 */
const treeView = document.getElementById("tree-view");
const sentenceBox = document.getElementById("sentence");
const treeBox = document.getElementById("tree-bank");
const resizeHandle = document.getElementById("resize-handle");

let isResizing = false;
let startY;
let startHeight;

// When the user clicks and holds the resize bar
resizeHandle.addEventListener("mousedown", (e) => {
  isResizing = true;
  startY = e.clientY;
  startHeight = sentenceBox.offsetHeight;
  document.body.style.cursor = "ns-resize";
  e.preventDefault();
});

// When the user moves the mouse while resizing
document.addEventListener("mousemove", (e) => {
  if (!isResizing) return;
  const dy = e.clientY - startY;
  const newHeight = startHeight + dy;
  const parentHeight = treeView.offsetHeight;

  const minHeight = 50;
  const contentHeight = sentenceBox.scrollHeight; // actual content height
  const maxHeight = parentHeight * 0.85;          // safety buffer to prevent tree from being covered completely

  // Apply the heigh within limits
  if (newHeight >= minHeight && newHeight <= maxHeight) {
    sentenceBox.style.height = `${newHeight}px`;
    // switch between scroll and visible mode depending on available space
    sentenceBox.style.overflowY = newHeight < contentHeight ? "auto" : "visible";
  }
});

// When the user releases the mouse
document.addEventListener("mouseup", () => {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = "default";
  }
});
