import { showToast } from '/main.js'

// Attach click event after input page loads for the edit button
document.getElementById("editBtn").addEventListener("click", sendSentence);

/**
 * --------------------------------------------------------------------------
 * FUNCTION: sendSentence
 * --------------------------------------------------------------------------
 * Sends input sentence to the treebanking page
 * 
 * @param {}
 * @returns {} 
 */
function sendSentence() {
  const input = document.getElementById("input-text").value.trim();

  if (!input) {
    showToast("Please input a sentence.");
    return;
  }

  //Gather the selections for sentence language and direction, will
  //not let user continue if not selected.
  const direction = document.querySelector('input[name="direction"]:checked');
  const language = document.querySelector('input[name="lang"]:checked');
  if(language == null){
    showToast("Please select a sentence language.");
    return;
  }
  if(direction == null){
    showToast("Please select a sentence direction.");
    return;
  }
  localStorage.setItem("textDirection", direction.value);
  localStorage.setItem("textLanguage", language.value);

  // pass the sentence and redirect to treebanking page
  sessionStorage.setItem("userInput", input);
  window.location.href = "treebanking.html";
}
