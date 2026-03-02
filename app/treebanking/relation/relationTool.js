import { triggerAutoSave } from "../xml/saveXML.js";
import { colorForPOS } from "../tree/treeUtils.js";

// =====================================================
// GLOBAL Relation advanced mode state
// =====================================================
window.relationAdvancedModeEnabled = false;
window._relationSettingsOutsideCloseBound = window._relationSettingsOutsideCloseBound || false;

// Order of main relation bases in the menu
const MAIN_BASES = [
  "---",
  "PRED",
  "SBJ",
  "OBJ",
  "ATR",
  "ADV",
  "Aux",
  "COORD",
  "ATV",
  "AtvV",
  "PNOM",
  "OCOMP",
  "APOS",
  "ExD"
];

// Aux variants for the submenu
const AUX_VARIANTS = [
  "AuxP",
  "AuxC",
  "AuxY",
  "AuxZ",
  "AuxV",
  "AuxR",
  "AuxG",
  "AuxX",
  "AuxK"
];

// suffix keys map to AP / CO pieces
const SUFFIX_KEYS = ["", "CO", "AP", "AP_CO"];

/** Parse relation string like "AuxC_AP_CO" into UI state. */
function parseRelation(relRaw) {
  const safe = (relRaw || "").trim();
  if (!safe || safe === "---") {
    return { base: "---", auxVariant: null, suffixKey: "" };
  }

  const parts = safe.split("_");
  const head = parts[0]; // SBJ, AuxC, ExD, etc.

  let base = head;
  let auxVariant = null;

  // AuxC, AuxP, ...
  if (/^aux[a-z]/i.test(head)) {
    base = "Aux";
    auxVariant = head;
  }

  if (!MAIN_BASES.includes(base)) {
    base = "---";
    auxVariant = null;
  }

  const hasAP = parts.includes("AP");
  const hasCO = parts.includes("CO");

  let suffixKey = "";
  if (hasAP && hasCO) suffixKey = "AP_CO";
  else if (hasAP)     suffixKey = "AP";
  else if (hasCO)     suffixKey = "CO";

  return { base, auxVariant, suffixKey };
}

/** Label we show in the base button. */
function labelForMain(base, auxVariant) {
  if (base === "Aux") {
    return auxVariant || "AuxC";
  }
  return base;
}

function labelForSuffix(key) {
  return key || "---";
}

/** Build suffix <option> tags. */
function buildSuffixOptions(currentSuffix) {
  return SUFFIX_KEYS.map(key => {
    const label = key || "---";
    const selected = key === currentSuffix ? "selected" : "";
    return `<option value="${key}" ${selected}>${label}</option>`;
  }).join("");
}

/** Build the <li> items for the main menu + Aux submenu. */
function buildMenuItems() {
  let html = "";

  MAIN_BASES.forEach(base => {
    if (base === "Aux") {
      const auxItems = AUX_VARIANTS.map(v => `
        <li class="rel-subitem"
            data-base="Aux"
            data-variant="${v}">
          ${v}
        </li>
      `).join("");

      html += `
        <li class="rel-item rel-has-submenu" data-base="Aux">
          <span class="rel-label">Aux</span>
          <ul class="rel-submenu">
            ${auxItems}
          </ul>
        </li>
      `;
    } else {
      html += `
        <li class="rel-item" data-base="${base}">
          ${base}
        </li>
      `;
    }
  });

  return html;
}

/** Toast helper (uses the existing #toast element). */
function showToast(message, kind = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;

  if (kind === "error")      toast.style.background = "#c33";
  else if (kind === "warn")  toast.style.background = "#f0c36d";
  else                       toast.style.background = "#2e7d32";

  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
  }, 2500);
}

/** Apply relation change to in-memory model + tree + XML/autosave. */
function applyRelationChange(word, base, auxVariant, suffixKey) {
  if (!word) return;

  let final = "---";
  const cleanBase = base || "---";

  if (cleanBase !== "---") {
    let baseOut;
    if (cleanBase === "Aux") {
      baseOut = auxVariant || "AuxC";
    } else {
      baseOut = cleanBase;
    }

    const pieces = [baseOut];
    if (suffixKey === "AP") {
      pieces.push("AP");
    } else if (suffixKey === "CO") {
      pieces.push("CO");
    } else if (suffixKey === "AP_CO") {
      pieces.push("AP", "CO");
    }

    final = pieces.join("_");
  }

  if ((word.relation || "").trim() === final.trim()) return;

  // Update word object
  word.relation = final;

  // Update idParentPairs if present
  if (Array.isArray(window.idParentPairs)) {
    const row = window.idParentPairs.find(r => String(r.id) === String(word.id));
    if (row) row.relation = final;
  }

  // Update tree data / link labels
  if (window.root) {
    window.root.each(d => {
      if (String(d.data.id) === String(word.id)) {
        d.data.relation = final;
      }
    });
  }

  if (typeof d3 !== "undefined" && window.gx) {
    window.gx.selectAll(".link-label")
      .text(d => d.target?.data?.relation || "");
  }

  // Regenerate XML + autosave
  if (typeof window.updateXMLIfActive === "function") {
    window.updateXMLIfActive();
  }
  triggerAutoSave();
}

/** Render relation editor for a single word into a container. */
function renderRelationEditor(word, toolBody) {
  if (!word || !toolBody) return;

  const postag = word._displayPostag || word.postag || "";
  const wordColor = colorForPOS({ postag });

  const { base, auxVariant, suffixKey } = parseRelation(word.relation);
  let currentBase   = base;
  let currentAux    = auxVariant;
  let currentSuffix = suffixKey;

  const menuItems   = buildMenuItems();
  const mainLabel   = labelForMain(currentBase, currentAux);
  const suffixLabel = labelForSuffix(currentSuffix);

  toolBody.innerHTML = `
    <div class="relation-tool">
      <p class="morph-form">
        <span class="relation-word" style="color:${wordColor}">
          ${word.form || ""}
        </span>
        <span class="morph-id" style="color:#9aa3ad">
          ${window.currentIndex}-${word.id}
        </span>
      </p>

      <div class="relation-top-row">
        <!-- MAIN (base) DROPDOWN -->
        <div class="rel-dropdown rel-dropdown-main">
          <button type="button" class="rel-button">
            <span class="rel-button-label">${mainLabel}</span>
            <span class="rel-button-arrow">▾</span>
          </button>
          <ul class="nested-dropdown">
            ${menuItems}
          </ul>
        </div>

        <!-- SUFFIX DROPDOWN (custom, no <select>) -->
        <div class="rel-dropdown rel-dropdown-suffix">
          <button type="button" class="rel-button">
            <span class="rel-button-label">${suffixLabel}</span>
            <span class="rel-button-arrow">▾</span>
          </button>
          <ul class="nested-dropdown suffix-menu">
            <li class="rel-item suffix-item" data-key="">---</li>
            <li class="rel-item suffix-item" data-key="CO">CO</li>
            <li class="rel-item suffix-item" data-key="AP">AP</li>
            <li class="rel-item suffix-item" data-key="AP_CO">AP_CO</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const mainDropdown   = toolBody.querySelector(".rel-dropdown-main");
  const mainButton     = mainDropdown?.querySelector(".rel-button");
  const mainLabelEl    = mainDropdown?.querySelector(".rel-button-label");
  const mainMenuEl     = mainDropdown?.querySelector(".nested-dropdown");

  const suffixDropdown = toolBody.querySelector(".rel-dropdown-suffix");
  const suffixButton   = suffixDropdown?.querySelector(".rel-button");
  const suffixLabelEl  = suffixDropdown?.querySelector(".rel-button-label");
  const suffixMenuEl   = suffixDropdown?.querySelector(".nested-dropdown");

  // --------------------
  // HOVER OPEN
  // --------------------
  let mainCloseT = null;
  let sufCloseT  = null;

  mainDropdown.addEventListener("mouseenter", () => {
    if (mainCloseT) { clearTimeout(mainCloseT); mainCloseT = null; }
    mainDropdown.classList.add("open");
    suffixDropdown.classList.remove("open");
  });

  mainDropdown.addEventListener("mouseleave", () => {
    if (mainCloseT) clearTimeout(mainCloseT);
    mainCloseT = setTimeout(() => mainDropdown.classList.remove("open"), 120);
  });

  suffixDropdown.addEventListener("mouseenter", () => {
    if (sufCloseT) { clearTimeout(sufCloseT); sufCloseT = null; }
    suffixDropdown.classList.add("open");
    mainDropdown.classList.remove("open");
  });

  suffixDropdown.addEventListener("mouseleave", () => {
    if (sufCloseT) clearTimeout(sufCloseT);
    sufCloseT = setTimeout(() => suffixDropdown.classList.remove("open"), 120);
  });

  if (!mainDropdown || !mainButton || !mainMenuEl ||
      !suffixDropdown || !suffixButton || !suffixMenuEl) {
    return;
  }

  function updateMainLabel() {
    mainLabelEl.textContent = labelForMain(currentBase, currentAux);
  }
  function updateSuffixLabel() {
    suffixLabelEl.textContent = labelForSuffix(currentSuffix);
  }

  function openMainMenu()  { mainDropdown.classList.add("open"); }
  function closeMainMenu() { mainDropdown.classList.remove("open"); }

  function openSuffixMenu()  { suffixDropdown.classList.add("open"); }
  function closeSuffixMenu() { suffixDropdown.classList.remove("open"); }

  function toggleMainMenu() {
    const open = mainDropdown.classList.contains("open");
    closeSuffixMenu();
    if (open) closeMainMenu(); else openMainMenu();
  }

  function toggleSuffixMenu() {
    const open = suffixDropdown.classList.contains("open");
    closeMainMenu();
    if (open) closeSuffixMenu(); else openSuffixMenu();
  }

  mainButton.addEventListener("click", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    mainDropdown.classList.toggle("open");
    suffixDropdown.classList.remove("open");
  });

  mainMenuEl.addEventListener("click", evt => {
    const sub = evt.target.closest(".rel-subitem");
    if (sub) {
      currentBase = "Aux";
      currentAux  = sub.dataset.variant || "AuxC";
      updateMainLabel();
      applyRelationChange(word, currentBase, currentAux, currentSuffix);
      closeMainMenu();
      return;
    }

    const item = evt.target.closest(".rel-item");
    if (!item) return;

    const baseVal = item.dataset.base;
    if (!baseVal) return;

    currentBase = baseVal;
    if (currentBase === "Aux" && !currentAux) {
      currentAux = "AuxC";
    } else if (currentBase !== "Aux") {
      currentAux = null;
    }

    updateMainLabel();
    applyRelationChange(word, currentBase, currentAux, currentSuffix);
    closeMainMenu();
  });

  suffixButton.addEventListener("click", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    suffixDropdown.classList.toggle("open");
    mainDropdown.classList.remove("open");
  });

  suffixMenuEl.addEventListener("click", evt => {
    const item = evt.target.closest(".suffix-item");
    if (!item) return;

    let key = item.dataset.key || "";

    if ((currentBase === "---" || !currentBase) && key) {
      showToast("Choose a main relation before adding a suffix.", "warn");
      key = "";
    }

    currentSuffix = key;
    updateSuffixLabel();
    applyRelationChange(word, currentBase, currentAux, currentSuffix);
    closeSuffixMenu();
  });

  if (!toolBody._relOutsideCloseBound) {
    toolBody._relOutsideCloseBound = true;

    document.addEventListener("mousedown", (evt) => {
      if (!toolBody.contains(evt.target)) {
        mainDropdown.classList.remove("open");
        suffixDropdown.classList.remove("open");
      }
    });
  }
}

function renderChangeAllRow(containerEl, wordsToApply) {
  if (!containerEl) return;

  // Basic UI scaffold (matches your dropdown style)
  const menuItems = buildMenuItems();

  containerEl.insertAdjacentHTML("afterbegin", `
    <div class="relation-tool relation-change-all">
      <div style="padding:10px 0 14px 0; border-bottom:1px solid #ddd; margin-bottom:12px;">
        <div class="relation-change-all-title">Change All</div>

        <div class="relation-top-row">
          <div class="rel-dropdown rel-dropdown-main rel-changeall-main">
            <button type="button" class="rel-button">
              <span class="rel-button-label">---</span>
              <span class="rel-button-arrow">▾</span>
            </button>
            <ul class="nested-dropdown">
              ${menuItems}
            </ul>
          </div>

          <div class="rel-dropdown rel-dropdown-suffix rel-changeall-suffix">
            <button type="button" class="rel-button">
              <span class="rel-button-label">---</span>
              <span class="rel-button-arrow">▾</span>
            </button>
            <ul class="nested-dropdown suffix-menu">
              <li class="rel-item suffix-item" data-key="">---</li>
              <li class="rel-item suffix-item" data-key="CO">CO</li>
              <li class="rel-item suffix-item" data-key="AP">AP</li>
              <li class="rel-item suffix-item" data-key="AP_CO">AP_CO</li>
            </ul>
          </div>

          <button type="button" class="rel-apply-all">Apply</button>
        </div>
      </div>
    </div>
  `);

  const mainDropdown = containerEl.querySelector(".rel-changeall-main");
  const mainBtn = mainDropdown?.querySelector(".rel-button");
  const mainLabel = mainDropdown?.querySelector(".rel-button-label");
  const mainMenu = mainDropdown?.querySelector(".nested-dropdown");

  const sufDropdown = containerEl.querySelector(".rel-changeall-suffix");
  const sufBtn = sufDropdown?.querySelector(".rel-button");
  const sufLabel = sufDropdown?.querySelector(".rel-button-label");
  const sufMenu = sufDropdown?.querySelector(".nested-dropdown");

  const applyBtn = containerEl.querySelector(".rel-apply-all");

  // --------------------
  // HOVER OPEN (Change All)
  // --------------------
  let mainCloseT = null;
  let sufCloseT  = null;

  mainDropdown.addEventListener("mouseenter", () => {
    if (mainCloseT) { clearTimeout(mainCloseT); mainCloseT = null; }
    mainDropdown.classList.add("open");
    sufDropdown.classList.remove("open");
  });
  mainDropdown.addEventListener("mouseleave", () => {
    if (mainCloseT) clearTimeout(mainCloseT);
    mainCloseT = setTimeout(() => mainDropdown.classList.remove("open"), 120);
  });

  sufDropdown.addEventListener("mouseenter", () => {
    if (sufCloseT) { clearTimeout(sufCloseT); sufCloseT = null; }
    sufDropdown.classList.add("open");
    mainDropdown.classList.remove("open");
  });
  sufDropdown.addEventListener("mouseleave", () => {
    if (sufCloseT) clearTimeout(sufCloseT);
    sufCloseT = setTimeout(() => sufDropdown.classList.remove("open"), 120);
  });

  if (!mainDropdown || !mainBtn || !mainMenu || !sufDropdown || !sufBtn || !sufMenu || !applyBtn) return;

  let currentBase = "---";
  let currentAux = null;
  let currentSuffix = "";

  function updateMainLabel() { mainLabel.textContent = labelForMain(currentBase, currentAux); }
  function updateSuffixLabel() { sufLabel.textContent = labelForSuffix(currentSuffix); }

  function openMain()  { mainDropdown.classList.add("open"); }
  function closeMain() { mainDropdown.classList.remove("open"); }
  function toggleMain() { mainDropdown.classList.toggle("open"); sufDropdown.classList.remove("open"); }

  function openSuffix()  { sufDropdown.classList.add("open"); }
  function closeSuffix() { sufDropdown.classList.remove("open"); }
  function toggleSuffix() { sufDropdown.classList.toggle("open"); mainDropdown.classList.remove("open"); }

  mainBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    mainDropdown.classList.toggle("open");
    sufDropdown.classList.remove("open");
  });

  sufBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sufDropdown.classList.toggle("open");
    mainDropdown.classList.remove("open");
  });

  mainMenu.addEventListener("click", (evt) => {
    const sub = evt.target.closest(".rel-subitem");
    if (sub) {
      currentBase = "Aux";
      currentAux  = sub.dataset.variant || "AuxC";
      updateMainLabel();
      closeMain();
      return;
    }

    const item = evt.target.closest(".rel-item");
    if (!item) return;

    const baseVal = item.dataset.base;
    if (!baseVal) return;

    currentBase = baseVal;
    if (currentBase === "Aux" && !currentAux) currentAux = "AuxC";
    if (currentBase !== "Aux") currentAux = null;

    updateMainLabel();
    closeMain();
  });

  sufMenu.addEventListener("click", (evt) => {
    const item = evt.target.closest(".suffix-item");
    if (!item) return;

    let key = item.dataset.key || "";

    if ((currentBase === "---" || !currentBase) && key) {
      showToast("Choose a main relation before adding a suffix.", "warn");
      key = "";
    }

    currentSuffix = key;
    updateSuffixLabel();
    closeSuffix();
  });

  applyBtn.addEventListener("click", () => {
    if (!Array.isArray(wordsToApply) || wordsToApply.length === 0) return;

    // 1) Apply to all selected words (updates model + tree labels + xml/autosave)
    wordsToApply.forEach(w => applyRelationChange(w, currentBase, currentAux, currentSuffix));

    // 2) Re-render the pinned panel so the dropdowns underneath reflect new relations
    if (typeof window.renderRelationInfo === "function") {
      window.renderRelationInfo(wordsToApply, { slot: "pinned" });
    }
  });


  if (!containerEl._relChangeAllOutsideCloseBound) {
    containerEl._relChangeAllOutsideCloseBound = true;

    document.addEventListener("mousedown", (e) => {
      if (!containerEl.contains(e.target)) {
        mainDropdown.classList.remove("open");
        sufDropdown.classList.remove("open");
      }
    });
  }

  // init labels
  updateMainLabel();
  updateSuffixLabel();
}

function wireRelationSettingsUI(toolBody) {
  const settingsBtn = toolBody.querySelector('#relation-settings-btn');
  const settingsBox = toolBody.querySelector('#relation-settings');
  const advCb = toolBody.querySelector('#relation-advanced-checkbox');
  if (!settingsBtn || !settingsBox || !advCb) return;

  // init from global state
  advCb.checked = !!window.relationAdvancedModeEnabled;

  settingsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = settingsBox.style.display === 'block';
    settingsBox.style.display = isOpen ? 'none' : 'block';
  });

  settingsBox.addEventListener('click', (e) => e.stopPropagation());

  if (!window._relationSettingsOutsideCloseBound) {
    window._relationSettingsOutsideCloseBound = true;

    document.addEventListener('mousedown', (e) => {
      const toolBody = document.getElementById('tool-body');
      if (!toolBody) return;

      const btn = toolBody.querySelector('#relation-settings-btn');
      const box = toolBody.querySelector('#relation-settings');
      if (!btn || !box) return;

      if (btn.contains(e.target) || box.contains(e.target)) return;
      box.style.display = 'none';
    });
  }

  advCb.addEventListener('change', () => {
    const enabled = !!advCb.checked;
    window.relationAdvancedModeEnabled = enabled;

    // Persist (optional)
    // localStorage.setItem('relationAdvancedModeEnabled', enabled ? 'true' : 'false');

    // Re-render relation panel to show/hide "Change all"
    const pinned = document.getElementById("relation-pinned");
    if (pinned && typeof window.renderRelationInfo === "function") {
      // force a refresh using current selection
      const currentSentence = window.treebankData?.find(s => String(s.id) === String(window.currentIndex));
      const ids = (window.batchSelection && window.batchSelection.size > 0)
        ? Array.from(window.batchSelection)
        : [document.querySelector(".token.selected")?.dataset?.wordId].filter(Boolean);

      const words = ids
        .map(id => currentSentence?.words?.find(w => String(w.id) === String(id)))
        .filter(Boolean);

      if (words.length > 0) window.renderRelationInfo(words);
    }
  });
}

/** Attach relation tool to toolbar. */
export function setupRelationTool() {
  const relationBtn = document.getElementById("relation");
  const toolBody    = document.getElementById("tool-body");
  const allButtons  = document.querySelectorAll("#toolbar button");
  if (!relationBtn || !toolBody) return;

  if (window.relationToolInitialized) return;
  window.relationToolInitialized = true;

  window.closeRelationTool = function () {
    relationBtn.classList.remove("active");
    relationBtn.style.backgroundColor = '#4e6476';
    document.body.classList.remove("mode-relation");
    window.isRelationActive = false;
    toolBody.querySelector('#relation-settings-btn')?.remove();
    toolBody.querySelector('#relation-settings')?.remove();

    if (window.treebankModeHTML) {
      toolBody.innerHTML = window.treebankModeHTML;
    } else {
      toolBody.innerHTML =
        '<p>Treebanking mode: click a word or node to edit dependencies.</p>';
    }
  };

  function ensureRelationPanelScaffold() {
    // If already present, do nothing
    if (document.getElementById("relation-pinned") && document.getElementById("relation-hover")) return;

    toolBody.innerHTML = `
      <div id="relation-panel">
        <div id="relation-pinned" class="relation-slot">
          <p style="padding:8px;">Click a word to edit its dependency relation.</p>
        </div>
        <div id="relation-hover" class="relation-slot"></div>
      </div>
    `;
  }

  const handler = () => {
    const wasActive = relationBtn.classList.contains("active");

    allButtons.forEach(btn => btn.classList.remove("active"));
    allButtons.forEach(btn => btn.style.backgroundColor = '#4e6476');

    if (wasActive) {
      window.closeRelationTool();
      return;
    }

    // switching *to* Relation: close others
    if (typeof window.closeMorphTool === "function") window.closeMorphTool();
    if (typeof window.closeSentenceTool === "function") window.closeSentenceTool();
    if (typeof window.exitReadOnly === "function") window.exitReadOnly();

    // Activate
    relationBtn.classList.add("active");
    relationBtn.style.backgroundColor = "green";
    document.body.classList.add("mode-relation");
    window.isRelationActive = true;

    // Build panel slots
    ensureRelationPanelScaffold();

    // make tool-body the positioning parent for the gear dropdown (same as Morph)
    toolBody.style.position = "relative";

    toolBody.querySelector('#relation-settings-btn')?.remove();
    toolBody.querySelector('#relation-settings')?.remove();

    toolBody.insertAdjacentHTML("beforeend", `
      <button id="relation-settings-btn" type="button" class="morph-gear-btn" aria-label="Settings">
        <svg class="morph-gear-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19.14,12.94c0.04-0.31,0.06-0.63,0.06-0.94s-0.02-0.63-0.06-0.94l2.03-1.58
            c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.11-0.2-0.35-0.28-0.56-0.2l-2.39,0.96
            c-0.5-0.38-1.04-0.69-1.63-0.94L14.4,2.81C14.36,2.59,14.16,2.43,13.93,2.43h-3.86
            c-0.23,0-0.43,0.16-0.47,0.38L9.24,5.37C8.65,5.62,8.11,5.93,7.61,6.31L5.22,5.35
            C5.01,5.27,4.77,5.35,4.66,5.55L2.74,8.87C2.63,9.07,2.68,9.34,2.86,9.48l2.03,1.58
            C4.85,11.37,4.83,11.69,4.83,12s0.02,0.63,0.06,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61
            l1.92,3.32c0.11,0.2,0.35,0.28,0.56,0.2l2.39-0.96c0.5,0.38,1.04,0.69,1.63,0.94l0.36,2.56
            c0.04,0.22,0.24,0.38,0.47,0.38h3.86c0.23,0,0.43-0.16,0.47-0.38l0.36-2.56
            c0.59-0.25,1.13-0.56,1.63-0.94l2.39,0.96c0.21,0.08,0.45,0,0.56-0.2l1.92-3.32
            c0.11-0.2,0.06-0.47-0.12-0.61L19.14,12.94z M12,15.5c-1.93,0-3.5-1.57-3.5-3.5
            s1.57-3.5,3.5-3.5s3.5,1.57,3.5,3.5S13.93,15.5,12,15.5z"/>
        </svg>
      </button>

      <div id="relation-settings"
        style="
          display:none;
          position:absolute;
          top:42px;
          right:6px;
          z-index:999;
          background:#fff;
          border:1px solid #ccc;
          border-radius:10px;
          padding:10px;
          box-shadow:0 4px 14px rgba(0,0,0,0.15);
          min-width:0;
          width:max-content;
        ">
        <label style="display:flex; gap:10px; align-items:center; margin:0;">
          <input type="checkbox" id="relation-advanced-checkbox" />
          <span>Advanced Mode</span>
        </label>
      </div>
    `);

    wireRelationSettingsUI(toolBody);

    // If there are already selected nodes BEFORE opening Relation,
    // show ALL of them. Otherwise fall back to the single selected token.
    if (Array.isArray(window.treebankData)) {
      const currentSentence = window.treebankData.find(s => String(s.id) === String(window.currentIndex));
      const pinned = document.getElementById("relation-pinned");
      const hover  = document.getElementById("relation-hover");
      if (hover) hover.innerHTML = "";

      const hasBatch = window.batchSelection && window.batchSelection.size > 0;

      if (hasBatch && currentSentence?.words && pinned) {
        const ids = Array.from(window.batchSelection).map(String).sort((a,b) => Number(a) - Number(b));
        const words = ids
          .map(id => currentSentence.words.find(w => String(w.id) === id))
          .filter(Boolean);

        if (words.length > 0) {
          // IMPORTANT: this requires renderRelationInfo to accept an array
          window.renderRelationInfo(words, { slot: "pinned" });
          return;
        }
      }

      // Fallback: single selected token
      const selectedToken = document.querySelector(".token.selected");
      const wordId = selectedToken?.dataset?.wordId;

      if (wordId && currentSentence?.words && pinned) {
        const wordObj = currentSentence.words.find(w => String(w.id) === String(wordId));
        if (wordObj) {
          window.renderRelationInfo(wordObj, { slot: "pinned" });
          return;
        }
      }
    }

    // otherwise keep default prompt (already in scaffold)
  };

  // Click tab toggle 
  relationBtn.addEventListener("click", (e) => {
    handler(e);
  });

// Slot-aware renderer called from sentenceDisplay / hoverSync
window.renderRelationInfo = function (wordOrWords, opts = {}) {
  if (!relationBtn.classList.contains("active")) return;
  if (!wordOrWords) return;

  ensureRelationPanelScaffold();

  const slot = (opts && opts.slot === "hover") ? "hover" : "pinned";
  const pinned = document.getElementById("relation-pinned");
  const hover  = document.getElementById("relation-hover");
  const root   = (slot === "hover") ? hover : pinned;
  if (!root) return;

  const words = Array.isArray(wordOrWords) ? wordOrWords.filter(Boolean) : [wordOrWords].filter(Boolean);
  if (words.length === 0) return;

  // keep your hover prompt-hiding logic the same
  if (slot === "hover" && pinned) {
    const pinnedHasEditor = pinned.querySelector(".relation-tool");
    const pinnedHasSelection = !!document.querySelector(".token.selected");
    if (!pinnedHasEditor && !pinnedHasSelection) {
      pinned.innerHTML = "";
    }
  }

  // Always rebuild the slot cleanly (but do it in a way that doesn't kill change-all)
  root.innerHTML = "";

  const isPinned = (slot !== "hover");

  // SHOW CHANGE-ALL HEADER ONLY IN PINNED + ONLY WHEN ADVANCED IS ON
  if (isPinned && window.relationAdvancedModeEnabled) {
    renderChangeAllRow(root, words);
  }

  // MULTI
  if (words.length > 1) {
    root.insertAdjacentHTML("beforeend", `<div class="relation-multi"></div>`);
    const wrap = root.querySelector(".relation-multi");

    words
      .slice()
      .sort((a,b) => Number(a.id) - Number(b.id))
      .forEach(w => {
        const block = document.createElement("div");
        block.className = "relation-word-block";
        block.dataset.wordId = String(w.id);
        wrap.appendChild(block);

        // render into a CHILD so it doesn't blow away change-all
        renderRelationEditor(w, block);
      });

    return;
  }

  // SINGLE
  if (window.relationAdvancedModeEnabled && isPinned) {
    // render into a child so change-all stays
    const block = document.createElement("div");
    block.className = "relation-word-block";
    block.dataset.wordId = String(words[0].id);
    root.appendChild(block);
    renderRelationEditor(words[0], block);
    return;
  }

  // Normal single (no advanced header present)
  renderRelationEditor(words[0], root);
};
  window.renderRelationEditor = window.renderRelationInfo;
}
