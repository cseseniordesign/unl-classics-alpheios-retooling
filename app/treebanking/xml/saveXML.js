import { getLanguage } from "../input/language.js";
import { showPromptDialog } from "../ui/modal.js";

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

function getTreebankMetaForSave() {
  let meta = window.treebankMeta || {};

  const stored = localStorage.getItem("treebankMeta");
  if (stored) {
    try {
      meta = { ...meta, ...JSON.parse(stored) };
    } catch (_) {}
  }

  const attrs = { ...(meta.attributes || {}) };

  // Keep original values if present; only fill in missing ones
  if (!attrs["xmlns:saxon"]) {
    attrs["xmlns:saxon"] = "http://saxon.sf.net/";
  }

  if (!attrs["xml:lang"]) {
    attrs["xml:lang"] =
      localStorage.getItem("textLanguage") ||
      "grc";
  }

  if (!attrs["version"]) {
    attrs["version"] = "1.5";
  }

  if (!attrs["direction"]) {
    attrs["direction"] =
      localStorage.getItem("textDirection") ||
      "ltr";
  }

  if (!attrs["format"]) {
    const activeTagset = localStorage.getItem("activeTagsetId");
    if (activeTagset) attrs["format"] = activeTagset;
  }

  return {
    attributes: attrs,
    prefixNodes: Array.isArray(meta.prefixNodes) ? meta.prefixNodes : []
  };
}

function buildTreebankOpenTag() {
  const meta = getTreebankMetaForSave();
  const attrs = meta.attributes;

  const attrText = Object.entries(attrs)
    .map(([name, value]) => {
      const escapedValue = String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `${name}="${escapedValue}"`;
    })
    .join(" ");

  return `<treebank${attrText ? " " + attrText : ""}>`;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: buildXML
 * --------------------------------------------------------------------------
 * Converts window.treebankData → XML string
 * --------------------------------------------------------------------------
 */
export function buildXML() {
  if (!window.treebankData) return "";

  const meta = getTreebankMetaForSave();

  let xmlOut = `<?xml version="1.0" encoding="UTF-8"?>\n${buildTreebankOpenTag()}\n`;

  // Reinsert everything that originally appeared before the first <sentence>
  if (meta.prefixNodes.length > 0) {
    for (const nodeXML of meta.prefixNodes) {
      xmlOut += `  ${nodeXML}\n`;
    }
  }

  for (const s of window.treebankData) {
    xmlOut += `  <sentence id="${s.id}">\n`;

    for (const w of s.words) {
      const form = String(w.form ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const lemma = String(w._displayLemma || w.lemma || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const postag = String(w._displayPostag || w.postag || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const relation = String(w.relation ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const head = (w.head === null || w.head === undefined)
        ? ""
        : String(w.head)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

      //xmlOut += `    <word id="${w.id}" form="${form}" lemma="${lemma}" postag="${postag}" relation="${relation}" head="${head}" />\n`;
      const artificialAttr = w.artificial
        ? ` artificial="${w.artificial}" insertion_id="${w.insertion_id}"`
        : '';
      xmlOut += `    <word id="${w.id}" form="${form}" lemma="${lemma}" postag="${postag}" relation="${relation}" head="${head}"${artificialAttr} />\n`;
    }

    xmlOut += `  </sentence>\n`;
  }

  xmlOut += `</treebank>`;
  return xmlOut;
}

async function writeXMLToExistingHandle(xmlOut) {
  if (
    !window.uploadedFileHandle ||
    typeof window.uploadedFileHandle.createWritable !== "function"
  ) {
    return false;
  }

  const writable = await window.uploadedFileHandle.createWritable();
  await writable.write(xmlOut);
  await writable.close();
  return true;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: saveCurrentTreebank
 * --------------------------------------------------------------------------
 * Manual save — immediately writes XML to file if a file handle exists,
 * otherwise prompts the user to select a save location.
 * --------------------------------------------------------------------------
 */
export async function saveCurrentTreebank(options = {}) {
  const { silent = false } = options;
  let statusEl;

  try {
    const xmlOut = buildXML();
    if (!xmlOut) {
      if (!silent) {
        alert("No treebank data to save!");
      }
      return false;
    }

    statusEl = document.getElementById("autosave-status");
    if (statusEl) {
      statusEl.textContent = "Saving...";
      statusEl.style.background = "#333";
      statusEl.style.opacity = "1";
      statusEl.style.transform = "translateY(0)";
    }

    // Silent mode: ONLY save if we already have a real file handle
    if (silent) {
      const wrote = await writeXMLToExistingHandle(xmlOut);
      if (!wrote) {
        // No handle available -> cannot silently autosave to disk
        return false;
      }

      lastXML = xmlOut;

      if (statusEl) {
        clearTimeout(window._autosaveTransition);
        window._autosaveTransition = setTimeout(() => {
          statusEl.textContent = "Saved";
          statusEl.style.background = "#2e7d32";
        }, 150);

        clearTimeout(window._autosaveFade);
        window._autosaveFade = setTimeout(() => {
          statusEl.style.opacity = "0";
          statusEl.style.transform = "translateY(10px)";
        }, 1800);
      }

      return true;
    }

    // Normal/manual save path
    if (window.uploadedFileHandle && typeof window.uploadedFileHandle.createWritable === "function") {
      const writable = await window.uploadedFileHandle.createWritable();
      await writable.write(xmlOut);
      await writable.close();
      console.log("Saved to existing file handle.");
    } else {
      if (typeof window.showSaveFilePicker !== "function") {
        const defaultName = getSuggestedXmlName();

        const userName = await showPromptDialog("Choose a file name:", {
          titleText: "Save XML",
          okText: "Save",
          cancelText: "Cancel",
          defaultValue: defaultName,
          placeholder: "treebank.xml"
        });

        if (!userName) {
          return false;
        }

        let finalName = sanitizeFileName(userName);
        if (!finalName.toLowerCase().endsWith(".xml")) finalName += ".xml";

        localStorage.setItem("treebankFileName", finalName);

        const blob = new Blob([xmlOut], { type: "application/xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = finalName;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);

        console.log("Saved via download fallback with filename:", finalName);
      } else {
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
        window.uploadedFileHandle = handle;
        console.log("File saved and handle stored for future autosaves.");
      }
    }

    lastXML = xmlOut;

    if (statusEl) {
      clearTimeout(window._autosaveTransition);
      window._autosaveTransition = setTimeout(() => {
        statusEl.textContent = "Saved";
        statusEl.style.background = "#2e7d32";
      }, 300);

      clearTimeout(window._autosaveFade);
      window._autosaveFade = setTimeout(() => {
        statusEl.style.opacity = "0";
        statusEl.style.transform = "translateY(10px)";
      }, 2500);
    }

    return true;
  } catch (err) {
    console.error("Error saving XML:", err);

    statusEl = statusEl || document.getElementById("autosave-status");
    if (statusEl) {
      statusEl.textContent = "Save failed!";
      statusEl.style.background = "#c62828";
      statusEl.style.opacity = "1";
      statusEl.style.transform = "translateY(0)";

      clearTimeout(window._autosaveFade);
      window._autosaveFade = setTimeout(() => {
        statusEl.style.opacity = "0";
        statusEl.style.transform = "translateY(10px)";
      }, 4000);
    }

    return false;
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

    statusEl.textContent = "Saving...";
    statusEl.style.background = "#333";
    statusEl.style.opacity = "1";
    statusEl.style.transform = "translateY(0)";

    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      try {
        const wroteToDisk = await saveCurrentTreebank({ silent: true });

        // If no writable file handle exists yet, don't pretend disk save happened.
        if (!wroteToDisk) {
          statusEl.textContent = "Saved in app";
          statusEl.style.background = "#2e7d32";

          clearTimeout(window._autosaveFade);
          window._autosaveFade = setTimeout(() => {
            statusEl.style.opacity = "0";
            statusEl.style.transform = "translateY(10px)";
          }, 2000);
        }
      } catch (err) {
        console.error("AutoSave failed:", err);
        statusEl.textContent = "Save failed!";
        statusEl.style.background = "#c62828";
        statusEl.style.opacity = "1";

        clearTimeout(window._autosaveFade);
        window._autosaveFade = setTimeout(() => {
          statusEl.style.opacity = "0";
          statusEl.style.transform = "translateY(10px)";
        }, 4000);
      }
    }, 500);
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

function sanitizeFileName(name) {
  // remove characters that cause issues across OS/filesystems
  return name.replace(/[\/\\?%*:|"<>]/g, "-").trim();
}

function getSuggestedXmlName() {
  // best effort defaults
  const fromStorage = localStorage.getItem("treebankFileName");
  if (fromStorage) return fromStorage;

  const handleName = window.uploadedFileHandle?.name;
  if (handleName) return handleName;

  return "treebank.xml";
}

// Expose for manual testing in browser console
window.triggerAutoSave = triggerAutoSave;
window.saveCurrentTreebank = saveCurrentTreebank;
