import parseTreeBankXML from './parser.js';
import { safeDisplaySentence } from '../ui/sentenceDisplay.js';
import { validateTreebankSchema } from './schemaValidator.js';


// ---------------------------------------------
// SNAPSHOT-BASED DIRTY TRACKING HELPERS
// ---------------------------------------------

window.xmlSnapshot = "";   // holds clean XML
window.xmlDirty    = false; // true = unsaved changes

export function takeSnapshot(xmlDisplay) {
    // Take snapshot of the TRUE XML (not highlighted)
    window.xmlSnapshot = window.originalXMLText
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();

    window.xmlDirty = false;
}

export function recomputeDirty(xmlDisplay) {
  const display = xmlDisplay || document.getElementById("xml-display");

  // No XML editor or not in edit mode → nothing to protect
  if (!display || !display.classList.contains("editing")) {
    window.xmlDirty = false;
    return;
  }

  // If we ARE in edit mode, we trust the input handler
  // to have set xmlDirty = true when the user typed.
  // So: do NOT touch xmlDirty here.
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupXMLTool
 * --------------------------------------------------------------------------
 * Adds an "XML" tool to the right-side toolbar.
 * When clicked, this tab displays a pretty-formatted, syntax-highlighted
 * XML view of the currently displayed sentence (only one sentence at a time).
 *
 * While this XML panel is open:
 *   - The dependency tree enters read-only mode (dimmed, non-interactive).
 *   - All pointer events are disabled on the SVG.
 *
 * Clicking the button again closes the XML view and restores interactivity.
 *
 * @returns {void} Runs synchronously to initialize event listeners and view logic.
 */
export function setupXMLTool() {
  if (window.xmlToolInitialized) return; // avoid double setup
  window.xmlToolInitialized = true;
  window.xmlInternalUpdate = false;

  const xmlBtn = document.getElementById('xml');
  const toolBody = document.getElementById('tool-body');
  const allToolButtons = document.querySelectorAll('#toolbar button');
  if (!xmlBtn || !toolBody) return;

  xmlBtn.addEventListener('click', () => {
    const wasActive = xmlBtn.classList.contains('active');

    // Reset all toolbar button states
    allToolButtons.forEach(btn => btn.classList.remove('active'));

    if (wasActive) {
      // --- Exit XML mode ---
      xmlBtn.classList.remove('active');
      toolBody.innerHTML = `<p>Please select a tool from the bar above that you would like to use.</p>`;
      exitReadOnly();
    } else {
      // --- Activate XML mode ---
      xmlBtn.classList.add('active');

      const rawXML = getCurrentSentenceXML();
      const formatted = formatXML(rawXML);
      const highlighted = highlightXML(formatted);

      // --- Build the XML view ---
      toolBody.innerHTML = `
      <div id="xml-header">
        <div class="morph-actions" id="xml-actions">
            <button id="xml-edit" class="btn btn-save">Edit XML</button>
            <button id="xml-cancel" class="btn btn-cancel" style="display:none;">Cancel</button>
            <button id="xml-confirm" class="btn btn-save" style="display:none;">Confirm</button>
        </div>
      </div>
        <pre id="xml-display" class="xml-display" contenteditable="false">${highlighted}</pre>
      `;

      // Save snapshot for later restores
      window.originalXMLText = rawXML;

      const xmlDisplay = document.getElementById('xml-display');
      const editBtn = document.getElementById('xml-edit');
      const confirmBtn = document.getElementById('xml-confirm');
      const cancelBtn = document.getElementById('xml-cancel');

      // === EDIT MODE ===
      editBtn.addEventListener('click', () => {
        window.xmlEditingSentenceId = String(window.currentIndex);
        const currentText = xmlDisplay.innerText.trim();
        const plainXML = (window.originalXMLText || currentText)
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&');

        xmlDisplay.textContent = plainXML;
        xmlDisplay.contentEditable = true;
        xmlDisplay.classList.add('editing');
        editBtn.style.display = 'none';
        confirmBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
        // Snapshot the plain XML BEFORE user edits begin
        window.xmlSnapshot = plainXML.trim();
        window.xmlDirty = false;

        // --- Restrict postag to 9 chars and visually warn user ---
        const limiter = () => {
          const text = xmlDisplay.textContent;
          const matches = [...text.matchAll(/postag="([^"]*)"/g)];
          let exceeded = false;

          const newText = matches.reduce((acc, match) => {
            const full = match[0];
            const val = match[1];
            if (val.length > 9) {
              exceeded = true;
              const trimmed = val.slice(0, 9);
              return acc.replace(full, `postag="${trimmed}"`);
            }
            return acc;
          }, text);

          if (newText !== text) {
            window.xmlInternalUpdate = true;
            xmlDisplay.textContent = newText;
            window.xmlInternalUpdate = false;
            const sel = window.getSelection();
            sel.removeAllRanges();
          }

          // Flash visual feedback if exceeded
          if (exceeded) {
            xmlDisplay.style.outline = '2px solid #c33';
            xmlDisplay.style.transition = 'outline 0.2s ease';
            setTimeout(() => {
              xmlDisplay.style.outline = 'none';
            }, 300);
          }
        };

        xmlDisplay.addEventListener('input', limiter);
        xmlDisplay._limiter = limiter;
        xmlDisplay.addEventListener("input", () => {
          if (!window.xmlInternalUpdate) {
            window.xmlDirty = true;
          }
        });
      });

      // === CANCEL EDIT ===
      cancelBtn.addEventListener('click', () => {
        discardXmlEdits();
      });

      // === CONFIRM EDIT ===
      confirmBtn.addEventListener('click', () => {
        const editedText    = xmlDisplay.textContent.trim();
        const snapshotPlain = (window.xmlSnapshot || '').trim();
        let xmlDoc;
        let success = false;

        // ─────────────────────────────
        // EARLY EXIT: NO REAL CHANGES
        // ─────────────────────────────
        // If the current editor contents are exactly the same as the snapshot
        // taken when "Edit XML" was clicked, then do *not* treat this as an update:
        // - no toast
        // - no model change
        // - just restore pretty view + clean state
        if (editedText === snapshotPlain) {
          const escaped = snapshotPlain
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

          window.originalXMLText = escaped;

          window.xmlInternalUpdate = true;
          xmlDisplay.innerHTML = highlightXML(formatXML(escaped));
          window.xmlInternalUpdate = false;

          xmlDisplay.contentEditable = false;
          xmlDisplay.classList.remove('editing');
          editBtn.style.display = 'inline-block';
          confirmBtn.style.display = 'none';
          cancelBtn.style.display = 'none';

          window.xmlDirty = false;
          takeSnapshot(xmlDisplay);

          if (xmlDisplay._limiter) {
            xmlDisplay.removeEventListener('input', xmlDisplay._limiter);
            delete xmlDisplay._limiter;
          }

          enterReadOnly();
          return;
        }

        try {
          // ─────────────────────────────
          // Stage 1: Well-formed XML
          // ─────────────────────────────
          const parser = new DOMParser();
          xmlDoc = parser.parseFromString(editedText, 'application/xml');
          const parseError = xmlDoc.querySelector('parsererror');
          if (parseError) {
            const raw = parseError.textContent || '';
            const shortMsg = raw.split('Below is a rendering')[0].trim();
            throw new Error(shortMsg || 'XML not well-formed');
          }
          normalizeSentenceWordIds(xmlDoc);

          // ─────────────────────────────
          // Stage 2: Schema validation
          // ─────────────────────────────
          try {
            validateTreebankSchema(xmlDoc);
          } catch (validationError) {
            const msg = validationError?.message || '';

            if (window.isLenientValidation && isMorphologyOnlyError(msg)) {
              console.warn('[XML EDIT] Lenient (morph-only):', msg);
              showToast(`Schema warning (lenient morph): ${msg}`, true);

              const highlighted = highlightXMLValidationError(xmlDisplay.textContent, msg);
              if (highlighted !== xmlDisplay.textContent) {
                window.xmlInternalUpdate = true;
                xmlDisplay.innerHTML = highlighted;
                window.xmlInternalUpdate = false;
              }

              // Stay in edit mode
              return;
            }

            showToast(`Schema validation failed: ${msg}`, true);
            const highlighted = highlightXMLValidationError(xmlDisplay.textContent, msg);
            if (highlighted !== xmlDisplay.textContent) {
              window.xmlInternalUpdate = true;
              xmlDisplay.innerHTML = highlighted;
              window.xmlInternalUpdate = false;
            }
            console.error('[XML EDIT] Stage 2 failed:', validationError);
            throw validationError;
          }

          // ─────────────────────────────
          // Stage 3: Update model
          // ─────────────────────────────
          const xmlString = new XMLSerializer().serializeToString(xmlDoc);

          // IMPORTANT: xmlString is just ONE <sentence> ... </sentence>
          const newData = parseTreeBankXML(xmlString);
          const updatedSentence = newData[0];

          if (!updatedSentence) {
            throw new Error('No <sentence> found after XML edit.');
          }

          // DO NOT ALLOW CHANGING <sentence id>
          const originalId = String(window.xmlEditingSentenceId || window.currentIndex);
          const newId      = String(updatedSentence.id);

          if (newId !== originalId) {
            throw new Error(
              `Changing <sentence> id is not allowed in this editor. ` +
              `Please keep id="${originalId}".`
            );
          }
          // === CYCLE DETECTION ===
          if (updatedSentence) {
            const words = updatedSentence.words;

            for (const w of words) {
              const wid = String(w.id);
              const newHead = String(w.head);

              if (detectCycleForXML(words, wid, newHead)) {
                throw new Error("Cannot Create a Cycle");
              }
            }
          }

          if (!updatedSentence) {
            throw new Error('No <sentence> found after XML edit.');
          }

          // Find that sentence in the global treebankData by id
          const oldIdx = window.treebankData.findIndex(
            s => String(s.id) === originalId
          );
          if (oldIdx === -1) {
            console.warn('[XML EDIT] Could not locate original sentence id', originalId, 'in treebankData');
          } else {
            window.treebankData[oldIdx] = updatedSentence;
          }


          // Cache display copy for Cancel + XML panel
          window.currentXMLText = xmlString;
          window.originalXMLText = xmlString
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

          // Refresh XML panel
          const escaped = window.originalXMLText;
          window.xmlInternalUpdate = true;
          xmlDisplay.innerHTML = highlightXML(formatXML(escaped));
          window.xmlInternalUpdate = false;

          console.log('[XML EDIT] Updated sentence id:', updatedSentence.id);

          // Re-render sentence/tree without triggering the “unsaved edits” guard
          safeDisplaySentence(updatedSentence.id, { skipXMLGuard: true });

          showToast('XML updated successfully.');
          success = true;

        } catch (e) {
          console.error('[XML EDIT] Confirm failed:', e);
          showToast(`XML Edit failed: ${e.message}`, true);
        } finally {
          if (success) {
            xmlDisplay.contentEditable = false;
            xmlDisplay.classList.remove('editing');
            editBtn.style.display = 'inline-block';
            confirmBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
            window.xmlDirty = false;
            takeSnapshot(xmlDisplay);

            if (xmlDisplay._limiter) {
              xmlDisplay.removeEventListener('input', xmlDisplay._limiter);
              delete xmlDisplay._limiter;
            }

            enterReadOnly();
          } else {
            // Stay in edit mode on error
            xmlDisplay.contentEditable = true;
            xmlDisplay.classList.add('editing');
            editBtn.style.display = 'none';
            confirmBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
          }
        }
      });

      enterReadOnly();
      document.body.classList.remove('mode-morph');
    }
  });

  // --- Ensure other tabs prompt about unsaved XML ---
  if (!window.xmlListenersAttached) {
    allToolButtons.forEach(btn => {
      if (btn.id !== 'xml') {
        btn.addEventListener('click', (e) => {
          recomputeDirty(document.getElementById('xml-display'));
          if (window.xmlDirty) {
            const ok = confirm("You have unsaved XML changes. Discard them?");
            if (!ok) {
              e.preventDefault();
              e.stopImmediatePropagation();
              return;
            }
            discardXmlEdits();
          }
          exitReadOnly();
        });
      }
    });

    window.xmlListenersAttached = true;
  }

  // --- Auto-clear read-only when XML tab becomes inactive ---
  const observer = new MutationObserver(() => {
    if (!xmlBtn.classList.contains('active')) {
      exitReadOnly();
    }
  });
  observer.observe(xmlBtn, { attributes: true, attributeFilter: ['class'] });
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: formatXML
 * --------------------------------------------------------------------------
 * Properly indents nested XML elements for readability.
 * Adds two spaces per nesting level.
 *
 * @param {string} xmlString - Raw, escaped XML string (e.g., with &lt; and &gt;).
 * @returns {string} Indented version of the XML string with line breaks preserved.
 */
export function formatXML(xmlString) {
  const lines = xmlString.split('\n');
  let indentLevel = 0;

  const formatted = lines.map(line => {
    let trimmed = line.trim();
    if (!trimmed) return ''; // skip empty lines

    // Decrease indent after closing tag
    if (trimmed.match(/^&lt;\/[^>]+&gt;$/)) indentLevel--;

    // Apply indentation
    const spaces = '&nbsp;'.repeat(indentLevel * 2);
    const indentedLine = spaces + trimmed;

    // Increase indent after opening tag that’s not self-closing
    if (trimmed.match(/^&lt;[^/!?][^>]*[^/]&gt;$/)) indentLevel++;

    return indentedLine;
  });

  return formatted.join('<br>');
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: highlightXML
 * --------------------------------------------------------------------------
 * Adds color syntax highlighting to XML tags, attributes, and values.
 * Lightweight and dependency-free (uses <span> wrappers).
 *
 * @param {string} xmlString - Escaped XML markup string.
 * @returns {string} Highlighted HTML string.
 */
export function highlightXML(xmlString) {
  return xmlString
    // Highlight tags and attributes
    .replace(/(&lt;\/?)([a-zA-Z0-9_-]+)([^&]*?)(&gt;)/g, (match, lt, tag, attrs, gt) => {
      const coloredAttrs = attrs.replace(
        /([a-zA-Z0-9_-]+)="(.*?)"/g,
        `<span class="xml-attr">$1</span>=<span class="xml-value">"$2"</span>`
      );
      return `${lt}<span class="xml-tag">${tag}</span>${coloredAttrs}${gt}`;
    });
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: getCurrentSentenceXML
 * --------------------------------------------------------------------------
 * Retrieves the XML representation of the currently displayed sentence.
 * Only includes the current sentence and its <word> elements.
 *
 * @returns {string} Escaped and formatted XML markup.
 */
export function getCurrentSentenceXML() {
  const data = window.treebankData?.find(s => s.id === `${window.currentIndex}`);
  if (!data) return '&lt;!-- No sentence loaded --&gt;';

  // Construct XML with line breaks, preferring active display values
  const words = data.words.map(w => {
    const lemma  = w._displayLemma  ?? w.lemma;
    const postag = w._displayPostag ?? w.postag;
    return `  &lt;word id="${w.id}" form="${w.form}" lemma="${lemma}" postag="${postag}" relation="${w.relation}" head="${w.head}" /&gt;`;
  }).join('\n');

  const xml = `&lt;sentence id="${data.id}"&gt;\n${words}\n&lt;/sentence&gt;`;
  return xml;
}

  /**
 * --------------------------------------------------------------------------
 * FUNCTION: updateXMLIfActive
 * --------------------------------------------------------------------------
 * Refreshes the XML panel automatically when navigating between sentences.
 * Does nothing if XML view is not active.
 *
 * @returns {void}
 */
export function updateXMLIfActive() {
  const xmlBtn = document.getElementById('xml');
  const toolBody = document.getElementById('tool-body');

  // Only refresh if the XML tab is currently active (visibly toggled)
  if (!xmlBtn || !toolBody || !xmlBtn.classList.contains('active')) {
    return;
  }

  const rawXML = getCurrentSentenceXML();

  // Save snapshot for Cancel button functionality
  window.originalXMLText = rawXML;

  const formatted = formatXML(rawXML);
  const highlighted = highlightXML(formatted);

  const xmlDisplay = document.getElementById('xml-display');

  if (xmlDisplay) {
    window.xmlInternalUpdate = true;
    xmlDisplay.innerHTML = highlighted;
    window.xmlInternalUpdate = false;

    // Always reset to clean, read-only view on sentence change
    xmlDisplay.contentEditable = false;
    xmlDisplay.classList.remove('editing');

    const editBtn    = document.getElementById('xml-edit');
    const confirmBtn = document.getElementById('xml-confirm');
    const cancelBtn  = document.getElementById('xml-cancel');

    if (editBtn)    editBtn.style.display = 'inline-block';
    if (confirmBtn) confirmBtn.style.display = 'none';
    if (cancelBtn)  cancelBtn.style.display = 'none';

    // New sentence = no edits yet
    window.xmlDirty = false;
  } else {
    // Fallback if editor not built (rare)
    toolBody.innerHTML = `
      <div id="xml-header">
        <div class="morph-actions" id="xml-actions">
          <button id="xml-edit" class="btn btn-save" type="button">Edit XML</button>
          <button id="xml-cancel" class="btn btn-cancel" type="button" style="display:none;">Cancel</button>
          <button id="xml-confirm" class="btn btn-save" type="button" style="display:none;">Confirm</button>
        </div>
      </div>
      <pre id="xml-display" class="xml-display" contenteditable="false">${highlighted}</pre>
    `;
    // Note: setupXMLTool already attaches listeners when clicking xml-button,
    // so fallback should be rare.
  }

  toolBody.scrollTop = 0;
}

window.updateXMLIfActive = updateXMLIfActive;

/**
 * --------------------------------------------------------------------------
 * FUNCTION: enterReadOnly
 * --------------------------------------------------------------------------
 * Disables all interactivity on the dependency tree.
 * Called when the XML panel is active.
 *
 * @returns {void} Sets read-only flag and dims the SVG display.
 */
export function enterReadOnly() {
  window.isReadOnly = true;
  d3.select('#sandbox svg')
    .style('pointer-events', 'none') // disable user input
    .style('opacity', 0.85);         // visually indicate locked state
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: exitReadOnly
 * --------------------------------------------------------------------------
 * Restores interactivity to the dependency tree when XML mode is closed.
 *
 * @returns {void} Clears read-only flag and restores normal appearance.
 */
export function exitReadOnly() {
  window.isReadOnly = false;
  d3.select('#sandbox svg')
    .style('pointer-events', 'all')
    .style('opacity', 1);
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.style.background = isError ? '#c33' : '#2e7d32';
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
  }, 5000);
}

// Only morphology/postag issues are eligible for leniency.
// Relations, heads, POS, etc. must remain hard errors.
function isMorphologyOnlyError(msg = '') {
  const m = String(msg).toLowerCase();

  // Missing/partial morphological slots (nouns/adjectives/pronouns/article)
  if (/missing required (case|number|gender)/i.test(m)) return true;
  if (/partial morphological/i.test(m)) return true;

  // Verbal features
  if (/missing required (person|number|tense)/i.test(m)) return true;

  // Slot-by-slot postag checks
  if (/invalid character .* at position .* in postag/i.test(m)) return true;

  // Incomplete/short postag coming from legacy sources
  if (/postag too short/i.test(m)) return true;

  // Anything else (relations, head, etc.) is NOT lenient
  return false;
}


/**
 * --------------------------------------------------------------------------
 * FUNCTION: highlightXMLValidationError
 * --------------------------------------------------------------------------
 * Highlights the exact location of a schema error (postag position) in the editor.
 *
 * @param {string} xmlText - The current editable XML text.
 * @param {string} errorMsg - The error message from validation.
 * @returns {string} The same XML text, possibly wrapped with a <span> around the error spot.
 */
function highlightXMLValidationError(xmlText, errorMsg) {
  // Detect if error refers to a specific postag position
  const match = errorMsg.match(/postag '([^']+)'.*position (\d+)/i);
  if (!match) return xmlText; // Not a per-character error, skip

  const postag = match[1];
  const pos = parseInt(match[2], 10) - 1;

  // If we can’t identify, skip highlighting
  if (isNaN(pos) || pos < 0 || pos >= postag.length) return xmlText;

  // Insert highlight span around the invalid char
  const before = postag.slice(0, pos);
  const invalid = postag[pos];
  const after = postag.slice(pos + 1);
  const highlightedPostag =
    `${before}<span class="xml-error-char">${invalid}</span>${after}`;

  // Replace the first instance of this postag in the XML string
  return xmlText.replace(
    new RegExp(`postag="${postag}"`, 'i'),
    `postag="${highlightedPostag}"`
  );
}

/**
 * Safe cycle detector for XML editor.
 * -------------------------------------------------------------
 * Unlike createsCycle(), this one NEVER loops forever.
 * It detects:
 *   - cycles involving the given dependentId
 *   - cycles elsewhere in the graph (e.g. 2↔3 even if dependent=1)
 */
export function detectCycleForXML(words, dependentId, newHeadId) {
  const dep = String(dependentId);
  let current = String(newHeadId);

  // Precompute valid IDs (schema should guarantee this, but be safe)
  const validIds = new Set(words.map(w => String(w.id)));

  const visited = new Set();

  while (current && current !== "0" && current !== "root") {

    // invalid head? treat as non-cycle, but safe-out
    if (!validIds.has(current)) return false;

    // 1. cycle directly involving this dependent
    if (current === dep) return true;

    // 2. repeating a node = cycle somewhere (even if not involving dep)
    if (visited.has(current)) return true;

    visited.add(current);

    // walk upward
    const parent = words.find(w => String(w.id) === current);
    if (!parent) return false;

    current = String(parent.head);
  }

  return false; // reached root cleanly
}

export function discardXmlEdits() {
  const xmlDisplay = document.getElementById('xml-display');
  const editBtn    = document.getElementById('xml-edit');
  const confirmBtn = document.getElementById('xml-confirm');
  const cancelBtn  = document.getElementById('xml-cancel');

  // If there's no editor or we're not actually editing, just clear the flag
  if (!xmlDisplay || !xmlDisplay.classList.contains('editing')) {
    window.xmlDirty = false;
    return;
  }

  // Use the snapshot taken at the moment "Edit XML" was clicked
  const snapshotPlain = (window.xmlSnapshot || '').trim();

  // Re-escape and re-highlight it for display
  const escaped = snapshotPlain
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  window.originalXMLText = escaped; // canonical for this panel

  window.xmlInternalUpdate = true;
  xmlDisplay.innerHTML = highlightXML(formatXML(escaped));
  window.xmlInternalUpdate = false;

  // Exit edit mode visually
  xmlDisplay.contentEditable = false;
  xmlDisplay.classList.remove('editing');
  if (editBtn)    editBtn.style.display = 'inline-block';
  if (confirmBtn) confirmBtn.style.display = 'none';
  if (cancelBtn)  cancelBtn.style.display = 'none';

  // Turn off dirty flag
  window.xmlDirty = false;

  // Remove limiter input listener if present
  if (xmlDisplay._limiter) {
    xmlDisplay.removeEventListener('input', xmlDisplay._limiter);
    delete xmlDisplay._limiter;
  }
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: normalizeSentenceWordIds
 * --------------------------------------------------------------------------
 * For the edited sentence:
 *   - renumbers <word id="..."> to 1..N in document order
 *   - remaps any head attributes that point to those old IDs
 *   - if a head points at a deleted/non-existent id, reattach it to 0 (root)
 *
 * This lets users freely delete / insert <word> elements in the XML editor.
 * After they confirm, IDs are made dense and consistent again.
 *
 * @param {XMLDocument} xmlDoc - The parsed XML fragment containing one <sentence>.
 */
function normalizeSentenceWordIds(xmlDoc) {
  if (!xmlDoc) return;

  const sentenceEl = xmlDoc.querySelector('sentence');
  if (!sentenceEl) return;

  // All <word> children in document order
  const wordEls = Array.from(sentenceEl.querySelectorAll('word'));
  if (!wordEls.length) return;

  const idMap = Object.create(null);

  // First pass: assign new ids 1..N and build old→new map
  wordEls.forEach((w, idx) => {
    const oldId = (w.getAttribute('id') || String(idx + 1)).trim();
    const newId = String(idx + 1);
    idMap[oldId] = newId;
    w.setAttribute('id', newId);
  });

  const maxId = wordEls.length;

  // Second pass: remap heads
  wordEls.forEach(w => {
    const rawHead = (w.getAttribute('head') || '').trim();
    if (!rawHead) {
      return; // nothing set
    }

    // Allow 0 / root to pass through unchanged
    if (rawHead === '0' || rawHead.toLowerCase() === 'root') {
      w.setAttribute('head', '0');
      return;
    }

    // If this head used to point to some real word id, remap it
    const mapped = idMap[rawHead];
    if (mapped) {
      w.setAttribute('head', mapped);
      return;
    }

    // If we get here, this head points to a deleted / non-existent id.
    // To keep the tree valid, reattach this node to the root (0) and log it.
    if (window.morphDebug) {
      console.warn(
        '[XML] normalizeSentenceWordIds: head',
        rawHead,
        'no longer exists; reattaching word',
        w.getAttribute('id'),
        'to root (0)'
      );
    }
    w.setAttribute('head', '0');
  });
}