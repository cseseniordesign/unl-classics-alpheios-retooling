import { showToast } from '../main.js'

// Attach click event after input page loads for the edit button
document.getElementById("editBtn").addEventListener("click", sendSentence);

/**
 * --------------------------------------------------------------------------
 * FUNCTION: sendSentence
 * --------------------------------------------------------------------------
 * Sends input sentence to the treebanking page
 */
function sendSentence() {
  const input = document.getElementById("input-text").value.trim();
  if (!input) {
    showToast("Please input a sentence.");
    return;
  }
  // redirect to treebanking page and pass the sentence through the URL
  window.location.href = "treebanking.html?sentence=" + encodeURIComponent(input);
}
