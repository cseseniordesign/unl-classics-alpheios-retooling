import parseTreeBankXML from './parser.js';

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
 * handles changing head when two nodes are selected
 */

let selectedWordId = null; // keeps track of the first click(dependent word)

function handleWordClick(wordId, event) {
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
  selectedWordId === null;
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
    } else {
      // --- Exit XML mode ---
      toolBody.innerHTML = '<p>this is the body of each tool option</p>';
      exitReadOnly();
    }
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
    relation: w.relation || ''
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
        .text(() => {
          const child = idParentPairs.find(p => p.id === d.target.data.id);
          return child && child.relation ? child.relation : "";
        });
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
    .attr('transform', d => `translate(${d.x},${d.y})`);
  // First add the text (so we can measure it)
  nodes.append('text')
    .attr('dy', 4)
    .attr('text-anchor', 'middle')
    .style('font-family', 'sans-serif')
    .style('font-size', '14px')
    .style('fill', '#1c1c1c')
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
}

/**
 * --------------------------------------------------------------------------
 * FUNCTION: fitTreeToView
 * --------------------------------------------------------------------------
 * Automatically scales and centers the rendered tree inside the SVG viewport.
 * Keeps the tree visible and balanced regardless of size or depth.
 *
 * @param {Object} svg - D3 selection of SVG element.
 * @param {Object} gx - D3 selection of the inner group (tree content).
 * @param {HTMLElement} container - DOM element containing the SVG.
 * @param {Object} zoom - D3 zoom behavior object.
 * @param {Object} margin - Margins for positioning.
 * @returns {void} Adjusts tree scale and position so it fits neatly within the SVG viewport.
 */
function fitTreeToView(svg, gx, container, zoom, margin) {
  const newWidth  = container.clientWidth;
  const newHeight = container.clientHeight;

  // Update SVG dimensions and viewport
  svg.attr('width', newWidth).attr('height', newHeight);
  svg.attr('viewBox', [0, 0, newWidth, newHeight]);

  // Get bounding box of all drawn content
  const pad = 10;
  const bbox = gx.node().getBBox();
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

  // Apply the transform via zoom for smooth fit animation
  svg.transition()
    .duration(500)
    .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

  // Keep fitting responsive to window resizing
  window.removeEventListener('resize', fitTreeToView);
  window.addEventListener('resize', () => fitTreeToView(svg, gx, container, zoom, margin));

  //after nodes have been drawn, sync highlights
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
});
