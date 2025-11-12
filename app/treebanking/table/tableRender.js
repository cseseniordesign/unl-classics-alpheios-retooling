import { prepareSentenceData } from "../tree/treeRender.js";

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
    window.idParentPairs = idParentPairs;

    console.table(idParentPairs);
}