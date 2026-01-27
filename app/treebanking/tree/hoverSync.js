/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupWordHoverSync
 * --------------------------------------------------------------------------
 * highlights corresponding words and nodes that are moused over.
 * ALSO: when Morph/Relation is active, show info in the hover panel slot.
 */
export function setupWordHoverSync() {
  const words = document.querySelectorAll(".token");
  const nodes = document.querySelectorAll(".node");

  function getWordById(id) {
    const sent = Array.isArray(window.treebankData)
      ? window.treebankData.find(s => s.id === `${window.currentIndex}`)
      : null;
    return sent && Array.isArray(sent.words)
      ? sent.words.find(w => String(w.id) === String(id))
      : null;
  }

  function clearHoverPanels() {
    // Morph hover slot
    const mh = document.getElementById("morph-hover");
    if (mh) mh.innerHTML = "";

    // Relation hover slot 
    const rh = document.getElementById("relation-hover");
    if (rh) rh.innerHTML = "";

    // ---- Restore pinned prompts ONLY if nothing is pinned ----
    const morphPinned = document.getElementById("morph-pinned");
    if (window.isMorphActive && morphPinned) {
      const hasPinnedMorphUI = !!morphPinned.querySelector(".morph-container");
      const hasPinnedSelection = !!window.currentSelectedWordId; // pinned word
      if (!hasPinnedMorphUI && !hasPinnedSelection) {
        morphPinned.innerHTML = `<p style="padding:8px;">Click a word to view morphological info.</p>`;
      }
    }

    const relPinned = document.getElementById("relation-pinned");
    if (window.isRelationActive && relPinned) {
      const hasPinnedRelUI = !!relPinned.querySelector(".relation-tool");
      const hasPinnedSelection = !!window.currentSelectedWordId;
      if (!hasPinnedRelUI && !hasPinnedSelection) {
        relPinned.innerHTML = `<p style="padding:8px;">Click a word to edit its dependency relation.</p>`;
      }
    }
  }

  function showHoverForId(id) {
    const w = getWordById(id);
    if (!w) return;

    // If the hovered word is already pinned/selected, don't show it again in hover slot
    const pinnedId = window.currentSelectedWordId; // pinned/selected word id
    if (pinnedId != null && String(pinnedId) === String(id)) {
      // Clear the hover slots so we don't duplicate the pinned word
      const mh = document.getElementById("morph-hover");
      if (mh) mh.innerHTML = "";
      const rh = document.getElementById("relation-hover");
      if (rh) rh.innerHTML = "";
      return;
    }

    // If nothing is pinned, hide the pinned prompt while hovering
    if (window.isMorphActive) {
      const mp = document.getElementById("morph-pinned");
      const hasPinnedSelection = !!window.currentSelectedWordId;
      const hasPinnedMorphUI = mp && !!mp.querySelector(".morph-container");
      if (mp && !hasPinnedSelection && !hasPinnedMorphUI) mp.innerHTML = "";
    }

    if (window.isRelationActive) {
      const rp = document.getElementById("relation-pinned");
      const hasPinnedSelection = !!window.currentSelectedWordId;
      const hasPinnedRelUI = rp && !!rp.querySelector(".relation-tool");
      if (rp && !hasPinnedSelection && !hasPinnedRelUI) rp.innerHTML = "";
    }

    if (window.isMorphActive && typeof window.renderMorphInfo === "function") {
      window.renderMorphInfo(w, { slot: "hover" });
    }
    if (window.isRelationActive && typeof window.renderRelationInfo === "function") {
      window.renderRelationInfo(w, { slot: "hover" });
    }
  }

  // Tokens hover
  words.forEach(token => {
    const id = token.dataset.wordId;

    token.addEventListener("mouseover", () => {
      token.classList.add("highlight");
      const node = document.querySelector(`.node[id="${id}"]`);
      if (node) node.classList.add("highlight");
      showHoverForId(id);
    });

    token.addEventListener("mouseleave", () => {
      token.classList.remove("highlight");
      const node = document.querySelector(`.node[id="${id}"]`);
      if (node) node.classList.remove("highlight");
      clearHoverPanels();
    });
  });

  // Nodes hover
  nodes.forEach(nodeEl => {
    const id = nodeEl.id;

    nodeEl.addEventListener("mouseover", () => {
      nodeEl.classList.add("highlight");
      const token = document.querySelector(`.token[data-word-id="${id}"]`);
      if (token) token.classList.add("highlight");
      showHoverForId(id);
    });

    nodeEl.addEventListener("mouseleave", () => {
      nodeEl.classList.remove("highlight");
      const token = document.querySelector(`.token[data-word-id="${id}"]`);
      if (token) token.classList.remove("highlight");
      clearHoverPanels();
    });
  });

  // Extra safety:
  // if DOM rerenders under the mouse (head-change), mouseleave may never fire.
  // This makes sure hover clears whenever you're not over a token/node.
  document.addEventListener("mousemove", () => {
    // If ANY token or node is hovered, don't clear.
    if (document.querySelector(".token:hover") || document.querySelector(".node:hover")) return;
    clearHoverPanels();
  });
}
