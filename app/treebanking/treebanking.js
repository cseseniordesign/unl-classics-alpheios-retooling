import parseTreeBankXML from './parser.js';

// ===== POS color utilities (muted palette) =====
const POS_COLORS = {
  v: '#c65a5a', // verb
  c: '#c77d9b', // conjunction
  d: '#e69109', // adverb
  i: '#b29100', // interjection
  n: '#4aa7b7', // noun
  a: '#5a78c6', // adjective
  r: '#5a9b6b', // adposition
  l: '#6aa7d6', // article
  p: '#7a5aa9', // pronoun
  u: '#444',    // punctuation
  m: '#888',    // numeral
  '': '#444' // unknown/other
};
const getPOSChar = w => {
   const tag = (w?._displayPostag || w?.postag || '');
   return tag[0] ? tag[0].toLowerCase() : '';
};
const colorForPOS = w => POS_COLORS[getPOSChar(w)] || POS_COLORS[''];


/* ============================================================================
   SECTION 1: XML LOADING AND SENTENCE MANAGEMENT
   ============================================================================ */

/**
 * --------------------------------------------------------------------------
 * FUNCTION: loadTreebankData
 * --------------------------------------------------------------------------
 * Loads and parses the Treebank XML file only once, then caches it globally.
 *
 * @returns {Promise<Array<Object>>} Resolves once XML is fetched and parsed into an array of sentence objects.
 *          Each sentence has { id, words: [...] }.
 */
async function loadTreebankData() {
  // Use the cached dataset if already available
  if (window.treebankData) return window.treebankData;

  try {
    // Fetch the XML file and read it as plain text
    const response = await fetch('../../assets/treebank.xml');
    const xmlText = await response.text();

    // Parse the XML into structured JS objects via parser.js
    window.treebankData = parseTreeBankXML(xmlText);
    return window.treebankData;
  } catch (err) {
    console.error('Error loading XML:', err);
    return [];
  }
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: displaySentence
 * --------------------------------------------------------------------------
 * Renders the given sentence and its dependency tree.
 * Keeps UI buttons and dropdown synchronized with the current view.
 *
 * @param {number} index - Sentence ID (numeric) to display.
 * @returns {Promise<void>} Resolves after loading data and rendering the selected sentence and its tree.
 */
async function displaySentence(index) {
  const tokenizedSentence = document.getElementById('tokenized-sentence');

  // Ensure the dataset is loaded before proceeding
  const data = await loadTreebankData();
  if (!data || data.length === 0) {
    console.warn('No treebank data available.');
    return;
  }

  // If Morph tool is open, close it when changing sentences
  if (window.isMorphActive && typeof window.closeMorphTool === 'function') {
    window.closeMorphTool();
  }

  // Clear previously displayed sentence text
  tokenizedSentence.textContent = '';

  // Constrain the requested index to available range
  window.totalSentences = data.length;
  if (index < 1) index = 1;
  if (index > window.totalSentences) index = window.totalSentences;
  window.currentIndex = index;

  // Sync UI controls for navigation and dropdown
  updateNavigationButtons(index);
  updateSentenceSelector(index);

  // Locate the sentence matching the given ID
  const sentence = data.find(s => s.id === `${index}`);
  if (!sentence) {
    console.warn(`Sentence with id=${index} not found.`);
    return;
  }

  // Render tokens inline above the tree 
    sentence.words.forEach((word) => {
    const button = document.createElement("button");
    button.textContent = word.form + " ";
    button.classList.add("token");
    button.dataset.wordId = word.id;
    button.dataset.pos = getPOSChar(word);
    button.style.color = colorForPOS(word);   // sentence token font color

    // Add click interaction for reassigning heads
    button.addEventListener("click", (event) => {
      handleWordClick(word.id, event);
    });

  tokenizedSentence.appendChild(button);
});

  // Generate and display the D3 dependency tree
  createNodeHierarchy(index);

  // Refresh XML panel if open
  if (typeof window.updateXMLIfActive === 'function') {
    window.updateXMLIfActive();
  }
} 


/**
 * --------------------------------------------------------------------------
 * FUNCTION: handleWordClick
 * --------------------------------------------------------------------------
 * handles changing head when two nodes are selected or displays morph info
 * if morph tab is active
 */

let selectedWordId = null; // keeps track of the first click(dependent word)

function handleWordClick(wordId, event) {

  // If Morph tool is active → just show morph info, don’t alter tree
 if (window.isMorphActive) {
  // Clear all previous selections
  document.querySelectorAll(".token").forEach(t => t.classList.remove("selected"));
  d3.selectAll(".node").classed("selected", false);

  // Select the clicked token and its corresponding tree node
  const token = document.querySelector(`.token[data-word-id='${wordId}']`);
  const node = d3.select(`.node[id='${wordId}']`);

  if (token) token.classList.add("selected");
  if (!node.empty()) {
    node.classed("selected", true);
  }

  // Render the morph info in the tool panel
  const currentSentence = window.treebankData.find(s => s.id === `${window.currentIndex}`);
  const word = currentSentence.words.find(w => w.id === wordId);
  if (word && typeof window.renderMorphInfo === 'function') {
    window.renderMorphInfo(word);
  }

  return;
}
  // Otherwise, normal dependency reassignment mode
  if(!selectedWordId) {
    selectedWordId = wordId;
    //add visual confirmation
    const btn = document.querySelector(`button[data-word-id="${wordId}"]`);
    if (btn) btn.classList.remove("highlight"), btn.classList.add("selected");
    return;
  }
  //remove highlight if same word clicked twice and reset selection
  const newHeadId = wordId;
  if(selectedWordId === newHeadId) {
    const btn = document.querySelector(`button[data-word-id="${wordId}"]`);
    btn.classList.add("highlight"), btn.classList.remove("selected");
    resetSelection();
    return;
  }

  const currentSentence = window.treebankData.find(s => s.id === `${window.currentIndex}`);
  //gets dependent node (first selected node)
  const dependent = currentSentence.words.find(word => word.id === selectedWordId);
  //gets indepenent node (second selected node)
  const independent = currentSentence.words.find(word => word.id === newHeadId);

  if (createsCycle(currentSentence.words, selectedWordId, newHeadId)) {
    // Flip logic — make the old head now depend on the selected word
    independent.head = dependent.head;
  } else if(dependent) {
    // Normal assignment
    dependent.head = newHeadId;
  }
 
  createNodeHierarchy(window.currentIndex);

  resetSelection();
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: resetSelection
 * --------------------------------------------------------------------------
 * resets the first selected word 
 */
function resetSelection() {
  const prev = document.querySelector(".token.selected");
  if (prev) prev.classList.remove("selected");
  selectedWordId = null
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: createsCycle
 * --------------------------------------------------------------------------
 * checks to see if a cycle is created
 */
function createsCycle(words, dependentId, newHeadId) {
  let current = newHeadId;
  while (current && current !== "0" && current !== "root") {
    if (current === dependentId) return true;
    const parent = words.find(w => w.id === current);
    current = parent ? parent.head : null;
  }
  return false;
}


/**
 * --------------------------------------------------------------------------
 * FUNCTION: updateNavigationButtons
 * --------------------------------------------------------------------------
 * Enables or disables "first/back/next/last" buttons as needed.
 *
 * @param {number} index - Current active sentence index.
 * @returns {void} Runs synchronously to update navigation button states.
 */
function updateNavigationButtons(index) {
  document.getElementById('first').disabled = (index <= 1);
  document.getElementById('back').disabled  = (index <= 1);
  document.getElementById('next').disabled  = (index >= window.totalSentences);
  document.getElementById('last').disabled  = (index >= window.totalSentences);
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupSentenceSelector
 * --------------------------------------------------------------------------
 * Populates and manages the dropdown menu that lists all sentence IDs.
 *
 * @returns {void} Runs synchronously to populate and manage the sentence dropdown.
 */
function setupSentenceSelector() {
  const select = document.getElementById('sentence-select');
  if (!select) return;

  // Clear existing dropdown options
  select.innerHTML = '';

  const data = window.treebankData;
  if (!data || !data.length) return;

  // Populate new options from available sentences
  data.forEach(sentence => {
    const opt = document.createElement('option');
    opt.value = sentence.id;
    opt.textContent = `${sentence.id}`;
    select.appendChild(opt);
  });

  // Default to currently displayed sentence
  select.value = window.currentIndex || 1;

  // On selection change, show the chosen sentence
  select.addEventListener('change', (e) => {
    const selectedId = parseInt(e.target.value);
    displaySentence(selectedId);
  });
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupWordHoverSync
 * --------------------------------------------------------------------------
 * highlights corresponding words and nodes that are moused over.
 */
function setupWordHoverSync() {
  const words = document.querySelectorAll(".token");
  const nodes = document.querySelectorAll(".node");
  //align ids between words and nodes 
  //whenever hovering over a word it highlights corresponding node
  words.forEach(word => {
    const id = word.dataset.wordId;
    word.addEventListener("mouseover", () => {
      word.classList.add("highlight");
      const node = document.querySelector(`.node[id="${id}"]`);
      if (node) node.classList.add("highlight");
    });
    //unhighlights when mouse is moved
    word.addEventListener("mouseleave", () => {
      word.classList.remove("highlight");
      const node = document.querySelector(`.node[id="${id}"]`);
      if (node) node.classList.remove("highlight");
    });
  });

  //whenever hovering over a node it highlights corresponding word
  nodes.forEach(node => {
    const id = node.id;
    node.addEventListener("mouseover", () => {
      node.classList.add("highlight");
      const word = document.querySelector(`.token[data-word-id="${id}"]`);
      if (word) word.classList.add("highlight");
    });
    //unhighlights when mouse is moved
    node.addEventListener("mouseleave", () => {
      node.classList.remove("highlight");
      const word = document.querySelector(`.token[data-word-id="${id}"]`);
      if (word) word.classList.remove("highlight");
    });
  });
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: updateSentenceSelector
 * --------------------------------------------------------------------------
 * Keeps dropdown visually synchronized with the displayed sentence.
 *
 * @param {number} index - Current active sentence index.
 * @returns {void} Runs synchronously to keep dropdown in sync with the displayed sentence.
 */
function updateSentenceSelector(index) {
  const select = document.getElementById('sentence-select');
  if (select) select.value = index;
}

/* ============================================================================
   SECTION 2: BUTTONS AND INTERFACE BEHAVIOR
   ============================================================================ */

/*
*   This event is used to save the file from parseTreeBankXML
*   to the local system of the user. As of now, it fetches the file
*   specified location and saves the .xml file to the downloads folder
*   of the user system. Eventually it should save the xml file that is
*   currently being worked on.
*/
document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("download");

  button.addEventListener("click", async () => {
    // Regenerate XML dynamically from in-memory data
    const data = window.treebankData || [];
    let xmlOut = '<?xml version="1.0" encoding="UTF-8"?>\n<treebank>\n';

    for (const s of data) {
      xmlOut += `  <sentence id="${s.id}">\n`;
      for (const w of s.words) {
        // Use active form values
        const lemma = (w._displayLemma || w.lemma || '').replace(/"/g, '&quot;');
        const postag = (w._displayPostag || w.postag || '').replace(/"/g, '&quot;');
        xmlOut += `    <word id="${w.id}" form="${w.form}" lemma="${lemma}" postag="${postag}" relation="${w.relation}" head="${w.head}" />\n`;
      }
      xmlOut += '  </sentence>\n';
    }
    xmlOut += '</treebank>';

    // Create a Blob with the generated XML
    const blob = new Blob([xmlOut], { type: "application/xml" });
    const fileName = "Treebank.xml";

    // Create temporary download link and click it
    const el = document.createElement('a');
    el.href = URL.createObjectURL(blob);
    el.download = fileName;

    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
    URL.revokeObjectURL(el.href);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("save");

  button.addEventListener("click", async () => {
    alert("Oops! This functionality is still under construction. Please check back soon!");
  });
});

// focus on root button (treebank view)
document.getElementById("focus-root").addEventListener("click", () => {
  if (window.root) {
    focusOnNode(window.root);
  } else {
    console.warn("Root not found");
  }
});

// compact and expand tree buttons (treebank view)
document.addEventListener("DOMContentLoaded", () => {
  const compactBtn = document.getElementById("compact");
  const expandBtn = document.getElementById("expand");

  if (compactBtn && expandBtn) {
    compactBtn.addEventListener("click", compactTree);
    expandBtn.addEventListener("click", expandTree);
  } else {
    console.warn("Buttons not found in DOM.");
  }
});

// center button (treebank view)
document.getElementById("center").addEventListener("click", () => {
  fitTreeToView(window.svg, window.gx, window.container, window.zoom, window.margin);
});

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
function setupXMLTool() {
  const xmlBtn = document.getElementById('xml');
  const toolBody = document.getElementById('tool-body');
  const allToolButtons = document.querySelectorAll('#toolbar button');

  // --- Defensive guard: ensure required DOM elements exist ---
  if (!xmlBtn || !toolBody) return;

  let isXMLActive = false; // Tracks whether the XML view is currently open

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
  function formatXML(xmlString) {
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
   * FUNCTION: getCurrentSentenceXML
   * --------------------------------------------------------------------------
   * Retrieves the XML representation of the currently displayed sentence.
   * Only includes the current sentence and its <word> elements.
   *
   * @returns {string} Escaped and formatted XML markup.
   */
  function getCurrentSentenceXML() {
    const data = window.treebankData?.find(s => s.id === `${window.currentIndex}`);
    if (!data) return '&lt;!-- No sentence loaded --&gt;';

    // Construct XML with line breaks
    const words = data.words.map(w => {
      const lemma  = w._displayLemma  || w.lemma  || '';
      const postag = w._displayPostag || w.postag || '';
      const safeLemma  = lemma.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const safePostag = postag.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      return `  &lt;word id="${w.id}" form="${w.form}" lemma="${safeLemma}" postag="${safePostag}" relation="${w.relation}" head="${w.head}" /&gt;`;
    }).join('\n');

    const xml = `&lt;sentence id="${data.id}"&gt;\n${words}\n&lt;/sentence&gt;`;
    return xml;
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
  function highlightXML(xmlString) {
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

  window.updateXMLIfActive = updateXMLIfActive;

    /**
   * --------------------------------------------------------------------------
   * FUNCTION: updateXMLIfActive
   * --------------------------------------------------------------------------
   * Refreshes the XML panel automatically when navigating between sentences.
   * Does nothing if XML view is not active.
   *
   * @returns {void}
   */
  function updateXMLIfActive() {
    if (!isXMLActive) return;  // Only update if XML view is currently visible

    const rawXML = getCurrentSentenceXML();
    const formatted = formatXML(rawXML);
    const highlighted = highlightXML(formatted);
    toolBody.innerHTML = `<pre class="xml-display">${highlighted}</pre>`;
    toolBody.scrollTop = 0; // resets scroll if sentence is changed
  }

  /**
   * --------------------------------------------------------------------------
   * FUNCTION: enterReadOnly
   * --------------------------------------------------------------------------
   * Disables all interactivity on the dependency tree.
   * Called when the XML panel is active.
   *
   * @returns {void} Sets read-only flag and dims the SVG display.
   */
  function enterReadOnly() {
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
  function exitReadOnly() {
    window.isReadOnly = false;
    d3.select('#sandbox svg')
      .style('pointer-events', 'all')
      .style('opacity', 1);
  }

  /**
   * --------------------------------------------------------------------------
   * EVENT LISTENER: XML Button Click
   * --------------------------------------------------------------------------
   * Toggles the XML panel on and off. When enabled:
   *  - Shows indented, syntax-highlighted XML for the current sentence.
   *  - Locks the tree for read-only viewing.
   *
   * @returns {void}
   */
  xmlBtn.addEventListener('click', () => {
    const wasActive = isXMLActive;

    // Reset all toolbar button states
    allToolButtons.forEach(btn => btn.classList.remove('active'));
    isXMLActive = !wasActive; // toggle

    if (isXMLActive) {
      // --- Activate XML mode ---
      xmlBtn.classList.add('active');

      // Get and process current XML
      const rawXML = getCurrentSentenceXML();
      const formatted = formatXML(rawXML);
      const highlighted = highlightXML(formatted);

      // Display inside the right-side panel
      toolBody.innerHTML = `<pre class="xml-display">${highlighted}</pre>`;

      // Lock tree
      enterReadOnly();

      document.body.classList.remove('mode-morph');
    } else {
      // --- Exit XML mode ---
      toolBody.innerHTML = '<p>this is the body of each tool option</p>';
      exitReadOnly();
    }
  });
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupMorphTool
 * --------------------------------------------------------------------------
 * Enables the "Morph" tab on the right-hand toolbar.
 * When the Morph button is active, clicking a word displays its morph info.
 * --------------------------------------------------------------------------
 */
function setupMorphTool() {
  const morphBtn = document.getElementById('morph');
  const toolBody = document.getElementById('tool-body');
  const allToolButtons = document.querySelectorAll('#toolbar button');
  if (!morphBtn || !toolBody) return;

  // Track on/off state from the toolbar button
  window.isMorphActive = false;

  // Allow other code to close Morph (e.g., when sentence changes)
  window.closeMorphTool = function () {
    if (!window.isMorphActive) return;
    window.isMorphActive = false;
    morphBtn.classList.remove('active');
    toolBody.innerHTML = `<p>this is the body of each tool option</p>`;
    // clear highlights
    document.querySelectorAll(".token.selected").forEach(t => t.classList.remove("selected"));
    d3.selectAll(".node").classed("selected", false);
  };

  morphBtn.addEventListener('click', () => {
    const wasActive = window.isMorphActive;
    allToolButtons.forEach(btn => btn.classList.remove('active'));
    window.isMorphActive = !wasActive;

    if (window.isMorphActive) {
      document.body.classList.add('mode-morph');
      morphBtn.classList.add('active');
      toolBody.innerHTML = `<p style="padding:8px;">Click a word to view morphological info.</p>`;
    } else {
      document.body.classList.remove('mode-morph');
      d3.selectAll(".node").classed("selected", false);
      document.querySelectorAll(".token.selected").forEach(t => t.classList.remove("selected"));
      toolBody.innerHTML = `<p>this is the body of each tool option</p>`;
    }
  });

  // ---------------------------------------------
  // Utilities for colors/labels in the morph pane
  // ---------------------------------------------
  const POS_COLORS = {
    v:'#c65a5a', c:'#c77d9b', d:'#e69109', i:'#b29100', n:'#4aa7b7', a:'#5a78c6',
    r:'#5a9b6b', l:'#6aa7d6', p:'#7a5aa9', u:'#444', m:'#888', '':'#444'
  };

  const getPOSChar = w => {
    const tag = (w?._displayPostag || w?.postag || '');
    return tag[0] ? tag[0].toLowerCase() : '';
  };
  const colorForPOS = (w) => colorForTag(w?._displayPostag || w?.postag || '');

  // Color directly from a compact tag, without looking at the active display tag
  function colorForTag(tag) {
    const ch = (tag && tag[0]) ? tag[0].toLowerCase() : '';
    return POS_COLORS[ch] || POS_COLORS[''];
  }

  const POS_SHORT = { v:'verb', n:'noun', a:'adj', d:'adv', p:'pron', c:'conj', r:'adp', l:'art', m:'num', i:'intj', u:'punc' };
  function shortPOS(tag){ const ch=(tag&&tag[0])?tag[0].toLowerCase():''; return POS_SHORT[ch]||''; }

  // Parse compact POSTAG → readable fields (kept from your version)
  function parseMorphTag(tag) {
    if (!tag) return {};
    const posMap = {v:"verb",n:"noun",a:"adjective",d:"adverb",p:"pronoun",
      c:"conjunction",r:"adposition",l:"article",m:"numeral",i:"interjection",u:"punctuation"};
    const tenseMap  = { p:"present", i:"imperfect", r:"perfect", l:"plusquamperfect", f:"future", a:"aorist" };
    const moodMap   = { i:"indicative", s:"subjunctive", o:"optative", n:"infinitive", m:"imperative", p:"participle" };
    const voiceMap  = { a:"active", e:"medio-passive", p:"passive" };
    const numberMap = { s:"singular", p:"plural", d:"dual" };
    const personMap = { "1":"first person","2":"second person","3":"third person" };
    const genderMap = { m:"masculine", f:"feminine", n:"neuter", c:"common" };
    const caseMap   = { n:"nominative", g:"genitive", d:"dative", a:"accusative", v:"vocative" };

    const parsed = {};
    const pos = tag[0];
    parsed["Part of Speech"] = posMap[pos] || "";

    if (pos === "v") {
      parsed["Person"] = personMap[tag[1]] || "";
      parsed["Number"] = numberMap[tag[2]] || "";
      parsed["Tense"]  = tenseMap[tag[3]]  || "";
      parsed["Mood"]   = moodMap[tag[4]]   || "";
      parsed["Voice"]  = voiceMap[tag[5]]  || "";
    } else if (pos === "n" || pos === "a" || pos === "p" || pos === "l") {
      parsed["Number"] = numberMap[tag[2]] || "";
      parsed["Gender"] = genderMap[tag[6]] || "";
      parsed["Casus"]  = caseMap[tag[7]]   || "";
    }
    return parsed;
  }

  // Keep original XML values safe and use shadow fields for rendering
  function ensureDocumentSnapshot(word) {
    if (!word) return;
    if (!word._doc) {
      word._doc = {
        lemma:  (word.lemma  || '').trim(),
        postag: (word.postag || '').trim()
      };
    }
    // default display = document
    if (word._displayLemma === undefined)  word._displayLemma  = word._doc.lemma;
    if (word._displayPostag === undefined) word._displayPostag = word._doc.postag;
    word.source = 'document';
  }

  function enableMorphEntryExpansion(scopeEl) {
    // Prevent attaching this listener multiple times to the same container
    if (scopeEl._expansionBound) return;
    scopeEl._expansionBound = true;

    scopeEl.addEventListener('click', (e) => {
      const entry = e.target.closest('.morph-entry');
      if (!entry || !scopeEl.contains(entry)) return;

      // Ignore clicks that originate on the checkbox itself
      if (e.target.matches('input[type="checkbox"]')) return;

      // Toggle
      const isExpanded = entry.classList.contains('expanded');

      if (isExpanded) {
        // Collapse
        entry.classList.remove('expanded');
        entry.setAttribute('data-expanded', 'false');
        entry.querySelector('.morph-details')?.remove();
        entry.querySelector('.morph-divider')?.remove();
        return;
      }

      // Expand
      entry.classList.add('expanded');
      entry.setAttribute('data-expanded', 'true');

      const tagEl = entry.querySelector('.morph-tag');
      const tag = tagEl ? tagEl.textContent.trim() : '';
      const parsed = parseMorphTag(tag);
      if (!parsed || Object.keys(parsed).length === 0) return;

      const divider = document.createElement('hr');
      divider.className = 'morph-divider';
      entry.appendChild(divider);

      const detailsHTML = Object.entries(parsed)
        .map(([label, val]) => `
          <div class="morph-row">
            <div class="morph-label">${label}</div>
            <div class="morph-colon">:</div>
            <div class="morph-value">${val}</div>
          </div>
        `)
        .join('');

      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'morph-details';
      detailsDiv.innerHTML = detailsHTML;
      entry.appendChild(detailsDiv);
    });
  }

  function removeForm(word, index) {
    if (!Array.isArray(word.forms)) return;

    // If index < 0, it's the document form
    if (index < 0) {
      // Clear both display and XML-level values
      word._doc = { lemma: '', postag: '' };
      word._displayLemma = '';
      word._displayPostag = '';
      word.lemma = '';     // clear from actual XML-bound field
      word.postag = '';    // clear from actual XML-bound field
      word.source = 'document';

      // Update token color + tree
      applyActiveSelectionToWord(word);

      // Re-render XML view if open
      if (typeof window.updateXMLIfActive === 'function') {
        window.updateXMLIfActive();
      }
      return;
    }

    // Otherwise delete user/morpheus form
    word.forms.splice(index, 1);
    if (word.activeForm === index) word.activeForm = -1;
    else if (word.activeForm > index) word.activeForm -= 1;
    applyActiveSelectionToWord(word);
  }


  // ---------------------------------------------------------
  // PUBLIC: renderMorphInfo(word) — keep your top card intact,
  // then append "Create new form" + user-forms list underneath
  // ---------------------------------------------------------
  function renderMorphInfo(word) {
    if (!window.isMorphActive) return;
    if (!toolBody || !word) return;

    // ensure we have original XML snapshot
    ensureDocumentSnapshot(word);

    // --- Render top "document" card using the same card builder ---
    const lemma  = word._doc.lemma;
    const postag = word._doc.postag;
    const posColor = colorForTag(postag);

    // Construct the document form object
    const documentForm = {
      lemma: lemma,
      postag: postag,
      source: 'document'
    };

    // Replace old hardcoded HTML with unified helper call
    toolBody.innerHTML = `
      <div class="morph-container">
        <p class="morph-form">
          ${word.form}
          <span class="morph-id" style="color:#9aa3ad">${window.currentIndex}-${word.id}</span>
        </p>
        ${(word._doc.lemma || word._doc.postag)
          ? userFormCardHTML(documentForm, -1, word.activeForm === -1)
          : ''}
      </div>
    `;

    // Style tweaks after insertion
    const lemmaEl = toolBody.querySelector('.morph-lemma');
    if (lemmaEl) lemmaEl.style.color = posColor;

    const mc = toolBody.querySelector('.morph-container');
    if (mc) enableMorphEntryExpansion(mc);

    // Append creation/editor + list BELOW the top card 
    appendCreateAndUserForms(word, toolBody);

    // Force all morph entries to start collapsed after forms are rebuilt
    document.querySelectorAll('.morph-entry').forEach(entry => {
      entry.classList.remove('expanded');
      entry.dataset.expanded = 'false';
      entry.querySelector('.morph-details')?.remove();
      entry.querySelector('.morph-divider')?.remove();
    });

    // === Restore expanded states if re-rendered ===
    document.querySelectorAll('.morph-entry').forEach(entry => {
      if (entry.dataset.expanded === 'true') {
        const tagEl = entry.querySelector('.morph-tag');
        const tag = tagEl ? tagEl.textContent.trim() : '';
        const parsed = parseMorphTag(tag);
        if (parsed && Object.keys(parsed).length > 0) {
          const divider = document.createElement('hr');
          divider.className = 'morph-divider';
          entry.appendChild(divider);

          const detailsHTML = Object.entries(parsed)
            .map(([label, val]) => `
              <div class="morph-row">
                <div class="morph-label">${label}</div>
                <div class="morph-colon">:</div>
                <div class="morph-value">${val}</div>
              </div>
            `)
            .join('');
          const detailsDiv = document.createElement('div');
          detailsDiv.className = 'morph-details';
          detailsDiv.innerHTML = detailsHTML;
          entry.appendChild(detailsDiv);
        }
      }
    });
  }
  window.renderMorphInfo = renderMorphInfo;

  // =========================
  // Forms management helpers
  // =========================

  function ensureFormsArray(word) {
    if (!Array.isArray(word.forms)) {
      word.forms = [];
    }

    if (typeof word.activeForm !== 'number') {
      word.activeForm = -1; // default to the XML/document form
    }
  }

  function composeUserPostag(posChar, fields) {
    const tag = Array(9).fill('-');
    tag[0] = posChar || '-';

    if (posChar === 'v') {
      // v[1]=person, [2]=number, [3]=tense, [4]=mood, [5]=voice
      if (fields.person) tag[1] = fields.person;
      if (fields.number) tag[2] = fields.number;
      if (fields.tense)  tag[3] = fields.tense;
      if (fields.mood)   tag[4] = fields.mood;
      if (fields.voice)  tag[5] = fields.voice;
    } else if (['n','p','l'].includes(posChar)) {
      // noun/pron/article: [2]=number, [6]=gender, [7]=case
      if (fields.number) tag[2] = fields.number;
      if (fields.gender) tag[6] = fields.gender;
      if (fields.case)   tag[7] = fields.case;
    } else if (posChar === 'a') {
      // adjective
      if (fields.number) tag[2] = fields.number;
      if (fields.gender) tag[6] = fields.gender;
      if (fields.case)   tag[7] = fields.case;
      if (fields.degree) tag[5] = fields.degree; // harmless if not used
    }
    // other POS (c, d, r, u, m, i): POS only at [0] is fine
    return tag.join('');
  }

  function userFormCardHTML(form, index, isActive) {
    const readable = Object.values(parseMorphTag(form.postag || ''))
      .filter(Boolean)
      .map(v => v.replace(' person','').replace(' ', '.'))
      .join('.');
    const col = colorForTag(form.postag || '');

    const expandedClass = isActive ? ' expanded' : '';
    const expandedAttr  = isActive ? 'true' : 'false';
    const cbId = `uf-check-${index}`;
    const src = form.source || 'you';

    // Only allow delete button for "you" and "document" forms
    const deleteBtn = (src === 'you' || src === 'document')
      ? `<button class="delete-form" title="Delete this form">Delete Form</button>`
      : '';

    return `
      <div class="morph-entry user-form${expandedClass}" 
          data-index="${index}" 
          data-expanded="${expandedAttr}" 
          aria-expanded="${expandedAttr}">
        <input id="${cbId}" type="checkbox" ${isActive ? 'checked' : ''} />
        <div class="morph-content">
          <span class="morph-lemma" style="color:${col}">
            ${form.lemma || ''}
          </span>
          <p class="morph-tag">${form.postag || ''}</p>
          <p class="morph-source">${src}</p>
          <p class="morph-readout">${readable || shortPOS(form.postag)}</p>
        </div>
        ${deleteBtn}
      </div>
    `;
  }



  function appendCreateAndUserForms(word, toolBody) {
    ensureFormsArray(word);

    // Render user forms list
    renderUserFormsList(word, toolBody);

    // Make top card checkbox reflect whether XML/doc is the active one
    const topCheckbox = toolBody.querySelector('.morph-entry > input[type="checkbox"]');
    if (topCheckbox) topCheckbox.checked = (word.activeForm === -1);

    // Clicking the top checkbox activates the XML/doc form
    topCheckbox?.addEventListener('change', (e) => {
      if (e.target.checked) {
        word.activeForm = -1;
        applyActiveSelectionToWord(word);
        window.renderMorphInfo(word);
      }
    });

    // Create button (under top card)
    if (!toolBody.querySelector('.morph-create')) {
      const btn = document.createElement('button');
      btn.className = 'morph-create';
      btn.textContent = 'Create new form';
      toolBody.querySelector('.morph-container')?.appendChild(btn);
      btn.addEventListener('click', () => renderCreateEditorBelow(word, toolBody));
    }

    // --- Enable delete for the top (document) card ---
    const docDeleteBtn = toolBody.querySelector('.morph-container > .user-form .delete-form');
    if (docDeleteBtn) {
      docDeleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const confirmDelete = confirm('Delete the document form?');
        if (!confirmDelete) return;

        removeForm(word, -1);       // triggers document clear
        window.renderMorphInfo(word); // re-render UI
      });
    }
  }

  function renderUserFormsList(word, toolBody) {
    ensureFormsArray(word);
    let list = toolBody.querySelector('.user-forms-list');
    if (!list) {
      list = document.createElement('div');
      list.className = 'user-forms-list';
      toolBody.querySelector('.morph-container')?.appendChild(list);
    }
    list.innerHTML = word.forms.map((f, i) =>
      userFormCardHTML(f, i, word.activeForm === i)
    ).join('');

    const mc = toolBody.querySelector('.morph-container');
    if (mc) enableMorphEntryExpansion(mc);

    // When a checkbox is toggled, make that form active
    list.querySelectorAll('.morph-entry input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (!e.target.checked) return; // only handle when checked

        // uncheck all other boxes
        list.querySelectorAll('input[type="checkbox"]').forEach(x => {
          if (x !== e.target) x.checked = false;
        });

        // determine which form this belongs to
        const card = e.target.closest('.user-form');
        const idx = Number(card.dataset.index);

        // update active form and apply globally
        word.activeForm = idx;
        applyActiveSelectionToWord(word);

        // re-render Morph panel and update XML tab
        window.renderMorphInfo(word);
        if (typeof window.updateXMLIfActive === 'function') {
          window.updateXMLIfActive();
        }
      });
    });


    // Delete buttons
    list.querySelectorAll('.delete-form').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.user-form');
        const idx = Number(card.dataset.index);
        const confirmDelete = confirm('Delete this form?');
        if (!confirmDelete) return;

        removeForm(word, idx);
        renderUserFormsList(word, toolBody);
        window.renderMorphInfo(word);
      });
    });
  }

    function applyActiveSelectionToWord(word) {
    ensureDocumentSnapshot(word);

    if (word.activeForm === -1) {
      // show the original XML values
      word._displayLemma  = word._doc.lemma;
      word._displayPostag = word._doc.postag;
      word.source = 'document';
    } else {
      const f = word.forms?.[word.activeForm];
      if (f) {
        word._displayLemma  = (f.lemma  || word._doc.lemma);
        word._displayPostag = (f.postag || word._doc.postag);
        word.source = 'you';
      }
    }
    const tok = document.querySelector(`.token[data-word-id="${word.id}"]`);
    if (tok) tok.style.color = colorForPOS(word); // uses _displayPostag

    // Rebuild the tree so node colors update, but keep Morph open
    if (typeof createNodeHierarchy === 'function') {
      createNodeHierarchy(window.currentIndex);
    }
    if (typeof window.updateXMLIfActive === 'function') {
      window.updateXMLIfActive();
    }
  }

  // Inline editor that appears under the button and closes on save
  function renderCreateEditorBelow(word, toolBody) {
    ensureFormsArray(word);

    // Only one editor at a time
    toolBody.querySelector('.morph-editor-inline')?.remove();

    const host = document.createElement('div');
    host.className = 'morph-editor-inline';
    host.style.marginTop = '12px';
    host.innerHTML = `
      <div class="field">
        <label>Lemma</label>
        <input id="nf-lemma" type="text" value="${(word.lemma || '').trim()}" />
      </div>

      <div class="field">
        <label>Part of Speech</label>
        <select id="nf-pos">
          <option value="">— choose —</option>
          <option value="n">noun</option>
          <option value="a">adjective</option>
          <option value="v">verb</option>
          <option value="p">pronoun</option>
          <option value="l">article</option>
          <option value="d">adverb</option>
          <option value="c">conjunction</option>
          <option value="r">adposition</option>
          <option value="m">numeral</option>
          <option value="i">interjection</option>
          <option value="u">punctuation</option>
        </select>
      </div>

      <div id="nf-dynamic"></div>

      <div class="morph-actions">
        <button id="nf-reset" class="btn btn-reset" type="button">Reset</button>
        <button id="nf-save"  class="btn btn-save"  type="button">Save</button>
      </div>
    `;
    toolBody.querySelector('.morph-container')?.appendChild(host);

    const nfLemma = host.querySelector('#nf-lemma');
    const nfPos   = host.querySelector('#nf-pos');
    const nfDyn   = host.querySelector('#nf-dynamic');

    // Option maps
    const TENSE  = { "": "---", p:"present", i:"imperfect", r:"perfect", l:"plusquamperfect", f:"future", a:"aorist" };
    const MOOD   = { "": "---", i:"indicative", s:"subjunctive", o:"optative", n:"infinitive", m:"imperative", p:"participle" };
    const VOICE  = { "": "---", a:"active", e:"medio-passive", p:"passive" };
    const NUMBER = { "": "---", s:"singular", p:"plural", d:"dual" };
    const GENDER = { "": "---", m:"masculine", f:"feminine", n:"neuter", c:"common" };
    const CASES  = { "": "---", n:"nominative", g:"genitive", d:"dative", a:"accusative", v:"vocative" };
    const DEGREE = { "": "---", p:"positive", c:"comparative", s:"superlative" };

    const buildSelect = (id, map) => {
      const sel = document.createElement('select'); sel.id = id;
      Object.entries(map).forEach(([v,l]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = l; sel.appendChild(o);
      });
      sel.className = 'cf-select';
      sel.style.width = '100%';
      return sel;
    };

    function renderDynamicForPOS(pos) {
      nfDyn.innerHTML = '';
      const add = (label, el) => {
        const wrap = document.createElement('div');
        wrap.className = 'field';
        const lab = document.createElement('label'); lab.textContent = label;
        wrap.append(lab, el); nfDyn.appendChild(wrap);
      };
      if (pos === 'v') {
        add('Tense',  buildSelect('nf-tense',  TENSE));
        add('Mood',   buildSelect('nf-mood',   MOOD));
        add('Voice',  buildSelect('nf-voice',  VOICE));
      } else if (pos === 'a') {
        add('Number', buildSelect('nf-num',    NUMBER));
        add('Gender', buildSelect('nf-g',      GENDER));
        add('Casus',  buildSelect('nf-case',   CASES));
        add('Degree', buildSelect('nf-deg',    DEGREE));
      } else if (['n','p','l'].includes(pos)) {
        add('Number', buildSelect('nf-num',    NUMBER));
        add('Gender', buildSelect('nf-g',      GENDER));
        add('Casus',  buildSelect('nf-case',   CASES));
      }
    }

    nfPos.addEventListener('change', e => renderDynamicForPOS(e.target.value));

    host.querySelector('#nf-reset').addEventListener('click', () => {
      nfLemma.value = (word.lemma || '').trim();
      nfPos.value = '';
      nfDyn.innerHTML = '';
    });

    host.querySelector('#nf-save').addEventListener('click', () => {
      // Guardrail: POS is required
      if (!nfPos.value) {
        alert('Please choose a Part of Speech.');
        return;
      }

      const posChar = nfPos.value;

      // Collect dynamic fields if present
      const fields = {
        tense:  nfDyn.querySelector('#nf-tense')?.value || '',
        mood:   nfDyn.querySelector('#nf-mood')?.value  || '',
        voice:  nfDyn.querySelector('#nf-voice')?.value || '',
        number: nfDyn.querySelector('#nf-num')?.value   || '',
        gender: nfDyn.querySelector('#nf-g')?.value     || '',
        case:   nfDyn.querySelector('#nf-case')?.value  || '',
        degree: nfDyn.querySelector('#nf-deg')?.value   || ''
      };

      // --- Require all visible fields to be filled in ---
      const missingFields = [];

      // Clear old highlights first
      nfDyn.querySelectorAll('.field').forEach(f => f.classList.remove('invalid'));
      nfLemma.closest('.field')?.classList.remove('invalid');

      const markInvalid = (el) => el?.closest('.field')?.classList.add('invalid');

      // Lemma required
      if (!nfLemma.value.trim()) {
        missingFields.push('Lemma');
        markInvalid(nfLemma);
      }

      // For verbs
      if (posChar === 'v') {
        const tenseEl = nfDyn.querySelector('#nf-tense');
        const moodEl  = nfDyn.querySelector('#nf-mood');
        const voiceEl = nfDyn.querySelector('#nf-voice');
        if (!fields.tense) { missingFields.push('Tense'); markInvalid(tenseEl); }
        if (!fields.mood)  { missingFields.push('Mood');  markInvalid(moodEl); }
        if (!fields.voice) { missingFields.push('Voice'); markInvalid(voiceEl); }
      }

      // For nouns, pronouns, articles
      if (['n', 'p', 'l'].includes(posChar)) {
        const numEl = nfDyn.querySelector('#nf-num');
        const gEl   = nfDyn.querySelector('#nf-g');
        const cEl   = nfDyn.querySelector('#nf-case');
        if (!fields.number) { missingFields.push('Number'); markInvalid(numEl); }
        if (!fields.gender) { missingFields.push('Gender'); markInvalid(gEl); }
        if (!fields.case)   { missingFields.push('Case');   markInvalid(cEl); }
      }

      // For adjectives
      if (posChar === 'a') {
        const numEl = nfDyn.querySelector('#nf-num');
        const gEl   = nfDyn.querySelector('#nf-g');
        const cEl   = nfDyn.querySelector('#nf-case');
        const dEl   = nfDyn.querySelector('#nf-deg');
        if (!fields.number) { missingFields.push('Number'); markInvalid(numEl); }
        if (!fields.gender) { missingFields.push('Gender'); markInvalid(gEl); }
        if (!fields.case)   { missingFields.push('Case');   markInvalid(cEl); }
        if (!fields.degree) { missingFields.push('Degree'); markInvalid(dEl); }
      }

      if (missingFields.length > 0) {
        alert(`Please fill in all required fields:\n${missingFields.join(', ')}`);
        return;
      }

      // Remove red outline when user fixes a field
      host.querySelectorAll('select, input').forEach(el => {
        el.addEventListener('input', () => el.closest('.field')?.classList.remove('invalid'));
        el.addEventListener('change', () => el.closest('.field')?.classList.remove('invalid'));
      });

      // Compose a compact tag using your helper already in this file
      const postag = composeUserPostag(posChar, fields);
      const normalizedLemma = (nfLemma.value || '').trim() || word.form;

      // Save the new form and activate it
      word.forms.push({ lemma: normalizedLemma, postag, source: 'you' });
      word.activeForm = word.forms.length - 1;

      // Apply to the token/tree and refresh list, then close editor
      applyActiveSelectionToWord(word);
      renderUserFormsList(word, toolBody);
      host.remove();

      // Ensure the top (document) checkbox is unticked when user form is active
      const topCheckbox = toolBody.querySelector('.morph-entry > input[type="checkbox"]');
      if (topCheckbox) topCheckbox.checked = false;

      // Re-render header card so colors/tags mirror the active form
      if (typeof window.renderMorphInfo === 'function') {
        window.renderMorphInfo(word);
      }
    });
  }

  // When any form checkbox changes, collapse all expanded morph entries
  document.addEventListener('change', (e) => {
    if (!e.target.matches('.morph-entry input[type="checkbox"]')) return;
    document.querySelectorAll('.morph-entry.expanded').forEach(entry => {
      entry.classList.remove('expanded');
      entry.dataset.expanded = 'false';
      entry.querySelector('.morph-details')?.remove();
      entry.querySelector('.morph-divider')?.remove();
    });
  });
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupResizeHandle
 * --------------------------------------------------------------------------
 * Enables vertical resizing between the sentence box and the tree view.
 * User can drag the divider to control how much space each occupies.
 *
 * @returns {void} Runs synchronously to enable resizing interaction between sentence and tree view.
 */
function setupResizeHandle() {
  const treeView     = document.getElementById('tree-view');
  const sentenceBox  = document.getElementById('sentence');
  const resizeHandle = document.getElementById('resize-handle');
  if (!treeView || !sentenceBox || !resizeHandle) return;

  let isResizing = false;
  let startY;
  let startHeight;

  // Start resizing on mousedown
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = sentenceBox.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    e.preventDefault();
  });

  // Adjust height dynamically as mouse moves
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const dy = e.clientY - startY;
    const newHeight = startHeight + dy;
    const parentHeight = treeView.offsetHeight;
    const minHeight = 50;
    const maxHeight = parentHeight * 0.85;

    if (newHeight >= minHeight && newHeight <= maxHeight) {
      sentenceBox.style.height = `${newHeight}px`;
      sentenceBox.style.overflowY = 'auto';
    }
  });

  // Stop resizing on mouse release
  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = 'default';
  });
}

/* ============================================================================
   SECTION 3: TREE RENDERING PIPELINE (D3)
   ============================================================================ */

// GLOBAL VARIABLES 
window.root = null;
window.svg = null;
window.gx = null;
window.idParentPairs = null;
window.verticalSpacing = 1; // controls vertical link length 

/**
 * --------------------------------------------------------------------------
 * FUNCTION: createNodeHierarchy
 * --------------------------------------------------------------------------
 * Builds and displays a dependency tree for a specific sentence.
 * Coordinates all subroutines: data lookup, D3 layout, SVG creation,
 * link and node rendering, zooming, and fitting.
 *
 * @param {string|number} sentenceId - ID of the sentence to visualize.
 * @returns {void} Runs synchronously to render the dependency tree for the specified sentence.
 */
function createNodeHierarchy(sentenceId) {
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
  window.idParentPairs = idParentPairs; // global variable for idParentPairs

  // Generate a hierarchical layout from the flat data
  const rootHierarchy = buildHierarchy(idParentPairs);

  // Make the current D3 root hierarchy globally accessible
  window.root = rootHierarchy;

  // Select and reset the SVG container
  window.svg = d3.select('#sandbox svg');
  svg.selectAll('*').remove();

  // Configure SVG to match container size and aspect ratio
  window.container = document.getElementById('tree-bank');
  const width = container.clientWidth;
  const height = container.clientHeight;
  svg.attr('width', width)
     .attr('height', height)
     .attr('viewBox', [0, 0, width, height])
     .attr('preserveAspectRatio', 'xMidYMid meet');

  // Margins prevent content from touching the edges
  window.margin = { top: 40, right: 40, bottom: 40, left: 40 };

  // Create main group (g) which supports zoom/pan transformations
  window.g = svg.append('g')
               .attr('transform', `translate(${margin.left},${margin.top})`);

  // gx is the inner drawing group containing links and nodes
  window.gx = g.append('g');

  // Draw visual elements (edges and nodes)
  drawLinks(gx, rootHierarchy, idParentPairs);
  drawNodes(gx, rootHierarchy);

  // Enable zooming and panning with safe scale limits
  window.zoom = d3.zoom()
    .scaleExtent([0.1, 3]) // prevent over-zooming or infinite scroll
    .on('zoom', (event) => {
      g.attr('transform', `translate(${margin.left},${margin.top}) ${event.transform.toString()}`);
    });
  svg.call(zoom);

  // Adjust zoom level and centering to fit tree neatly in view
  fitTreeToView(svg, gx, container, zoom, margin);

  setupWordHoverSync();
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: prepareSentenceData
 * --------------------------------------------------------------------------
 * Converts a sentence’s <word> elements into a flat list of rows usable by D3.
 * Adds a synthetic root node for top-level words.
 *
 * @param {Object} sentence - Sentence object containing word elements.
 * @returns {Array<Object>} Returns a flat list of parsed word entries with ID, parent, form, and relation.
 */
function prepareSentenceData(sentence) {
  // Convert <word> nodes into simple JS objects
  const idParentPairs = sentence.words.map(w => ({
    id: String(w.id),
    parentId: (w.head === 0 || w.head === '0' || w.head === null) ? 'root' : String(w.head),
    form: w.form || w.word || '(blank)',
    relation: w.relation || '',
    postag: w._displayPostag || w.postag || ''  
  }));

  // Add a synthetic root node that acts as a parent for headless nodes
  idParentPairs.push({ id: 'root', parentId: null, form: 'ROOT', relation: '' });
  return idParentPairs;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: buildHierarchy
 * --------------------------------------------------------------------------
 * Builds a hierarchical D3 layout with dynamic spacing based on word length.
 *
 * @param {Array<Object>} idParentPairs - Flat rows from prepareSentenceData().
 * @returns {Object} D3 root hierarchy with (x, y) coordinates for each node.
 */
function buildHierarchy(idParentPairs) {
  // Use D3's stratify to convert flat rows into a tree-like hierarchy
  const root = d3.stratify()
    .id(d => d.id)
    .parentId(d => d.parentId)(idParentPairs);

  // Copy text and relation info onto each node
  root.each(d => {
    const row = idParentPairs.find(p => p.id === d.id);
    if (row) {
      d.data.form = row.form;
      d.data.relation = row.relation;
      d.data.postag = row.postag || ''
    }
  });

  // Define spacing logic
  const yGap = 55;       // vertical distance between layers
  const baseX = 40;      // width between branches
  const scaleFactor = 5; // extra spacing per character of text

  // Precalculate horizontal widths based on word length
  root.each(d => {
    const word = d.data.form || '';
    d.wordWidth = baseX + (word.length * scaleFactor);
  });

  // Configure a D3 tree layout that uses spacing proportional to word size
  const treeLayout = d3.tree()
    .nodeSize([window.verticalSpacing, yGap * window.verticalSpacing]) // vertical spacing mutlipled by scale factor 
    .separation((a, b) => {
      const avg = (a.wordWidth + b.wordWidth) / 2;
      return a.parent === b.parent ? avg / 60 : avg / 40;
    });

  const rootHierarchy = treeLayout(root);

  // Apply a uniform horizontal scaling factor for readability
  rootHierarchy.each(d => { d.x *= 60; });

  return rootHierarchy;
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: drawLinks
 * --------------------------------------------------------------------------
 * Draws dependency edges as smooth cubic Bézier curves with a small visual gap
 * around each relation label. The curve is mathematically split so the path
 * remains continuous and smooth — no visual loops or overlaps.
 *
 * @param {Object} gx - D3 selection of the inner SVG group.
 * @param {Object} rootHierarchy - Root node with computed coordinates.
 * @param {Array<Object>} idParentPairs - Flat array of word data for label lookup.
 * @returns {void}
 */
function drawLinks(gx, rootHierarchy, idParentPairs) {
  const tLabel = 0.75;  // Where label sits along the curve
  const gapT = 0.15;   // Fraction of curve length to remove around label (≈ small gap)

  gx.selectAll(".link")
    .data(rootHierarchy.links())
    .join("g")
    .attr("class", "link-group")
    .each(function (d) {
      const group = d3.select(this);

      // --- Spread siblings slightly to prevent overlap ---
      const siblings = d.source.children || [];
      const index = siblings.indexOf(d.target);
      const offset = (index - (siblings.length - 1) / 2) * 12;

      // --- Define start and end positions ---
      const source = { x: d.source.x + offset, y: d.source.y + 10 };
      const target = { x: d.target.x, y: d.target.y - 10 };

      // --- Define cubic Bézier control points ---
      const dx = (target.x - source.x) * 0.5;
      const c1x = source.x + dx;
      const c1y = source.y + (target.y - source.y) * 0.2;
      const c2x = target.x;
      const c2y = target.y - (target.y - source.y) * 0.8;

      // --- Helper: De Casteljau subdivision to split Bézier at t ---
      function subdivideCurve(x0, y0, x1, y1, x2, y2, x3, y3, t) {
        const x01 = x0 + (x1 - x0) * t;
        const y01 = y0 + (y1 - y0) * t;
        const x12 = x1 + (x2 - x1) * t;
        const y12 = y1 + (y2 - y1) * t;
        const x23 = x2 + (x3 - x2) * t;
        const y23 = y2 + (y3 - y2) * t;
        const x012 = x01 + (x12 - x01) * t;
        const y012 = y01 + (y12 - y01) * t;
        const x123 = x12 + (x23 - x12) * t;
        const y123 = y12 + (y23 - y12) * t;
        const x0123 = x012 + (x123 - x012) * t;
        const y0123 = y012 + (y123 - y012) * t;
        return {
          left:  [x0, y0, x01, y01, x012, y012, x0123, y0123],
          right: [x0123, y0123, x123, y123, x23, y23, x3, y3]
        };
      }

      // --- Compute the three parts: before-gap, gap-center, after-gap ---
      const beforeGap = subdivideCurve(
        source.x, source.y, c1x, c1y, c2x, c2y, target.x, target.y,
        tLabel - gapT
      ).left;

      const afterGap = subdivideCurve(
        source.x, source.y, c1x, c1y, c2x, c2y, target.x, target.y,
        tLabel + gapT
      ).right;

      // --- Draw first segment (parent → before label) ---
      group.append("path")
        .attr("class", "link-part1")
        .attr("fill", "none")
        .attr("stroke", "#999")
        .attr("stroke-width", 1.2)
        .attr("d",
          `M${beforeGap[0]},${beforeGap[1]} C${beforeGap[2]},${beforeGap[3]} ${beforeGap[4]},${beforeGap[5]} ${beforeGap[6]},${beforeGap[7]}`
        );

      // --- Draw second segment (after label → child) ---
      group.append("path")
        .attr("class", "link-part2")
        .attr("fill", "none")
        .attr("stroke", "#999")
        .attr("stroke-width", 1.2)
        .attr("d",
          `M${afterGap[0]},${afterGap[1]} C${afterGap[2]},${afterGap[3]} ${afterGap[4]},${afterGap[5]} ${afterGap[6]},${afterGap[7]}`
        );

      // --- Compute actual label coordinates at tLabel ---
      const t = tLabel;
      const x = Math.pow(1 - t, 3) * source.x +
                3 * Math.pow(1 - t, 2) * t * c1x +
                3 * (1 - t) * Math.pow(t, 2) * c2x +
                Math.pow(t, 3) * target.x;

      const y = Math.pow(1 - t, 3) * source.y +
                3 * Math.pow(1 - t, 2) * t * c1y +
                3 * (1 - t) * Math.pow(t, 2) * c2y +
                Math.pow(t, 3) * target.y;

      // --- Add relation label centered within the gap ---
      group.append("text")
        .attr("class", "link-label")
        .attr("x", x)
        .attr("y", y + 6)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("fill", "#333")
        .text(d => d.target?.data?.relation || "");
    });
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: drawNodes
 * --------------------------------------------------------------------------
 * Renders the words as text-only nodes positioned along the D3 layout.
 * Adds a rectangle behind text for background highlighting
 * @param {Object} gx - D3 selection of inner SVG group.
 * @param {Object} rootHierarchy - Root node with x/y layout data.
 * @returns {void} Runs synchronously to render all node text labels on the tree.
 */
function drawNodes(gx, rootHierarchy) {
  const nodes = gx.selectAll('.node')
    .data(rootHierarchy.descendants())
    .join('g')
    .attr('class', 'node')
    .attr("id", d => d.data.n || d.data.id || d.data.word_id)
    .attr('data-pos', d => (d.data.postag && d.data.postag[0]) ? d.data.postag[0] : '')
    .attr('transform', d => `translate(${d.x},${d.y})`);

  // First add the text (so we can measure it)
  nodes.append('text')
    .attr('dy', 4)
    .attr('text-anchor', 'middle')
    .style('font-family', 'sans-serif')
    .style('font-size', '14px')
    .style('fill', d => colorForPOS({ postag: d.data.postag }))
    .text(d => d.data.form)
    .each(function() {
      // Measure the text and insert a rect *behind* it
      const text = d3.select(this);
      const bbox = this.getBBox();
      d3.select(this.parentNode)
        .insert('rect', 'text')  // insert before text so it’s behind
        .attr('x', bbox.x - 3)
        .attr('y', bbox.y - 2)
        .attr('width', bbox.width + 6)
        .attr('height', bbox.height + 4)
        .attr('rx', 3)
        .attr('ry', 3)
        .attr('class', 'text-bg');
    });

  // --- Enable clicking nodes to show morphological info ---
  nodes.on("click", function (event, d) {
    if (!window.isMorphActive) return;

    // Clear all previous highlights first
    d3.selectAll(".node").classed("selected", false);
    document.querySelectorAll(".token").forEach(t => t.classList.remove("selected"));

    // Highlight this node and its corresponding token
    d3.select(this).classed("selected", true);
    const token = document.querySelector(`.token[data-word-id='${d.data.id}']`);
    if (token) token.classList.add("selected");

    // Show morphological info
    const currentSentence = window.treebankData.find(s => s.id === `${window.currentIndex}`);
    const word = currentSentence?.words?.find(w => w.id === d.data.id);

    if (word && typeof window.renderMorphInfo === 'function') {
      const toolBody = document.getElementById("tool-body");
      toolBody.innerHTML = "";
      window.renderMorphInfo(word);
    }
  });
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: fitTreeToView
 * --------------------------------------------------------------------------
 * Automatically scales and centers the rendered tree inside the SVG viewport.
 * Keeps the tree visible and balanced regardless of size or depth.
 *
 * Includes:
 *  - Safety guards for missing/invalid DOM
 *  - Smooth CSS-based visual scaling during live resize
 *  - Debounced D3 recalculation after resizing stops
 *  - Animated ease-in refit
 *
 * @param {Object} svg - D3 selection of SVG element.
 * @param {Object} gx - D3 selection of the inner group (tree content).
 * @param {HTMLElement} container - DOM element containing the SVG.
 * @param {Object} zoom - D3 zoom behavior object.
 * @param {Object} margin - Margins for positioning.
 * @returns {void}
 */
function fitTreeToView(svg, gx, container, zoom, margin) {
  // --- SAFETY GUARDS ---
  if (!svg || !gx || !container || !zoom || !margin) return;
  if (!gx.node()) return; // prevent crash if gx cleared or detached

  const newWidth  = container?.clientWidth || 800;
  const newHeight = container?.clientHeight || 600;

  // Update SVG dimensions and viewport
  svg.attr('width', newWidth).attr('height', newHeight);
  svg.attr('viewBox', [0, 0, newWidth, newHeight]);

  // Get bounding box of all drawn content
  const pad = 10;
  let bbox;
  try {
    bbox = gx.node().getBBox();
  } catch (err) {
    console.warn("fitTreeToView skipped: invalid or empty bbox", err);
    return;
  }

  const innerW = newWidth  - margin.left - margin.right - pad * 2;
  const innerH = newHeight - margin.top  - margin.bottom - pad * 2;

  // Compute uniform scaling factor
  const scale = Math.min(
    innerW / Math.max(bbox.width, 1),
    innerH / Math.max(bbox.height, 1)
  );

  // Compute horizontal and vertical centering offsets
  const bboxCenterX = bbox.x + bbox.width / 2;
  const targetX = newWidth / 2;
  const topOffset = Math.max(margin.top, (newHeight - bbox.height * scale) * 0.15);
  const targetY = topOffset;

  // Calculate translation adjustments
  const tx = (targetX - margin.left) - scale * bboxCenterX;
  const ty = (targetY - margin.top)  - scale * bbox.y;

  // Apply the transform via zoom with smooth easing
  svg.transition()
    .duration(600)
    .ease(d3.easeCubicOut)
    .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

  // --- SMOOTH + EFFICIENT RESIZE HANDLER ---
  window.removeEventListener('resize', fitTreeToView);
  let resizeTimeout;
  let lastWidth = container?.clientWidth || 800;
  let lastHeight = container?.clientHeight || 600;

  window.addEventListener('resize', () => {
    const treeVisible = document.getElementById('tree-view')?.offsetParent !== null;
    if (!treeVisible || !window.svg) return;

    const currentWidth = container?.clientWidth || 800;
    const currentHeight = container?.clientHeight || 600;

    // Apply lightweight CSS scaling for instant visual response
    const scaleX = currentWidth / lastWidth;
    const scaleY = currentHeight / lastHeight;
    const liveScale = Math.min(scaleX, scaleY);

    window.svg
      .style('transform-origin', 'center top')
      .style('transition', 'transform 0.05s linear')
      .style('transform', `scale(${liveScale})`);

    // Debounce the expensive D3 recomputation
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Reset temporary CSS scale
      window.svg.style('transform', '');
      window.svg.style('transition', '');

      if (window.svg && window.gx && window.container && window.zoom && window.margin) {
        // Recompute and animate back into perfect position
        fitTreeToView(window.svg, window.gx, window.container, window.zoom, window.margin);
      }

      // Update baseline size for next resize
      lastWidth = currentWidth;
      lastHeight = currentHeight;
    }, 250); // wait until resizing stops
  });

  // Re-sync highlights after nodes are redrawn
  setupWordHoverSync();
}

/**  
 *
 * ------------------------------------------------------------------------
 * FUNCTION: focusOnNode
 * ------------------------------------------------------------------------
 * Focuses D3 tree view on specific node root with smooth panning and zooming 
 * of the svg. For the root node, it keeps it near the top and for regular
 * nodes it centers the node in the svg
 * 
 * Global dependencies: window.svg, window.zoom, window.root
 * 
 * @param {Object} node - D3 hierarchal node object to focus on
 * @returns {void} focuses on tree in svg passed in as a parameter 
 */
function focusOnNode(node) {
  if (!node || !window.svg || !window.zoom) return;

  const svg = window.svg;
  const zoom = window.zoom;

  // svg container width and height
  const svgWidth = +svg.attr("width");
  const svgHeight = +svg.attr("height");

  // horizontal and vertical node posiitons 
  const x = node.x;
  const y = node.y;
  const scale = 1.5;

  // compute translation so node is centered
  let translateX = svgWidth / 2 - x * scale
  let translateY = svgHeight / 2 - y * scale

  // if root, shift upward so it remains near the top of svg
  if (node == window.root) {
    const topMargin = 50;
    translateY = topMargin;
  }

  // compute zoom and pan transform for smooth focus
  const transform = d3.zoomIdentity
    .translate(translateX, translateY)
    .scale(scale);
  
  // animate transition to new view
  svg.transition()
    .duration(750)
    .call(zoom.transform, transform);
}

/**  
 *
 * ------------------------------------------------------------------------
 * FUNCTION: updateTreeLayout
 * ------------------------------------------------------------------------
 * Redraws the tree whenever window.verticalSpacing changes and used by
 * compactTree() and expandTree() functions to support buttons thereof
 * 
 * Global dependencies: window.idParentPairs, window.root, window.gx, 
 * 
 * @returns {void} updates tree layout
 */
function updateTreeLayout() {
  if (!window.idParentPairs) {
    console.warn("No tree data loaded yet.");
    return;
  }

  // updates the root
  window.root = buildHierarchy(window.idParentPairs);

  // removes previous nodes and links
  if (window.gx) {
    window.gx.selectAll("*").remove();
  }

  // redraw links and nodes
  drawLinks(window.gx, window.root, window.idParentPairs);
  drawNodes(window.gx, window.root);
}

/**  
 *
 * ------------------------------------------------------------------------
 * FUNCTION: compactTree
 * ------------------------------------------------------------------------
 * Decreases vertical spacing between nodes and used to support compact button
 * 
 * Global dependencies: window.verticalSpacing
 * 
 * @returns {void} compacts the tree
 */
function compactTree() {
  window.verticalSpacing = Math.max(0.2, window.verticalSpacing - 0.2);
  updateTreeLayout();
}

/**  
 *
 * ------------------------------------------------------------------------
 * FUNCTION: expandTree
 * ------------------------------------------------------------------------
 * Increases vertical spacing between nodes and used to support expand button
 * 
 * Global dependencies: window.verticalSpacing
 * 
 * @returns {void} expands the tree
 */
function expandTree() {
  window.verticalSpacing += 0.2;
  updateTreeLayout();
}

/* ============================================================================
   SECTION 4: INITIALIZATION
   ============================================================================ */

// Make displaySentence globally accessible for HTML buttons
window.displaySentence = displaySentence;

/**
 * --------------------------------------------------------------------------
 * FUNCTION: DOMContentLoaded (entry point)
 * --------------------------------------------------------------------------
 * Initializes the page after DOM load. Prepares all UI components and
 * displays the first sentence automatically.
 *
 * @returns {void} Resolves after initializing the page, preparing UI, and rendering the first sentence.
 */
document.addEventListener('DOMContentLoaded', async () => {
  await displaySentence(1);  // show first sentence by default
  setupSentenceSelector();   // populate dropdown and link it
  setupResizeHandle();       // enable interactive resizing
  setupXMLTool();            // enable XML view
  setupMorphTool();          // enable morph toolbar view
});
