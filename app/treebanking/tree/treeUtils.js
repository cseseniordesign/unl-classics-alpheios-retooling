import { setupWordHoverSync } from './hoverSync.js';
import { buildHierarchy, drawLinks, drawNodes, createNodeHierarchy } from './treeRender.js';

export const POS_COLORS = {
  v:'#c65a5a', c:'#c77d9b', d:'#e69109', i:'#b29100',
  n:'#4aa7b7', a:'#5a78c6', r:'#5a9b6b', l:'#6aa7d6',
  p:'#7a5aa9', u:'#444', m:'#888', '':'#444'
};

export const getPOSChar = w => {
  const tag = (w?._displayPostag || w?.postag || '');
  return tag[0] ? tag[0].toLowerCase() : '';
};

export function colorForPOS(w) {
  const tag = (w?._displayPostag || w?.postag || '');
  const ch = tag[0] ? tag[0].toLowerCase() : '';
  return POS_COLORS[ch] || POS_COLORS[''];
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
export function fitTreeToView(svg, gx, container, zoom, margin) {
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
 * Preserves zoom state during redraw
 */
export function compactTree() {
  // Save current zoom transform before redrawing the tree
  const prevTransform = window.svg ? d3.zoomTransform(window.svg.node()) : null;

  // Decrease vertical spacing between nodes
  window.verticalSpacing = Math.max(0.2, window.verticalSpacing - 0.2);
  
  // Redraw the tree
  updateTreeLayout();
  createNodeHierarchy(window.currentIndex);

  // Restore previous zoom transform after redraw
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
 * Preserves zoom state during redraw
 */
export function expandTree() {
  // Save current zoom transform before redrawing the tree
  const prevTransform = window.svg ? d3.zoomTransform(window.svg.node()) : null;

  // Increase vertical spacing between nodes
  window.verticalSpacing += 0.2;

  // Redraw the tree
  updateTreeLayout();
  createNodeHierarchy(window.currentIndex);

  // Restore previous zoom transform after redraw
  if (window.svg && window.zoom && prevTransform) {
    window.svg.call(window.zoom.transform, prevTransform);
  }
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
export function focusOnNode(node) {
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
 * --------------------------------------------------------------------------
 * FUNCTION: createsCycle
 * --------------------------------------------------------------------------
 * checks to see if a cycle is created
 */
export function createsCycle(words, dependentId, newHeadId) {
  let current = newHeadId;
  while (current && current !== "0" && current !== "root") {
    if (current === dependentId) return true;
    const parent = words.find(w => w.id === current);
    current = parent ? parent.head : null;
  }
  return false;
}

// Make tree control functions accessible globally (used by toolbar buttons)
window.compactTree = compactTree;
window.expandTree = expandTree;
window.focusOnNode = focusOnNode;
window.fitTreeToView = fitTreeToView;