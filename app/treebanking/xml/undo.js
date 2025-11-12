import { createNodeHierarchy } from '../tree/treeRender.js';
import { triggerAutoSave } from '../xml/saveXML.js';

/*
*
* The following code block implements undo and redo functionality
* for the treebanking application. It maintains two stacks to track
* changes to the tree structure, allowing users to revert or reapply
* modifications as needed. In order for the stacks to be properly mantained,
* there needs to be calls to saveState() function whenever a change is made to the tree.
*
* Samuel DuBois 2025 10 28
*/
let undoStack = [];
let redoStack = [];

// This function will copy the current state of the tree.
export function saveState() {
    undoStack.push(structuredClone(window.treebankData));
    redoStack = [];
}

// This function will revert the tree to its previous state.
export function undoButton(){
    if (undoStack.length === 0) return;
    alert("Oops! This functionality is still under construction. Please check back soon!");
    redoStack.push(structuredClone(window.treebankData));
    window.treebankData = undoStack.pop();
    triggerAutoSave();
    // TODO: LOAD IN THE NEW TREE;
    createNodeHierarchy(window.currentIndex);
    return;
}


// // This function will revert the tree to its previous change.
// function redoButton(){
//   if (redoStack.length === 0) return;

//   undoStack.push(structuredClone(treeState));
//   treeState = redoStack.pop();
//   renderTree(treeState);
// }

// // This is the event for the redo button.
// document.addEventListener("DOMContentLoaded", () => {
//   // Specify the button you are going to listen for
//   const button = document.getElementById("redo");

//   // Add the event listener to the button you are listening for.
//   button.addEventListener("click", async () => {
//     alert("Oops! This functionality is still under construction. Please check back soon!");
//     redoButton()
//   });
// });


// document.addEventListener("DOMContentLoaded", () => {
//   const button = document.getElementById("save");

//   button.addEventListener("click", async () => {
//     alert("Oops! This functionality is still under construction. Please check back soon!");
//   });
// });