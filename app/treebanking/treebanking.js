/**
 * This function handles the XML file selector and currently
 * just returns the file. It is possible to instead of returning,
 * having the function call another and passing in file while
 * doing so. Because this is called by an event. It is the first
 * step and might not want to finish right away.
 * @returns file
 */
import parseTreeBankXML from './parser.js'
function getLocalTreebankXML() {
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];

    //THIS WILL NOT ALWAYS RETURN, IT WILL
    //FUNNEL INTO ANOTHER FUNCTION
    //DELTE THIS COMMENT WHEN THAT IS DONE.
    return file;
}

//parses treebank.xml 
// adds the words to the main page
const tokenizedSentence = document.getElementById('tokenized-sentence');
fetch('/assets/treebank.xml')
.then(response=> response.text())
.then(xmlText=> {
  const words = parseTreeBankXML(xmlText);
  words.forEach((word)=> {
    tokenizedSentence.append(`${word.word} `);
  })
})


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
