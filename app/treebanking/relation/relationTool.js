import { triggerAutoSave } from "../xml/saveXML.js";

/**
 * Relation tool with nested Aux submenu.
 *
 * Base dropdown is a custom <button> + <ul>, NOT a native <select>,
 * so we can show a second column for AuxP / AuxC / ...
 *
 * Suffix dropdown on the right stays a normal <select>.
 */

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

/** Render relation editor for a single word into toolBody. */
function renderRelationEditor(word, toolBody) {
  if (!word || !toolBody) return;

  const { base, auxVariant, suffixKey } = parseRelation(word.relation);
  let currentBase   = base;
  let currentAux    = auxVariant;
  let currentSuffix = suffixKey;

  const menuItems      = buildMenuItems();
  const mainLabel      = labelForMain(currentBase, currentAux);
  const suffixLabel    = labelForSuffix(currentSuffix);

  toolBody.innerHTML = `
    <div class="relation-tool">
      <p class="morph-form">
        ${word.form || ""}
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

  // --- grab elements ---
  const mainDropdown   = toolBody.querySelector(".rel-dropdown-main");
  const mainButton     = mainDropdown?.querySelector(".rel-button");
  const mainLabelEl    = mainDropdown?.querySelector(".rel-button-label");
  const mainMenuEl     = mainDropdown?.querySelector(".nested-dropdown");

  const suffixDropdown = toolBody.querySelector(".rel-dropdown-suffix");
  const suffixButton   = suffixDropdown?.querySelector(".rel-button");
  const suffixLabelEl  = suffixDropdown?.querySelector(".rel-button-label");
  const suffixMenuEl   = suffixDropdown?.querySelector(".nested-dropdown");

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

  // --- main dropdown behaviour ---
  mainButton.addEventListener("click", evt => {
    evt.stopPropagation();
    toggleMainMenu();
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

  // --- suffix dropdown behaviour ---
  suffixButton.addEventListener("click", evt => {
    evt.stopPropagation();
    toggleSuffixMenu();
  });

  suffixMenuEl.addEventListener("click", evt => {
    const item = evt.target.closest(".suffix-item");
    if (!item) return;

    let key = item.dataset.key || "";

    // don't allow suffix without main relation
    if ((currentBase === "---" || !currentBase) && key) {
      showToast("Choose a main relation before adding a suffix.", "warn");
      key = "";
    }

    currentSuffix = key;
    updateSuffixLabel();
    applyRelationChange(word, currentBase, currentAux, currentSuffix);
    closeSuffixMenu();
  });

  // --- close both when clicking outside ---
  function handleDocClick(evt) {
    if (!toolBody.contains(evt.target)) {
      closeMainMenu();
      closeSuffixMenu();
    }
  }
  document.addEventListener("click", handleDocClick, { once: true });
}

/** Attach relation tool to toolbar. */
export function setupRelationTool() {
  const relationBtn = document.getElementById("relation");
  const toolBody    = document.getElementById("tool-body");
  const allButtons  = document.querySelectorAll("#toolbar button");
  if (!relationBtn || !toolBody) return;

  // avoid double-setup
  if (window.relationToolInitialized) return;
  window.relationToolInitialized = true;

  // Public closer so other tools can shut Relation off if needed
  window.closeRelationTool = function () {
    relationBtn.classList.remove("active");
    document.body.classList.remove("mode-relation");
    window.isRelationActive = false;
    toolBody.innerHTML =
      '<p>Please select a tool from the bar above that you would like to use.</p>';
  };

  const handler = () => {
    const wasActive = relationBtn.classList.contains("active");

    // Clear all active toolbar buttons
    allButtons.forEach(btn => btn.classList.remove("active"));

    if (wasActive) {
      // We were on Relation → turn it off
      window.closeRelationTool();
      return;
    }

    // We are switching *to* Relation from some other tool.
    // Let other tools clean up their own state if they expose closers.
    if (typeof window.closeMorphTool === "function") {
      window.closeMorphTool();
    }
    if (typeof window.closeSentenceTool === "function") {
      window.closeSentenceTool();
    }
    if (typeof window.exitReadOnly === "function") {
      // XML tool's "leave edit mode"
      window.exitReadOnly();
    }

    // Activate Relation
    relationBtn.classList.add("active");
    document.body.classList.add("mode-relation");
    window.isRelationActive = true;

    // If a word is already selected, immediately show its relation info
    const selectedToken = document.querySelector(".token.selected");
    if (selectedToken && Array.isArray(window.treebankData)) {
        const wordId = selectedToken.dataset.wordId;

        const currentSentence = window.treebankData.find(
            s => s.id === `${window.currentIndex}`
        );
        const wordObj = currentSentence?.words.find(
            w => String(w.id) === String(wordId)
        );

        if (wordObj) {
        // Use your existing renderer
            renderRelationEditor(wordObj, toolBody);
            return; // we’re done, don’t overwrite with “Click a word…”
        }
    }

    // Fallback if nothing is selected yet
    toolBody.innerHTML =
        '<p style="padding:8px;">Click a word to edit its dependency relation.</p>';
  };

  // Single click handler
  relationBtn.addEventListener("click", handler);

  // Called from sentenceDisplay / tree click
  window.renderRelationInfo = function (word) {
    // Guard based on the button state, not a stale flag
    if (!relationBtn.classList.contains("active")) return;
    renderRelationEditor(word, toolBody);
  };
  window.renderRelationEditor = window.renderRelationInfo;
}
