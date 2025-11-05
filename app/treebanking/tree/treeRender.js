import { colorForPOS, fitTreeToView } from './treeUtils.js';
import { setupWordHoverSync } from './hoverSync.js';

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
export function createNodeHierarchy(sentenceId) {
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
export function buildHierarchy(idParentPairs) {
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
 * FUNCTION: drawNodes
 * --------------------------------------------------------------------------
 * Renders the words as text-only nodes positioned along the D3 layout.
 * Adds a rectangle behind text for background highlighting
 * @param {Object} gx - D3 selection of inner SVG group.
 * @param {Object} rootHierarchy - Root node with x/y layout data.
 * @returns {void} Runs synchronously to render all node text labels on the tree.
 */
export function drawNodes(gx, rootHierarchy) {
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
    .each(function () {
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

  // Global selection memory for focus-selection button
  window.selectedNode = null;

  // --- Enable clicking nodes ---
  nodes.on("click", function (event, d) {
    // =======================
    //  CASE 1: Morph tool open
    // =======================
    if (window.isMorphActive) {
      // Clear previous highlights
      d3.selectAll(".node").classed("selected", false);
      document.querySelectorAll(".token").forEach(t => t.classList.remove("selected"));

      // Highlight this node and its corresponding token
      d3.select(this).classed("selected", true);
      const token = document.querySelector(`.token[data-word-id='${d.data.id}']`);
      if (token) token.classList.add("selected");

      // Show morph info
      const currentSentence = window.treebankData.find(s => s.id === `${window.currentIndex}`);
      const word = currentSentence?.words?.find(w => w.id === d.data.id);

      if (word && typeof window.renderMorphInfo === 'function') {
        const toolBody = document.getElementById("tool-body");
        toolBody.innerHTML = "";
        window.renderMorphInfo(word);
      }
      return; // stop here, don’t trigger focus logic
    }

    // =======================
    //  CASE 2: Normal tree mode — select node for focus
    // =======================
    d3.selectAll('.node').classed('selected', false); // clear previous highlights
    d3.select(this).classed('selected', true);        // visually mark as selected
    window.selectedNode = d;                          // store for "focus-selection" button
  });
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
export function drawLinks(gx, rootHierarchy, idParentPairs) {
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