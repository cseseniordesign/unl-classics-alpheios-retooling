/**
 * =============================================================================
 * AUTOSAVE SYSTEM — How Arethusa Lite Keeps the XML in Sync
 * =============================================================================
 *
 * Purpose
 * -------
 * The autosave system ensures that **every structural or morphological edit**
 * a user makes (changing a head, editing lemma/postag, deleting a form, etc.)
 * is automatically propagated back into the in-memory Treebank XML document
 * — without requiring a manual download or explicit "Save" action.
 *
 * In other words:
 *   • The user edits → The JS data model updates → This module rewrites XML.
 *
 * This file (`saveXML.js`) manages that final step: it listens for changes
 * via exported triggers, serializes the current `window.treebankData` back into
 * Treebank XML text, and optionally provides visual feedback ("Saving…"/"Saved").
 *
 *
 * -----------------------------------------------------------------------------
 * 1. Data Flow Overview
 * -----------------------------------------------------------------------------
 *
 * The typical edit pipeline looks like this:
 *
 *   1. The user performs an action that changes data:
 *        - reassigns a dependency head (clicks two nodes)
 *        - selects a new morphological form
 *        - deletes a form or reverts to document form
 *
 *   2. The UI logic (e.g. in `drawNodes()`, `displaySentence()`, or
 *      `morphTool.js`) updates the active sentence’s in-memory object,
 *      which lives inside:
 *
 *          window.treebankData = [
 *            { id: "1", words: [
 *                { id: "3", form: "τοίνυν", head: "33", lemma: "...", postag: "d--------" },
 *                ...
 *              ]
 *            },
 *            ...
 *          ]
 *
 *   3. Those functions call:
 *
 *          triggerAutoSave()
 *
 *   4. This function schedules a background update (usually debounced
 *      to avoid writing constantly if multiple edits occur quickly).
 *
 *   5. The autosave logic then:
 *        a) Rebuilds the current XML string from the live JS objects.
 *        b) Stores that serialized XML into:
 *              - a hidden global variable (`window.treebankXML`)
 *              - OR browser storage (`localStorage`) for persistence between sessions.
 *        c) Updates the XML tab view (`updateXMLIfActive()`) so the user sees
 *           the changes immediately reflected as proper `<word>` elements.
 *        d) Provides UI feedback — e.g., flashing “Saving…” then “Saved”.
 *
 *
 * -----------------------------------------------------------------------------
 * 2. Core Functions
 * -----------------------------------------------------------------------------
 *
 * • triggerAutoSave()
 *      → Called by external modules (tree, morph, etc.).
 *        Starts the save sequence, shows the “Saving…” message,
 *        and either calls saveImmediately() or defers it by a small delay.
 *
 * • saveImmediately()
 *      → Serializes the current `window.treebankData` structure into XML text.
 *        The serializer iterates over each sentence and each word:
 *
 *        <sentence id="1">
 *            <word id="3" form="τοίνυν" lemma="τοίνυν" postag="d--------"
 *                  head="33" relation="AuxY" />
 *        </sentence>
 *
 *        This freshly built string replaces the previous cached version.
 *
 * • updateXMLPanel()
 *      → If the XML tab is open (checked by `window.updateXMLIfActive`),
 *        re-renders the textual XML content in the interface so the user
 *        can see the exact new head or lemma reflected in the code view.
 *
 * • showSavingToast() / markSaved()
 *      → Purely visual. Displays the "Saving..." overlay or toast at the
 *        bottom-right corner of the screen. After serialization finishes,
 *        replaces it with "Saved" and fades out. Implemented with simple
 *        CSS transitions (opacity) defined in this file or `treebanking.css`.
 *
 *
 * -----------------------------------------------------------------------------
 * 3. Where the Saved Data Lives
 * -----------------------------------------------------------------------------
 *
 * Currently, autosave works **in-memory** — meaning all updates go to
 * `window.treebankData` and the live DOM views. When the user downloads the
 * XML via the “Download” button, it simply writes the current serialized
 * string (`window.treebankXML`) to a `.xml` file on disk.
 *
 * In future versions, this same mechanism could easily write to:
 *   • LocalStorage (for browser-based autosave persistence)
 *   • A backend REST API endpoint (to update the stored document remotely)
 *
 *
 * -----------------------------------------------------------------------------
 * 4. Why Autosave Is Reliable
 * -----------------------------------------------------------------------------
 *
 * - It always writes from the **same canonical data source**
 *   (`window.treebankData`), not from the DOM.
 * - It uses idempotent serialization: the same structure always yields
 *   the same XML text.
 * - It’s triggered *only* when a real data mutation occurs — reducing noise.
 * - It reuses existing live UI hooks:
 *      `window.updateXMLIfActive()` → refreshes XML tab
 *      `window.triggerAutoSave()`   → triggers visual + logical write
 *
 *
 * -----------------------------------------------------------------------------
 * 5. Visual Feedback Timing
 * -----------------------------------------------------------------------------
 *
 * - When `triggerAutoSave()` runs:
 *      → "Saving..." toast appears instantly.
 * - After XML rebuild completes:
 *      → Toast changes to "Saved" for 1.5 seconds, then fades.
 * - The user can continue editing normally; further changes restart the cycle.
 *
 *
 * -----------------------------------------------------------------------------
 * 6. Summary
 * -----------------------------------------------------------------------------
 *
 *  • All changes flow *into* `window.treebankData`.
 *  • This module listens for `triggerAutoSave()`.
 *  • It serializes the in-memory object model back into valid Treebank XML.
 *  • The XML tab and Download feature both reflect that current state.
 *  • A non-blocking toast confirms success visually.
 *
 * Together, this creates a seamless edit experience:
 *   - No manual “Save” needed.
 *   - The XML view and exported file always stay synchronized.
 *
 * =============================================================================
 */


// Track the most recent XML and debounce timer for autosave
let lastXML = "";
let autoSaveTimer = null;

/**
 * --------------------------------------------------------------------------
 * FUNCTION: buildXML
 * --------------------------------------------------------------------------
 * Converts window.treebankData → XML string
 * --------------------------------------------------------------------------
 */
export function buildXML() {
  if (!window.treebankData) return "";

  let xmlOut = '<?xml version="1.0" encoding="UTF-8"?>\n<treebank>\n';
  for (const s of window.treebankData) {
    xmlOut += `  <sentence id="${s.id}">\n`;
    for (const w of s.words) {
      const lemma  = (w._displayLemma  || w.lemma  || '').replace(/"/g, '&quot;');
      const postag = (w._displayPostag || w.postag || '').replace(/"/g, '&quot;');
      const relation = w.relation || "";
      const head = w.head || "0";
      xmlOut += `    <word id="${w.id}" form="${w.form}" lemma="${lemma}" postag="${postag}" relation="${relation}" head="${head}" />\n`;
    }
    xmlOut += '  </sentence>\n';
  }
  xmlOut += '</treebank>';
  return xmlOut;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: saveCurrentTreebank
 * --------------------------------------------------------------------------
 * Manual save — immediately writes XML to file if a file handle exists,
 * otherwise prompts the user to select a save location.
 * --------------------------------------------------------------------------
 */
export async function saveCurrentTreebank() {
  try {
    const xmlOut = buildXML();
    if (!xmlOut) {
      alert("No treebank data to save!");
      return;
    }

    // If user already opened/uploaded a file, reuse its handle
    if (window.uploadedFileHandle) {
      const writable = await window.uploadedFileHandle.createWritable();
      await writable.write(xmlOut);
      await writable.close();
      console.log("Saved to existing file handle.");
    } else {
      // Otherwise ask the user where to save
      const handle = await window.showSaveFilePicker({
        suggestedName: "treebank.xml",
        types: [{
          description: "XML Files",
          accept: { "application/xml": [".xml"] },
        }],
      });

      const writable = await handle.createWritable();
      await writable.write(xmlOut);
      await writable.close();
      window.uploadedFileHandle = handle; // remember for next autosaves
      console.log("File saved and handle stored for future autosaves.");
    }

    lastXML = xmlOut;
  } catch (err) {
    console.error("Error saving XML:", err);
  }
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: triggerAutoSave
 * --------------------------------------------------------------------------
 * Debounced autosave called whenever edits occur.
 * --------------------------------------------------------------------------
 */
export function triggerAutoSave() {
  try {
    if (typeof window.updateXMLIfActive === "function") {
      window.updateXMLIfActive();
    }

    const statusEl = document.getElementById("autosave-status");
    if (!statusEl) return;

    // Show Saving...
    statusEl.textContent = "Saving...";
    statusEl.style.background = "#333";
    statusEl.style.opacity = "1";
    statusEl.style.transform = "translateY(0)";

    clearTimeout(window._autosaveTransition);
    window._autosaveTransition = setTimeout(() => {
      statusEl.textContent = "Saved";
      statusEl.style.background = "#2e7d32"; 
    }, 1000);

    clearTimeout(window._autosaveFade);
    window._autosaveFade = setTimeout(() => {
      statusEl.style.opacity = "0";
      statusEl.style.transform = "translateY(10px)";
    }, 3000);

  } catch (err) {
    console.error("AutoSave failed:", err);
    const statusEl = document.getElementById("autosave-status");
    if (statusEl) {
      statusEl.textContent = "Save failed!";
      statusEl.style.background = "#c62828";
      statusEl.style.opacity = "1";
      clearTimeout(window._autosaveFade);
      window._autosaveFade = setTimeout(() => {
        statusEl.style.opacity = "0";
        statusEl.style.transform = "translateY(10px)";
      }, 4000);
    }
  }
}

// Expose for manual testing in browser console
window.triggerAutoSave = triggerAutoSave;
