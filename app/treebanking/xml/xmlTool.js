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
  const xmlBtn = document.getElementById('xml');
  const toolBody = document.getElementById('tool-body');
  const allToolButtons = document.querySelectorAll('#toolbar button');

  // --- Defensive guard: ensure required DOM elements exist ---
  if (!xmlBtn || !toolBody) return;

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
  const xmlBtn = document.getElementById('xml');
  const toolBody = document.getElementById('tool-body');

  // Only refresh if the XML tab is currently active (visibly toggled)
  if (!xmlBtn || !toolBody || !xmlBtn.classList.contains('active')) {
    return;
  }

  const rawXML = getCurrentSentenceXML();
  const formatted = formatXML(rawXML);
  const highlighted = highlightXML(formatted);
  toolBody.innerHTML = `<pre class="xml-display">${highlighted}</pre>`;
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
    toolBody.innerHTML = `<pre class="xml-display">${highlighted}</pre>`;

    enterReadOnly();
    document.body.classList.remove('mode-morph');
  }
});
}