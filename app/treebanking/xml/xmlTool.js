import parseTreeBankXML from './parser.js';
import { displaySentence } from '../ui/sentenceDisplay.js';
import { validateTreebankSchema } from './schemaValidator.js';


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
            <button id="xml-edit" class="btn btn-save">Edit</button>
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
            xmlDisplay.textContent = newText;
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
      });

      // === CANCEL EDIT ===
      cancelBtn.addEventListener('click', () => {
        xmlDisplay.innerHTML = highlightXML(formatXML(window.originalXMLText));
        xmlDisplay.contentEditable = false;
        xmlDisplay.classList.remove('editing');
        editBtn.style.display = 'inline-block';
        confirmBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        if (xmlDisplay._limiter) {
          xmlDisplay.removeEventListener('input', xmlDisplay._limiter);
          delete xmlDisplay._limiter;
        }
      });

      // === CONFIRM EDIT ===
      confirmBtn.addEventListener('click', () => {
        const editedText = xmlDisplay.textContent.trim();
        let xmlDoc;
        let success = false;

        try {
          // Stage 1: Well-formed XML
          const parser = new DOMParser();
          xmlDoc = parser.parseFromString(editedText, 'application/xml');
          const parseError = xmlDoc.querySelector('parsererror');
          if (parseError) {
            const raw = parseError.textContent || '';
            const shortMsg = raw.split('Below is a rendering')[0].trim();
            throw new Error(shortMsg || 'XML not well-formed');
          }

        // Stage 2: Schema validation (adaptive but relations ALWAYS strict)
        try {
          validateTreebankSchema(xmlDoc);
        }
        catch (validationError) {
          const msg = validationError?.message || '';

          // Case 1: Lenient mode + morphology-only → warn + highlight, stay editable
          if (window.isLenientValidation && isMorphologyOnlyError(msg)) {
            console.warn('[XML EDIT] Lenient mode (morphology only):', msg);
            showToast(`Schema warning (lenient morph): ${msg}`, true);

            // Highlight problem area in the editable XML
            const highlighted = highlightXMLValidationError(xmlDisplay.textContent, msg);
            if (highlighted !== xmlDisplay.textContent) {
              xmlDisplay.innerHTML = highlighted;
            }

            // Do NOT rethrow → user can fix while staying in edit mode
            return;
          }

          // Case 2: Any other error (relations, head, malformed, etc.) → hard fail
          else {
            showToast(`Schema validation failed: ${msg}`, true);

            // Optional: visually mark the error in the editor if it’s pinpointable
            const highlighted = highlightXMLValidationError(xmlDisplay.textContent, msg);
            if (highlighted !== xmlDisplay.textContent) {
              xmlDisplay.innerHTML = highlighted;
            }

            console.error('[XML EDIT] Stage 2 failed:', validationError);
            // Rethrow to abort the rest of the confirm sequence
            throw validationError;
          }
        }

          // Stage 3: Update model without redrawing full UI
          const xmlString = new XMLSerializer().serializeToString(xmlDoc);
          const newData = parseTreeBankXML(xmlString);
          const index = window.treebankData.findIndex(s => s.id === `${window.currentIndex}`);
          if (index !== -1) {
            window.treebankData[index] = newData[0];
          }

          window.currentXMLText = xmlString;
          window.originalXMLText = xmlString
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

         // Refresh only XML display
          const escaped = window.originalXMLText;
          xmlDisplay.innerHTML = highlightXML(formatXML(escaped));

          // If you want a faster tree color refresh, call your helper here:
          if (typeof window.fastRefreshTree === 'function') {
            window.fastRefreshTree();
          }

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

            if (xmlDisplay._limiter) {
              xmlDisplay.removeEventListener('input', xmlDisplay._limiter);
              delete xmlDisplay._limiter;
            }

            enterReadOnly();
          } else {
            // Stay in edit mode for corrections
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

  // --- Ensure other tabs restore tree interactivity ---
  allToolButtons.forEach(btn => {
    if (btn.id !== 'xml') {
      btn.addEventListener('click', () => {
        exitReadOnly();
      });
    }
  });

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
    // Only update innerHTML, keep buttons and layout intact
    xmlDisplay.innerHTML = highlighted;
    xmlDisplay.contentEditable = false;
    xmlDisplay.classList.remove('editing');
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
  }, 15000);
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

function attachXMLEditorHandlers() {
  const editBtn = document.getElementById("xml-edit");
  const confirmBtn = document.getElementById("xml-confirm");
  const cancelBtn = document.getElementById("xml-cancel");
  const xmlDisplay = document.getElementById("xml-display");

  if (!editBtn || !xmlDisplay) return;

  // EDIT MODE
  editBtn.addEventListener("click", () => {
    xmlDisplay.contentEditable = true;
    xmlDisplay.classList.add("editing");
    editBtn.style.display = "none";
    confirmBtn.style.display = "inline-block";
    cancelBtn.style.display = "inline-block";
  });

  // CANCEL — revert by simply reloading sentence XML
  cancelBtn.addEventListener("click", () => {
    updateXMLIfActive();
  });

  // CONFIRM — use your existing confirm logic
  confirmBtn.addEventListener("click", () => {
    const plainXML = xmlDisplay.innerText.trim();

    // This calls your existing save pipeline
    document.getElementById("xml-confirm").dispatchEvent(new Event("confirm-xml-save"));
  });
}
