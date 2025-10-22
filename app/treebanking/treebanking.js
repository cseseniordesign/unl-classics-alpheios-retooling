import parseTreeBankXML from './parser.js'


// NEEDS TO SAVE THE FILE FROM parseTreeBAnkXML not working yet
/*
* parses treebank.xml 
* adds the words to the main page
*/
 window.displaySentence = async function(index){
  const tokenizedSentence = document.getElementById('tokenized-sentence');

  // Parse XML into a list of word objects
  const data = await loadTreebankData('../../assets/treebank.xml');

  // Ensures only one sentence is displayed at a time
  tokenizedSentence.textContent = "";

  //Number of sentences
  window.totalSentences = data.length;

  //ensures displayed sentence stays within boundaries
  if (index <= 1 ) index = 1;
  if (index >= totalSentences) index = totalSentences -1;

  window.currentIndex = index;

  //gets sentence with a certain id
  //should change to start with 1 and decrement/increment by users command
  const sentence = data.find(sentence=> sentence.id === `${index}`);

    if (!sentence) {
      console.warn(`Sentence with id=${index} not found.`);
      return;
    }

  // Display each word's form on the page
  sentence.words.forEach((word)=> {
  tokenizedSentence.append(`${word.form} `);
  })

  createNodeHierarchy(window.currentIndex);

}

displaySentence(1);



// NEEDS TO SAVE THE FILE FROM parseTreeBAnkXML not working yet
/*
*   This function is used to save the file from parseTreeBankXML
*   to the local system of the user.
*/
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

async function loadTreebankData(filepath){
  const response = await fetch(filepath);
  const xmlText = await response.text();
  const data = parseTreeBankXML(xmlText);
  return data;
}

/**
 * This function takes in a sentenceId, and returns a d3
 * hierarchy that contains a synthetic root with all nodes
 * hanging underneath it. the objects in the hierarchy only
 * contain the word's <id> and <head>.
 * @param {*} sentenceId 
 */
async function createNodeHierarchy(sentenceId) {
  const data = await loadTreebankData('../../assets/treebank.xml');
  const sentence = data.find(sentence => sentence.id === `${sentenceId}`);

  const idParentPairs = sentence.words.map(wordNode => ({
    id: String(wordNode.id),
    //change root nodes to have their parent point to a synthetic root
    parentId: (wordNode.head === 0 || wordNode.head === '0' || wordNode.head === null) ? 'root' : String(wordNode.head)
  }));

  // Add synthetic root
  idParentPairs.push({
    id: 'root',
    parentId: null
  });

  console.table(idParentPairs);

  const root = d3.stratify()
    .id(d => d.id)
    .parentId(d => d.parentId)
    (idParentPairs);

  return root;
}