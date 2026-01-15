/**
 * @jest-environment jsdom
 */
import { jest } from "@jest/globals";

// Polyfill structuredClone for Jest if missing
if (typeof globalThis.structuredClone !== "function") {
  globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

// ---- Mock xmlTool dependencies (so we only test xmlTool.js behavior) ----
jest.unstable_mockModule("../xml/parser.js", () => ({
  default: jest.fn(() => []),
}));

jest.unstable_mockModule("../ui/sentenceDisplay.js", () => ({
  safeDisplaySentence: jest.fn(() => true),
}));

jest.unstable_mockModule("../xml/schemaValidator.js", () => ({
  validateTreebankSchema: jest.fn(() => true),
}));

jest.unstable_mockModule("../ui/modal.js", () => ({
  showConfirmDialog: jest.fn(() => Promise.resolve(true)),
}));

jest.unstable_mockModule("../xml/undo.js", () => ({
  saveState: jest.fn(),
}));

describe("xml/xmlTool.js", () => {
  let takeSnapshot,
    recomputeDirty,
    setupXMLTool,
    formatXML,
    highlightXML,
    getCurrentSentenceXML,
    updateXMLIfActive,
    enterReadOnly,
    exitReadOnly,
    discardXmlEdits;

  beforeAll(async () => {
    ({
      takeSnapshot,
      recomputeDirty,
      setupXMLTool,
      formatXML,
      highlightXML,
      getCurrentSentenceXML,
      updateXMLIfActive,
      enterReadOnly,
      exitReadOnly,
      discardXmlEdits,
    } = await import("../xml/xmlTool.js"));
  });

  beforeEach(() => {
    // reset global flags used by the tool
    window.xmlToolInitialized = false;
    window.xmlInternalUpdate = false;
    window.xmlSnapshot = "";
    window.xmlDirty = false;
    window.originalXMLText = "";

    window.treebankModeHTML = "<p>Treebanking mode</p>";
    window.currentIndex = 1;
    window.treebankData = [
      {
        id: "1",
        words: [
          {
            id: "1",
            form: "amo",
            lemma: "amo",
            postag: "v3spia---",
            relation: "SBJ",
            head: "0",
          },
        ],
      },
    ];

    document.body.innerHTML = `
      <div id="toolbar">
        <button id="xml">XML</button>
      </div>
      <div id="tool-body"></div>
      <div id="toast"></div>
      <div id="sandbox"><svg></svg></div>
    `;

    // stub d3 used by enterReadOnly/exitReadOnly
    globalThis.d3 = {
      select: jest.fn(() => ({
        style: jest.fn().mockReturnThis(),
      })),
    };
  });

  test("takeSnapshot: stores unescaped snapshot and clears dirty", () => {
    window.originalXMLText =
      "&lt;sentence id=&quot;1&quot;&gt;\n  &lt;word id=&quot;1&quot; /&gt;\n&lt;/sentence&gt;";

    takeSnapshot();
    expect(window.xmlSnapshot).toBe(
      `<sentence id=&quot;1&quot;>\n  <word id=&quot;1&quot; />\n</sentence>`
    );

    expect(window.xmlDirty).toBe(false);
  });

  test("recomputeDirty: sets dirty false when not editing", () => {
    // no xml-display
    recomputeDirty();
    expect(window.xmlDirty).toBe(false);

    // xml-display exists but not editing
    const pre = document.createElement("pre");
    pre.id = "xml-display";
    document.body.appendChild(pre);

    window.xmlDirty = true;
    recomputeDirty();
    expect(window.xmlDirty).toBe(false);
  });

  test("formatXML: indents escaped XML with nested tags", () => {
    const raw =
      "&lt;sentence id=&quot;1&quot;&gt;\n&lt;word id=&quot;1&quot; /&gt;\n&lt;/sentence&gt;";
    const out = formatXML(raw);

    // should keep tags and add indentation on inner line
    expect(out).toContain("&lt;sentence");
    expect(out).toContain("<br>&nbsp;&nbsp;&lt;word");
    expect(out).toContain("<br>&lt;/sentence&gt;");
  });

  test("highlightXML: wraps tags + attributes in span classes", () => {
    const raw = `&lt;word id="1" form="amo" /&gt;`;
    const out = highlightXML(raw);

    expect(out).toContain(`class="xml-tag"`);
    expect(out).toContain(`class="xml-attr"`);
    expect(out).toContain(`class="xml-value"`);
  });

  test("getCurrentSentenceXML: prefers _displayLemma/_displayPostag", () => {
    window.treebankData = [
      {
        id: "1",
        words: [
          {
            id: "1",
            form: "amo",
            lemma: "amo",
            postag: "BADTAG",
            _displayLemma: "AMO!",
            _displayPostag: "v3spia---",
            relation: "SBJ",
            head: "0",
          },
        ],
      },
    ];

    const xml = getCurrentSentenceXML();
    expect(xml).toContain(`lemma="AMO!"`);
    expect(xml).toContain(`postag="v3spia---"`);
  });

  test("setupXMLTool: clicking XML builds panel and enters read-only; clicking again closes", () => {
    setupXMLTool();

    const btn = document.getElementById("xml");
    const toolBody = document.getElementById("tool-body");

    // open
    btn.click();
    expect(btn.classList.contains("active")).toBe(true);
    expect(toolBody.querySelector("#xml-display")).toBeTruthy();
    expect(toolBody.querySelector("#xml-edit")).toBeTruthy();
    expect(window.isReadOnly).toBe(true);

    // close
    btn.click();
    expect(btn.classList.contains("active")).toBe(false);
    expect(window.isReadOnly).toBe(false);
  });

  test("updateXMLIfActive: refreshes xml-display when XML tab is active", () => {
    // open the panel first
    setupXMLTool();
    document.getElementById("xml").click();

    const xmlDisplay = document.getElementById("xml-display");
    xmlDisplay.innerHTML = "OLD";

    updateXMLIfActive();

    expect(xmlDisplay.innerHTML).not.toBe("OLD");
    expect(xmlDisplay.classList.contains("editing")).toBe(false);
    expect(window.xmlDirty).toBe(false);
  });

  test("discardXmlEdits: restores snapshot and exits editing mode", () => {
    // build minimal panel DOM
    document.getElementById("tool-body").innerHTML = `
      <button id="xml-edit" style="display:none;">Edit</button>
      <button id="xml-cancel" style="display:inline-block;">Cancel</button>
      <button id="xml-confirm" style="display:inline-block;">Confirm</button>
      <pre id="xml-display" class="xml-display editing" contenteditable="true">CHANGED</pre>
    `;

    window.xmlSnapshot = `<sentence id="1">\n</sentence>`;
    window.xmlDirty = true;

    discardXmlEdits();

    const xmlDisplay = document.getElementById("xml-display");
    expect(xmlDisplay.classList.contains("editing")).toBe(false);
    expect(String(xmlDisplay.contentEditable)).toBe("false");
    expect(window.xmlDirty).toBe(false);

    // edit button visible again
    expect(document.getElementById("xml-edit").style.display).toBe("inline-block");
    expect(document.getElementById("xml-confirm").style.display).toBe("none");
    expect(document.getElementById("xml-cancel").style.display).toBe("none");
  });

  test("enterReadOnly/exitReadOnly: toggles window.isReadOnly and calls d3.select", () => {
    enterReadOnly();
    expect(window.isReadOnly).toBe(true);
    expect(globalThis.d3.select).toHaveBeenCalledWith("#sandbox svg");

    exitReadOnly();
    expect(window.isReadOnly).toBe(false);
  });
});