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
const getPOSChar = w => (w?.postag && w.postag[0]) ? w.postag[0].toLowerCase() : '';
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
    button.addEventListener("click", () => {
      handleWordClick(word.id);
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
let selectedNodeId = null;

function handleWordClick(wordId) {

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
    const node = document.querySelector(`.node[id="${wordId}"]`);
    if (btn) btn.classList.remove("highlight"), node.classList.add("selected"), btn.classList.add("selected");
    return;
  }
  //remove highlight if same word clicked twice and reset selection
  const newHeadId = wordId;
  if(selectedWordId === newHeadId) {
    const btn = document.querySelector(`button[data-word-id="${wordId}"]`);
    const node = document.querySelector(`.node[id="${wordId}"]`);
    node.classList.remove("selected"),btn.classList.remove("selected");
    resetSelection();
    return;
  }

  const currentSentence = window.treebankData.find(s => s.id === `${window.currentIndex}`);
  //gets dependent node (first selected node)
  const dependent = currentSentence.words.find(word => word.id === selectedWordId);
  //gets indepenent node (second selected node)
  const independent = currentSentence.words.find(word => word.id === newHeadId);

  //remove highlight when second word is selected
  const btnNewHead = document.querySelector(`button[data-word-id="${newHeadId}"]`);
  if (btnNewHead) btnNewHead.classList.remove("highlight");

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
    // Fetch the XML file only when button is clicked
    const response = await fetch('../../assets/treebank.xml');
    const xmlText = await response.text();

    // Create a Blob with XML content
    const blob = new Blob([xmlText], { type: "application/xml" });
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

// focus on select button (treebank view)
document.getElementById("focus-selection").addEventListener("click", () => {
  if (selectedNode) {
    focusOnNode(selectedNode);
  } else {
    console.alert("Please select a node to focus on.");
  }
})

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
    const words = data.words.map(w =>
      `  &lt;word id="${w.id}" form="${w.form}" lemma="${w.lemma}" postag="${w.postag}" relation="${w.relation}" head="${w.head}" /&gt;`
    ).join('\n');

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
      toolBody.innerHTML = '<p>Please select a tool from the bar above that you would like to use.</p>';
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

  // Expose a closer so other code (like displaySentence) can shut Morph off
  window.closeMorphTool = function () {
    if (!window.isMorphActive) return;
    window.isMorphActive = false;
    morphBtn.classList.remove('active');
    toolBody.innerHTML = `<p>Please select a tool from the bar above that you would like to use.</p>`;
    // clear any highlights
    document.querySelectorAll(".token.selected").forEach(t => t.classList.remove("selected"));
    d3.selectAll(".node").classed("selected", false);
  };

  window.isMorphActive = false;

  // Expose globally so displaySentence() and clicks can use it
  window.renderMorphInfo = renderMorphInfo;

  morphBtn.addEventListener('click', () => {
    const wasActive = window.isMorphActive;
    allToolButtons.forEach(btn => btn.classList.remove('active'));
    window.isMorphActive = !wasActive;

    if (window.isMorphActive) {
      document.body.classList.add('mode-morph');
    } else {
      document.body.classList.remove('mode-morph');
      // clear any morph selections when leaving morph mode
      d3.selectAll(".node").classed("selected", false);
      document.querySelectorAll(".token.selected").forEach(t => t.classList.remove("selected"));
    }
    if (window.isMorphActive) {
      morphBtn.classList.add('active');
      toolBody.innerHTML = `<p style="padding:8px;">Click a word to view morphological info.</p>`;
    } else {
      toolBody.innerHTML = `<p>Please select a tool from the bar above that you would like to use.</p>`;
    }
  });

  /**
   * Displays morphological info for the selected word in the right-hand tool pane.
   *
   * @param {{ id: string, form: string, lemma?: string, postag?: string }} word
   *        The word object from the current sentence. Must include `id` and `form`.
   * @returns {void} Renders into the #tool-body container; no return value.
   */
  function renderMorphInfo(word) {
    // 1) Guard rails: Morph must be active; target pane must exist; word must exist.
    if (!window.isMorphActive) return;
    const toolBody = document.getElementById('tool-body');
    if (!toolBody || !word) return;

    // 2) Normalize fields early so later code never reads undefined.
    const lemma  = (word.lemma  || "").trim();
    const postag = (word.postag || "").trim();
    const src = "document"; 
    
    // 3) Treat blanks or strings starting with "(unknown" as missing values.
    const looksUnknown = (s) => !s || /^\(unknown/i.test(s);
    const noMorphData = looksUnknown(lemma) && looksUnknown(postag);

    // 4) EMPTY STATE: Show only form + id + “Create new form” button.
    if (noMorphData) {
      toolBody.innerHTML = `
        <div class="morph-container morph-container--empty">
          <p class="morph-form">
            ${word.form}
            <span class="morph-id" style="color:#9aa3ad">${window.currentIndex}-${word.id}</span>
          </p>
          <button class="morph-create">Create new form</button>
        </div>
      `;
      return; // Stop here — nothing else to show for unknown data.
    }

    // 5) Parse Alpheios-style POSTAG into a small, useful feature set.
    /**
     * Parses a compact morph tag into a human-readable dictionary.
     *
     * @param {string} tag - Compact POS/morph tag (e.g., "v3slie---", "n-s---mn-").
     * @returns {Object<string,string>} Map of fields to readable values.
     */
    function parseMorphTag(tag) {
      if (!tag) return {};

      // Maps for codes → labels
      const posMap = {
        v:"verb", n:"noun", a:"adjective", d:"adverb", p:"pronoun",
        c:"conjunction", r:"adposition", l:"article", m:"numeral",
        i:"interjection", u:"punctuation"
      };
      const tenseMap  = { p:"present", i:"imperfect", r:"perfect", l:"plusquamperfect", f:"future", a:"aorist" };
      const moodMap   = { i:"indicative", s:"subjunctive", o:"optative", n:"infinitive", m:"imperative", p:"participle" };
      const voiceMap  = { a:"active", e:"medio-passive", p:"passive" };
      const numberMap = { s:"singular", p:"plural", d:"dual" };
      const personMap = { "1":"first person", "2":"second person", "3":"third person" };
      const genderMap = { m:"masculine", f:"feminine", n:"neuter", c:"common" };
      const caseMap   = { n:"nominative", g:"genitive", d:"dative", a:"accusative", v:"vocative" };

      const parsed = {};
      const pos = tag[0];
      parsed["Part of Speech"] = posMap[pos] || "";

      // Verb-like pattern (e.g., v3slie---)
      if (pos === "v") {
        parsed["Person"] = personMap[tag[1]] || "";
        parsed["Number"] = numberMap[tag[2]] || "";
        parsed["Tense"]  = tenseMap[tag[3]]  || "";
        parsed["Mood"]   = moodMap[tag[4]]   || "";
        parsed["Voice"]  = voiceMap[tag[5]]  || "";
      }
      // Noun/adj/pron/article pattern (e.g., n-s---mn-)
      else if (pos === "n" || pos === "a" || pos === "p" || pos === "l") {
        parsed["Number"] = numberMap[tag[2]] || "";
        parsed["Gender"] = genderMap[tag[6]] || "";
        parsed["Casus"]  = caseMap[tag[7]]   || "";
      }
      return parsed;
    }

    // 6) Build the short “readable” line (e.g., noun.sg.masc.nom).
    const parsed = parseMorphTag(postag);
    const readable = Object.values(parsed)
      .filter(Boolean)
      .map(v => v.replace(" person", "").replace(" ", "."))
      .join(".");

    // 7) POS color for the lemma line (matches your token/node palette).
    const posColor = colorForPOS(word);

    // 8) Main card HTML (full state).
    toolBody.innerHTML = `
      <div class="morph-container">
        <p class="morph-form">
          ${word.form}
          <span class="morph-id" style="color:#9aa3ad">${window.currentIndex}-${word.id}</span>
        </p>

        <div class="morph-entry" data-expanded="false">
          <input type="checkbox" checked />
          <div class="morph-content">
            <p class="morph-lemma">${lemma}</p>
            <p class="morph-tag">${postag}</p>
            <p class="morph-source">${src}</p>
            <p class="morph-readout">${readable}</p>
          </div>
        </div>

        <button class="morph-create">Create new form</button>
      </div>
    `;

    // 9) Post-render styling hooks: apply colors after insertion.
    const lemmaEl = toolBody.querySelector('.morph-lemma');
    const tagEl   = toolBody.querySelector('.morph-tag');
    const readEl  = toolBody.querySelector('.morph-readout');
    if (lemmaEl) lemmaEl.style.color = posColor;  // lemma uses POS color
    if (tagEl)   tagEl.style.color   = '#4a4a4a'; // keep tag/readout neutral gray
    if (readEl)  readEl.style.color  = '#4a4a4a';

    // 10) Expand/collapse: clicking card (except the checkbox) toggles details grid.
    const entry = toolBody.querySelector('.morph-entry');
    entry.addEventListener('click', (e) => {
      if (e.target.tagName.toLowerCase() === 'input') return;

      const expanded = entry.dataset.expanded === 'true';
      if (!expanded) {
        // Build details grid from parsed fields
        let details = '<div class="morph-divider"></div><div class="morph-details">';
        for (const [k, v] of Object.entries(parsed)) {
          if (v) {
            details += `
              <div class="morph-label">${k}</div>
              <div class="morph-colon">:</div>
              <div class="morph-value">${v}</div>
            `;
          }
        }
        details += '</div>';

        entry.insertAdjacentHTML('beforeend', details);
        entry.dataset.expanded = 'true';
        entry.classList.add('expanded');
      } else {
        entry.querySelector('.morph-details')?.remove();
        entry.querySelector('.morph-divider')?.remove();
        entry.dataset.expanded = 'false';
        entry.classList.remove('expanded');
      }
    });
  }
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

  //check if nodes are clicked to change heads
  const nodes = document.querySelectorAll(".node");
  nodes.forEach(node =>{
    node.addEventListener("click", () => {
      handleWordClick(node.id);
    });
  })
  
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
    postag: w.postag || ''
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

let selectedNode = null; // keeps track of selected node

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
    selectedNode = d;
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
 * FUNCTION: compactTree
 * ------------------------------------------------------------------------
 * Decreases vertical spacing between nodes and used to support compact button
 * 
 * Global dependencies: window.verticalSpacing
 * 
 * @returns {void} compacts the tree
 */
function compactTree() {
  // save current zoom transform before redrawing the tree
  const prevTransform = window.svg ? d3.zoomTransform(window.svg.node()) : null;

  // decrease vertical spacing between nodes
  window.verticalSpacing = Math.max(0.2, window.verticalSpacing - 0.2);
  createNodeHierarchy(window.currentIndex); // redraw the tree

  // restore the previous zoom transform after redrawing the tree
  if (window.svg && window.zoom && prevTransform) {
    window.svg.call(window.zoom.transform, prevTransform);
  }
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
  // save current zoom transform before redrawing the tree
  const prevTransform = window.svg ? d3.zoomTransform(window.svg.node()) : null;

  // increase vertical spacing between nodes 
  window.verticalSpacing += 0.2;
  createNodeHierarchy(window.currentIndex); // redraw the tree

  // restore the previous zoom transform after redrawing the tree
  if (window.svg && window.zoom && prevTransform) {
    window.svg.call(window.zoom.transform, prevTransform);
  }
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
let treeState = getInitialTree();

// This function will copy the curret state of the tree.
function saveState() {
  undoStack.push(structuredClone(treeState));
  redoStack = [];
}

// This function will revert the tree to its previous state.
function undoButton(){
  if (undoStack.length === 0) return;

  redoStack.push(structuredClone(treeState));
  treeState = undoStack.pop();
  renderTree(treeState);
  return;
}

// This is the event for the undo button.
document.addEventListener("DOMContentLoaded", () => {
  // Specify the button you are going to listen for
  const button = document.getElementById("undo");

  // Add the event listener to the button you are listening for.
  button.addEventListener("click", async () => {
    undoButton();
  });
});

// This function will revert the tree to its previous change.
function redoButton(){
  if (redoStack.length === 0) return;

  undoStack.push(structuredClone(treeState));
  treeState = redoStack.pop();
  renderTree(treeState);
}

// This is the event for the redo button.
document.addEventListener("DOMContentLoaded", () => {
  // Specify the button you are going to listen for
  const button = document.getElementById("redo");

  // Add the event listener to the button you are listening for.
  button.addEventListener("click", async () => {
    alert("Oops! This functionality is still under construction. Please check back soon!");
    redoButton()
  });
});


document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("save");

  button.addEventListener("click", async () => {
    alert("Oops! This functionality is still under construction. Please check back soon!");
  });
});