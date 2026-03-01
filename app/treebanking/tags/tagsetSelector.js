/**
 * tagsetSelector.js
 * -----------------
 * Renders the tagset format selector on the input page (index.html).
 *
 * Drop this into your existing input page by:
 *   1. Adding <div id="tagset-selector-root"></div> where you want it in index.html
 *   2. Calling initTagsetSelector() on page load
 *
 * On selection the config is loaded from the dist JSON and stored in
 * tagsetStore. The existing input.js sendSentence() flow continues
 * unchanged — it will just find the active config in the store when
 * the treebanking page initializes.
 */

import { TAGSET_REGISTRY } from './tagsetRegistry.js';
import { loadTagsetConfig }  from './tagsetConfig.js';
import { setActiveTagset }   from './tagsetStore.js';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * @param {object} [opts]
 * @param {string}   [opts.containerId='tagset-selector-root']
 * @param {function} [opts.onLoaded]   - callback(config) after successful load
 * @param {string}   [opts.defaultId]  - pre-select this tagset id on mount
 */
export function initTagsetSelector(opts = {}) {
  const {
    containerId = 'tagset-selector-root',
    onLoaded    = null,
    defaultId   = null,
  } = opts;

  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`tagsetSelector: element #${containerId} not found`);
    return;
  }

  container.innerHTML = _buildHTML();
  _attachEvents(container, { onLoaded, defaultId });
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function _buildHTML() {
  const options = TAGSET_REGISTRY.map(entry => {
    const label = entry.beta ? `${entry.label}` : entry.label;
    return `<option value="${entry.id}">${label}</option>`;
  }).join('\n          ');

  return `
<div class="ts-wrapper">
  <label class="ts-label" for="ts-select">Annotation Format</label>
  <div class="ts-row">
    <select id="ts-select" class="ts-select">
      <option value="">— Choose a tagset —</option>
      ${options}
    </select>
  </div>
  <div id="ts-meta" class="ts-meta" hidden></div>
  <div id="ts-status" class="ts-status" aria-live="polite"></div>
</div>`.trim();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function _attachEvents(container, { onLoaded, defaultId }) {
  const select  = container.querySelector('#ts-select');
  const metaDiv = container.querySelector('#ts-meta');
  const status  = container.querySelector('#ts-status');

  select.addEventListener('change', async () => {
    const id = select.value;
    if (!id) {
      metaDiv.hidden = true;
      status.textContent = '';
      status.className = 'ts-status';
      return;
    }

    const entry = TAGSET_REGISTRY.find(t => t.id === id);
    if (!entry) return;

    // Show meta immediately
    _showMeta(metaDiv, entry);
    _setStatus(status, 'loading', `Loading ${entry.label}…`);
    select.disabled = true;

    try {
      const config = await loadTagsetConfig(entry.distFile, entry);
      setActiveTagset(config);

      const morphNote = config.hasMorph
        ? `${Object.keys(config.morphAttributes).length} morph attributes`
        : 'syntax only';
      const relCount = config.relations ? Object.keys(config.relations).length : 0;

      _setStatus(status, 'success',
        `✓ ${config.posCategories.length} POS · ${relCount} relations · ${morphNote}`
      );

      if (typeof onLoaded === 'function') onLoaded(config);

    } catch (err) {
      _setStatus(status, 'error', `✗ ${err.message}`);
    } finally {
      select.disabled = false;
    }
  });

  // Pre-select default
  if (defaultId) {
    const opt = select.querySelector(`option[value="${defaultId}"]`);
    if (opt) {
      select.value = defaultId;
      select.dispatchEvent(new Event('change'));
    }
  }
}

// ---------------------------------------------------------------------------
// Meta info strip
// ---------------------------------------------------------------------------

function _showMeta(div, entry) {
  const LANG_LABELS = { grc:'Ancient Greek', lat:'Latin', eng:'English', per:'Persian' };
  const lang = LANG_LABELS[entry.lang] ?? entry.lang;
  const morph = entry.hasMorph ? 'Morphology + Syntax' : 'Syntax only';

  div.hidden = false;
  div.innerHTML =
    `<span>${lang}</span><span class="ts-sep">·</span>` +
    `<span>${morph}</span>` +
    (entry.beta ? `<span class="ts-sep">·</span><span class="ts-beta">Beta</span>` : '');
}

// ---------------------------------------------------------------------------
// Status helper
// ---------------------------------------------------------------------------

function _setStatus(el, type, msg) {
  el.textContent = msg;
  el.className = `ts-status ts-status--${type}`;
}
