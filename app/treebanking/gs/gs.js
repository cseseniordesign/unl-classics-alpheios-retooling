/**
 * gs.js – Compare-mode controller
 *
 * Renders two fully independent read-only dependency trees side by side.
 *
 * Root cause of the "left tree uncontrollable" bug:
 *   treeRender.js's createNodeHierarchy() has two closure problems:
 *   1. The zoom on('zoom') handler closes over the local `g` variable from
 *      whichever render ran last — so both SVGs' zoom events move the same <g>.
 *   2. document.querySelectorAll(".node") selects ALL nodes in the document,
 *      overwriting click listeners on tree A's nodes to reference window.svg
 *      and window.zoom (which are always tree B's after the second render).
 *
 * Fix: don't call createNodeHierarchy() at all. Instead re-implement the render
 * here using the pure helper exports (prepareSentenceData, buildHierarchy,
 * drawLinks, drawNodes, fitTreeToView) with all D3 state in local variables
 * per panel, so closures are correctly scoped.
 */

import { prepareSentenceData, buildHierarchy, drawLinks, drawNodes } from '../tree/treeRender.js';
import { fitTreeToView } from '../tree/treeUtils.js';

// Needed by buildHierarchy via window.verticalSpacing
window.verticalSpacing = window.verticalSpacing || 1;

// Disable all editing globals so node clicks / tool code is inert
window.handleWordClick   = () => {};
window.isMorphActive     = false;
window.isRelationActive  = false;
window.closeMorphTool    = () => {};
window.closeRelationTool = () => {};
window.resetSelection    = () => {};
window.batchSelection    = new Set();
window.inSelection       = false;

// ─── Per-panel state ──────────────────────────────────────────────────────────
// Each entry stores the data and the live D3 handles for that panel.
// D3 handles are local to the render call — no window.* globals involved.

const panels = {
  a: {
    sandboxId:      'sandbox-a',
    treeBankId:     'tree-bank-a',
    data:           null,
    currentIndex:   1,
    totalSentences: 0,
    // Live D3/DOM handles set after each renderPanel() call:
    svgNode:   null,   // the raw SVG DOM element
    svgSel:    null,   // d3 selection of that SVG
    zoom:      null,   // d3 zoom behaviour
    gx:        null,   // inner drawing group selection
    root:      null,   // d3 hierarchy root
    margin:    null,
    container: null,
  },
  b: {
    sandboxId:      'sandbox-b',
    treeBankId:     'tree-bank-b',
    data:           null,
    currentIndex:   1,
    totalSentences: 0,
    svgNode:   null,
    svgSel:    null,
    zoom:      null,
    gx:        null,
    root:      null,
    margin:    null,
    container: null,
  },
};

// ─── Core render — fully self-contained, no window.* globals ─────────────────

function renderPanel(key, sentenceId) {
  const p = panels[key];

  if (!p.data || !p.data.length) return;

  const sentence = p.data.find(s => s.id === String(sentenceId));
  if (!sentence) { console.error(`Sentence ${sentenceId} not found in tree ${key}`); return; }

  // buildHierarchy reads window.verticalSpacing (set above, never changed)
  const idParentPairs  = prepareSentenceData(sentence);
  const rootHierarchy  = buildHierarchy(idParentPairs);

  // ── Forest-root x-shifting (same logic as treeRender.js) ──────────────────
  let maxMainX = 0;
  rootHierarchy.children?.forEach(child => {
    if (!child.data.isForestRoot) {
      child.each(node => { if (node.x > maxMainX) maxMainX = node.x; });
    }
  });

  const horizontalGap = 90;
  const forestGap     = 90;
  let currentForestX  = maxMainX + horizontalGap;

  rootHierarchy.children?.forEach(child => {
    if (!child.data.isForestRoot) return;
    let minX = Infinity, maxX = -Infinity;
    child.each(n => { if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x; });
    const subtreeWidth = (maxX - minX) || 0;
    const shiftAmount  = currentForestX - minX;
    child.each(n => { n.x += shiftAmount; });
    currentForestX += subtreeWidth + forestGap;
  });

  // ── DOM handles — select from this panel's own elements only ──────────────
  const container = document.getElementById(p.treeBankId);
  const svgEl     = document.querySelector(`#${p.sandboxId} svg`);
  if (!container || !svgEl) { console.error(`Panel DOM missing for tree ${key}`); return; }

  // LOCAL variables — closures below will capture these, not window.*
  const svg    = d3.select(svgEl);
  const width  = container.clientWidth;
  const height = container.clientHeight;
  const margin = { top: 40, right: 40, bottom: 40, left: 40 };

  svg.selectAll('*').remove();
  svg.attr('width', width)
     .attr('height', height)
     .attr('viewBox', [0, 0, width, height])
     .attr('preserveAspectRatio', 'xMidYMid meet');

  // LOCAL g and gx — the zoom closure captures these, scoped to this panel
  const g  = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const gx = g.append('g');

  drawLinks(gx, rootHierarchy, idParentPairs);
  drawNodes(gx, rootHierarchy);

  // ── Zoom — closure captures local `g`, `margin` for this panel only ───────
  const zoom = d3.zoom()
    .scaleExtent([0.1, 3])
    .on('zoom', (event) => {
      // This always moves THIS panel's g, regardless of window.* state
      g.attr('transform', `translate(${margin.left},${margin.top}) ${event.transform.toString()}`);
    });

  svg.call(zoom);

  // Fit on first load
  fitTreeToView(svg, gx, container, zoom, margin, true);

  // ── Save handles into panel state ─────────────────────────────────────────
  p.svgNode   = svgEl;
  p.svgSel    = svg;
  p.zoom      = zoom;
  p.gx        = gx;
  p.root      = rootHierarchy;
  p.margin    = margin;
  p.container = container;
  p.currentIndex   = sentenceId;
  p.totalSentences = p.data.length;

  updateNavButtons(key);
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function populateSelect(key) {
  const select = document.getElementById(`select-${key}`);
  if (!select) return;
  select.innerHTML = '';

  panels[key].data.forEach(sentence => {
    const opt  = document.createElement('option');
    opt.value  = sentence.id;
    const text = Array.isArray(sentence.words) ? sentence.words.map(w => w.form).join(' ') : '';
    opt.textContent = `${sentence.id}: ${text.length <= 24 ? text : text.slice(0, 24) + '…'}`;
    select.appendChild(opt);
  });

  select.value = panels[key].currentIndex;
  select.addEventListener('change', e => {
    const id = parseInt(e.target.value, 10);
    panels[key].currentIndex = id;
    renderPanel(key, id);
  });
}

function updateNavButtons(key) {
  const { currentIndex: idx, totalSentences: tot } = panels[key];
  document.querySelectorAll(`.nav-btn[data-tree="${key}"]`).forEach(btn => {
    const nav    = btn.dataset.nav;
    btn.disabled = (nav === 'first' || nav === 'back') ? idx <= 1
                 : (nav === 'next'  || nav === 'last') ? idx >= tot
                 : false;
  });
  const select = document.getElementById(`select-${key}`);
  if (select) select.value = idx;
}

function navigate(key, action) {
  const p   = panels[key];
  let   idx = p.currentIndex;
  if      (action === 'first') idx = 1;
  else if (action === 'last')  idx = p.totalSentences;
  else if (action === 'back')  idx = Math.max(1, idx - 1);
  else if (action === 'next')  idx = Math.min(p.totalSentences, idx + 1);
  p.currentIndex = idx;
  renderPanel(key, idx);
}

// ─── Toolbar controls ─────────────────────────────────────────────────────────

function handleControl(key, action) {
  const p = panels[key];
  if (!p.svgSel || !p.zoom) return;

  if (action === 'center') {
    fitTreeToView(p.svgSel, p.gx, p.container, p.zoom, p.margin, true);

  } else if (action === 'compact') {

    const t = d3.zoomTransform(p.svgNode);
    p.svgSel
      .transition()
      .duration(300)
      .call(p.zoom.transform, t.scale(0.75));

  } else if (action === 'expand') {

    const t = d3.zoomTransform(p.svgNode);
    p.svgSel
      .transition()
      .duration(300)
      .call(p.zoom.transform, t.scale(1.33));

  } else if (action === 'focus-root') {

    const firstChild = p.root?.children?.[0];
    if (firstChild) {
      const cW = p.container?.clientWidth / 2  || 800;
      const cH = p.container?.clientHeight / 3 || 600;
      p.svgSel.transition().duration(400).call(
        p.zoom.transform,
        d3.zoomIdentity.translate(cW / 2 - firstChild.x, cH / 2 - firstChild.y)
      );
    }
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  let dataA, dataB;
  try {
    dataA = JSON.parse(localStorage.getItem('compareDataA') || 'null');
    dataB = JSON.parse(localStorage.getItem('compareDataB') || 'null');
  } catch (e) {
    console.error('Failed to parse compare data:', e);
  }

  if (!dataA?.length || !dataB?.length) {
    document.getElementById('body').innerHTML =
      '<p style="padding:2rem;color:#c00;">No comparison data found. Please return to the input page and upload two XML files.</p>';
    return;
  }

  document.getElementById('label-a').textContent = localStorage.getItem('compareLabelA') || 'Tree A';
  document.getElementById('label-b').textContent = localStorage.getItem('compareLabelB') || 'Tree B';

  panels.a.data = dataA; panels.a.totalSentences = dataA.length;
  panels.b.data = dataB; panels.b.totalSentences = dataB.length;

  populateSelect('a');
  populateSelect('b');

  renderPanel('a', 1);
  renderPanel('b', 1);

  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => navigate(btn.dataset.tree, btn.dataset.nav))
  );

  document.querySelectorAll('.ctrl-btn').forEach(btn =>
    btn.addEventListener('click', () => handleControl(btn.dataset.tree, btn.dataset.action))
  );

  document.getElementById('exit-btn')?.addEventListener('click', () => {
    ['compareXmlA','compareXmlB','compareDataA','compareDataB',
     'compareLabelA','compareLabelB'].forEach(k => localStorage.removeItem(k));
    window.location.href = './index.html';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
