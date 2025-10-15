/**
 * This function handles parsing of the XML file 
 * It takes in xmlString from an XML file and parses the text
 * 
 * @returns an array of word objects
 */
export default function parseTreeBankXML(xmlString) {
  const parser = new DOMParser();

  //parses an XML file's text and returns a document
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");
  
  const sentence = xmlDoc.querySelector("sentence");
  console.log(sentence)
  let words = Array.from(sentence.querySelectorAll("word"));
  words = words.map(word=> ({
    word: word.getAttribute("form")
  }));
  return words;


}