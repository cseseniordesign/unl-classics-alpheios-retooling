/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Polyfill structuredClone for Jest if missing
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

import { undoButton, saveState, clearStacks, undoStack, redoStack } from '../xml/undo.js';

describe("undoButton", () => {
  beforeEach(() => {
    clearStacks();
    window.treebankData = [];
    window.currentIndex = 0;
  });

  test ("does nothing if no changes are made to the heads", () => {
    undoButton();
    
    // Expect treebankData to stay the same
    expect(window.treebankData).toEqual([]);

    // Undo stack should be empty 
    expect(undoStack.length).toBe(0);

    // Redo stack should contain the mutated state
    expect(redoStack.length).toBe(0);
  })

  test("restores previous state and updates stacks after one change" , () => {
    saveState();  
    //mutate treebank
    window.treebankData = [{ id: "1", value: 1 }];

    // Perform undo
    undoButton();

    // Expect treebankData restored to original
    expect(window.treebankData).toEqual([]);

    // Undo stack should now be empty
    expect(undoStack.length).toBe(0);

    // Redo stack should contain the mutated state
    expect(redoStack.length).toBe(1);
    expect(redoStack[0]).toEqual([{ id: "1", value: 1 }]);
  });

  test("restores previous state and updates stacks after two changes and one undo", () => {
    saveState();

    // Mutate treebankData
    window.treebankData = [{ id: "1", value: 1 }];
    
    saveState();

    // Mutate treebankData
    window.treebankData = [{ id: "1", value: 2 }];

    // Perform undo
    undoButton();

    // Expect treebankData restored to previous version
    expect(window.treebankData).toEqual([{ id: "1", value: 1 }]);

    // Undo stack should now be one
    expect(undoStack.length).toBe(1);

    // Redo stack should contain the mutated state
    expect(redoStack.length).toBe(1);
    expect(redoStack[0]).toEqual([{ id: "1", value: 2 }]);
  });

  test("restores to correct state and updates stacks after two changes and undo clicked twice", () => {
    saveState();
    
    // Mutate treebankData
    window.treebankData = [{ id: "1", value: 1 }];
    
    saveState();

    // Mutate treebankData
    window.treebankData = [{ id: "1", value: 2 }];

    // Perform undo
    undoButton();
    undoButton();

    // Expect treebankData restored to empty version
    expect(window.treebankData).toEqual([]);

    // Undo stack should now be empty
    expect(undoStack.length).toBe(0);

    // Redo stack should contain two mutated states
    expect(redoStack.length).toBe(2);
    expect(redoStack).toEqual([
    [{ id: "1", value: 2 }],
    [{ id: "1", value: 1 }]
  ]);

  });
});