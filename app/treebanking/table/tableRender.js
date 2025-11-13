import { prepareSentenceData } from "../tree/treeRender.js";
import { displaySentence } from "../ui/sentenceDisplay.js";
import { hideTree, displayTree } from "../tree/treeRender.js";

/**
 * --------------------------------------------------------------------------
 * FUNCTION: createTable
 * --------------------------------------------------------------------------
 * Creates a table of the aspects of the sentence that
 * is currently being displayed on the application
 *
 * @param {Int} sentenceId - Integer describing the id of the current sentence being displayed
 * @returns {} 
 */
export function createTable(sentenceId) {
    const data = window.treebankData;
    if (!data) return;

    // Locate the specific sentence object using its ID
    const sentence = data.find(s => s.id === `${sentenceId}`);
    if (!sentence) {
        console.error(`Sentence with id=${sentenceId} not found.`);
        return;
    }

    // Transform the sentence into a flat array of {id, parentId, form, relation}
    const idParentPairs = prepareSentenceData(sentence);

    hideTree();
    displayTable(idParentPairs);
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: switchToTable
 * --------------------------------------------------------------------------
 * Destroys the table being displayed, and
 * Unhides the current tree.
 *
 * @param {}
 * @returns {} 
 */
export function switchToTree() {
    const table = document.querySelector("#sandbox table");
    table.remove();
    displayTree();
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: displayTable
 * --------------------------------------------------------------------------
 * Destroys the table being displayed, and
 * Unhides the current tree.
 *
 * @param {Object} SentenceValues - Object containing each word and its elements from a sentence 
 * @returns {} 
 */
function displayTable(sentenceValues) {
    const tableContainer = document.getElementById("sandbox");
    const table = document.createElement("table");

    // Create header row
    const header = table.insertRow();
    const headers = Object.keys(sentenceValues[0]);
    headers.forEach(key => {
    const th = document.createElement("th");
    th.textContent = key;
    header.appendChild(th);
    });

    // Create data rows
    sentenceValues.forEach(rowData => {
    const row = table.insertRow();
    headers.forEach(key => {
        const cell = row.insertCell();
        cell.textContent = rowData[key];
    });
    });

    // Append the table to the container
    tableContainer.appendChild(table);
}
