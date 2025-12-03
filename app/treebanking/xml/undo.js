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
*/

// Initalize undo and redo stacks
export let undoStack = [];
export let redoStack = [];


/*
*
* This will save the current state of the treebank data to the undo stack. It also clears the redo stack
* since new changes invalidate the redo history.
*
*/
export function saveState() {
    undoStack.push(structuredClone(window.treebankData));
    redoStack = [];
    return;
}


/*
*
* This is the implementation of the undo button functionality. It will
* push to the redo stack the current state of the tree and then load the
* popped tree from the undo stack.
*
*/
export function undoButton(){
    console.log(undoStack)
    if (undoStack.length === 0) return;
    redoStack.push(structuredClone(window.treebankData));
    window.treebankData = undoStack.pop();
    triggerAutoSave();
    createNodeHierarchy(window.currentIndex);
    return;
}


/*
*
* This is the implementation of the redo button functionality. It will
* push to the undo stack the current state of the tree and then load the
* popped tree from the redo stack.
*
*/
export function redoButton(){
   if (redoStack.length === 0) return;
   undoStack.push(structuredClone(window.treebankData));
   window.treebankData = redoStack.pop();
   triggerAutoSave();
   createNodeHierarchy(window.currentIndex);
   return;
}


/*
*
* This function will clear both the undo and redo stacks. This function should be
* called when loading a new treebank or creating a new treebank to prevent invalid
* states from being restored.
*
*/
export function clearStacks() {
    undoStack = []
    redoStack = []
}