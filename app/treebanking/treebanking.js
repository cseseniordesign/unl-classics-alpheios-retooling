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
