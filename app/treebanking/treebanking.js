import parseTreeBankXML from './parser.js'
/**
 * This function handles the XML file selector and currently
 * just returns the file. It is possible to instead of returning,
 * having the function call another and passing in file while
 * doing so. Because this is called by an event. It is the first
 * step and might not want to finish right away.
 * @returns file
 */
function getLocalTreebankXML() {
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];

    //THIS WILL NOT ALWAYS RETURN, IT WILL
    //FUNNEL INTO ANOTHER FUNCTION
    //DELTE THIS COMMENT WHEN THAT IS DONE.
    return file;
}


// NEEDS TO SAVE THE FILE FROM parseTreeBAnkXML not working yet
/*
* parses treebank.xml 
* adds the words to the main page
*/
window.displaySentence = function(index) {
  const tokenizedSentence = document.getElementById('tokenized-sentence');

  //Fetch and parse XML once, store it globally for reuse
  if (!window.treebankData) {
    fetch('../../assets/treebank.xml')
      .then(response => response.text())
      .then(xmlText => {
        window.treebankData = parseTreeBankXML(xmlText);
        renderSentence(index);
      })
      .catch(err => console.error("Error loading XML:", err));
  } else {
    renderSentence(index);
  }

  // Helper to render both text and tree
  function renderSentence(index) {
    const data = window.treebankData;

    // Clear previous sentence text
    tokenizedSentence.textContent = "";

    // Number of sentences
    window.totalSentences = data.length;

    //Ensure displayed sentence stays within valid range
    if (index < 1) index = 1;
    if (index > window.totalSentences) index = window.totalSentences;

    window.currentIndex = index;

    // Get the sentence with the current id
    const sentence = data.find(sentence => sentence.id === `${index}`);

    if (!sentence) {
      console.warn(`Sentence with id=${index} not found.`);
      return;
    }

    // Display sentence text (forms)
    sentence.words.forEach((word) => {
      tokenizedSentence.append(`${word.form} `);
    });

    // Generate the dependency tree for this sentence
    createNodeHierarchy(index);
  }
}


// NEEDS TO SAVE THE FILE FROM parseTreeBAnkXML not working yet
/*
*   This function is used to save the file from parseTreeBankXML
*   to the local system of the user.
*/
function saveLocal() {
  if (confirm("Would you like to save this treebank?")) {
    const doctype = new XMLSerializer().serializeToString(document.doctype);
    const html = document.documentElement.outerHTML;
    const fullHTML = doctype + "\n" + html;

    const blob = new Blob([fullHTML], { type: "text/html" });
    const fileName = "Treebank.html";
    const el = document.createElement('a');
    el.href = URL.createObjectURL(blob);
    el.download = fileName;

    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
    URL.revokeObjectURL(el.href);
  }
}

// Find the save button once the page has loaded
document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("save");
  button.addEventListener("click", saveLocal);
});

/**
 * Vertical resize interaction
 * 
 * This adds interactivity to the handle between the sentence
 * and the tree view. Users can drag it to resize the sentence box
 * vertically while the tree-bank area automatically adjusts.
 */
const treeView = document.getElementById("tree-view");
const sentenceBox = document.getElementById("sentence");
const treeBox = document.getElementById("tree-bank");
const resizeHandle = document.getElementById("resize-handle");

let isResizing = false;
let startY;
let startHeight;

// When the user clicks and holds the resize bar
resizeHandle.addEventListener("mousedown", (e) => {
  isResizing = true;
  startY = e.clientY;
  startHeight = sentenceBox.offsetHeight;
  document.body.style.cursor = "ns-resize";
  e.preventDefault();
});

// When the user moves the mouse while resizing
document.addEventListener("mousemove", (e) => {
  if (!isResizing) return;
  const dy = e.clientY - startY;
  const newHeight = startHeight + dy;
  const parentHeight = treeView.offsetHeight;

  const minHeight = 50;
  const contentHeight = sentenceBox.scrollHeight; // actual content height
  const maxHeight = parentHeight * 0.85;          // safety buffer to prevent tree from being covered completely

  // Apply the heigh within limits
  if (newHeight >= minHeight && newHeight <= maxHeight) {
    sentenceBox.style.height = `${newHeight}px`;
    // switch between scroll and visible mode depending on available space
    sentenceBox.style.overflowY = newHeight < contentHeight ? "auto" : "visible";
  }
});

// When the user releases the mouse
document.addEventListener("mouseup", () => {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = "default";
  }
});

/**
 * This function takes in a sentenceId, and returns a d3
 * hierarchy that contains a synthetic root with all nodes
 * hanging underneath it. the objects in the hierarchy only
 * contain the word's <id> and <head>.
 * @param {*} sentenceId 
 */
function createNodeHierarchy(sentenceId) {
  fetch('../../assets/treebank.xml')
    .then(response => response.text())
    .then(xmlText => {
      const data = parseTreeBankXML(xmlText);
      const sentence = data.find(sentence => sentence.id === `${sentenceId}`);

      if (!sentence) {
        console.error(`Sentence with id=${sentenceId} not found.`);
        return;
      }

      const idParentPairs = sentence.words.map(wordNode => ({
        id: String(wordNode.id),
        // change root nodes to have their parent point to a synthetic root
        parentId: (wordNode.head === 0 || wordNode.head === '0' || wordNode.head === null)
          ? 'root'
          : String(wordNode.head),
        // store the actual word form for labeling
        form: wordNode.form || wordNode.word || "(blank)",
        relation: wordNode.relation || "" // store relation label
      }));

      // Add synthetic root
      idParentPairs.push({
        id: 'root',
        parentId: null,
        form: 'ROOT',
        relation: '' // root has no relation
      });

      console.table(idParentPairs);

      const root = d3.stratify()
        .id(d => d.id)
        .parentId(d => d.parentId)
        (idParentPairs);

      // Assign the 'form' and 'relation' to hierarchy nodes for display
      root.each(d => {
        const original = idParentPairs.find(p => p.id === d.id);
        if (original) {
          d.data.form = original.form;
          d.data.relation = original.relation;
        }
      });

      // --- D3 Drawing Section ---
      const svg = d3.select("#sandbox svg");
      svg.selectAll("*").remove(); // clear previous tree before redrawing

      //  Dynamically size the SVG to match its container (#tree-bank)
      const container = document.getElementById("tree-bank");
      const width = container.clientWidth;
      const height = container.clientHeight;
      svg.attr("width", width).attr("height", height);

      // Expand the SVG viewBox so panning doesn't clip content
      svg.attr("viewBox", [0, 0, width, height])
         .attr("preserveAspectRatio", "xMidYMid meet");

      const margin = { top: 40, right: 40, bottom: 40, left: 40 };

      const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Use nodeSize to FORCE spacing (x = horizontal, y = vertical for top-down)
      const xGap = 80;  // horizontal pixels between siblings
      const yGap = 90;  // vertical pixels between levels
      const treeLayout = d3.tree()
        .nodeSize([xGap, yGap])
        .separation((a, b) => (a.parent === b.parent ? 1.2 : 1.6)); // extra gap for cousins

      const rootHierarchy = treeLayout(root);

      // Inner group for drawn elements
      const gx = g.append("g");

      // Draw links (vertical, top-down)
      const links = gx.selectAll(".link")
        .data(rootHierarchy.links())
        .join("path")
        .attr("class", "link")
        .attr("d", d3.linkHorizontal()
          .x(d => d.x)
          .y(d => d.y)
        );

      // Add relation labels to the middle of links
      gx.selectAll(".link-label")
        .data(rootHierarchy.links())
        .join("text")
        .attr("class", "link-label")
        .attr("dy", "-4") 
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("fill", "#333")
        .attr("x", d => (d.source.x + d.target.x) / 2)
        .attr("y", d => (d.source.y + d.target.y) / 2)
        .text(d => {
          const child = idParentPairs.find(p => p.id === d.target.data.id);
          return child && child.relation ? child.relation : "";
        });

      // Draw nodes
      const nodes = rootHierarchy.descendants();
      const node = gx.selectAll(".node")
        .data(nodes)
        .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`);

      node.append("circle").attr("r", 6);
      node.append("text")
        .attr("dy", -10)
        .style("text-anchor", "middle")
        .text(d => d.data.form);

      // Enable zoom/pan
      const zoom = d3.zoom().on("zoom", (event) => {
        g.attr("transform", `translate(${margin.left},${margin.top}) ${event.transform.toString()}`);
      });
      svg.call(zoom);

      // Fit entire tree and center horizontally (shift upward)
      function fitTreeToView() {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        svg.attr("width", newWidth).attr("height", newHeight);
        svg.attr("viewBox", [0, 0, newWidth, newHeight]);

        const pad = 10; 
        const bbox = gx.node().getBBox();
        const innerW = newWidth  - margin.left - margin.right - pad * 2;
        const innerH = newHeight - margin.top  - margin.bottom - pad * 2;

        // Compute scale to fit tree tightly
        const scale = Math.min(
          innerW / Math.max(bbox.width, 1),
          innerH / Math.max(bbox.height, 1)
        );

        // Compute bounding box center for horizontal alignment
        const bboxCenterX = bbox.x + bbox.width / 2;

        // Horizontal center of viewport
        const targetX = newWidth / 2;

        // Shift vertically upward based on tree height 
        const topOffset = Math.max(margin.top, (newHeight - bbox.height * scale) * 0.15);
        const targetY = topOffset; // top padding ~15% of leftover space

        // Compute translations
        const tx = (targetX - margin.left) - scale * bboxCenterX;
        const ty = (targetY - margin.top)  - scale * bbox.y;

        svg.transition()
          .duration(500)
          .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }

      // Call fit on initial render
      fitTreeToView();

      // Auto-refit on window resize
      window.removeEventListener("resize", fitTreeToView);
      window.addEventListener("resize", fitTreeToView);
    })
    .catch(err => console.error("Error loading XML:", err));
}


createNodeHierarchy(1);
