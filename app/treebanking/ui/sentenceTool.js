import { displaySentence } from './sentenceDisplay.js';
import { saveState } from '../xml/undo.js';
import { discardXmlEdits, exitReadOnly } from '../xml/xmlTool.js';
import { triggerAutoSave } from '../xml/saveXML.js';
import { colorForPOS } from '../tree/treeUtils.js';
import { showConfirmDialog } from './modal.js';

let currentSentenceToolMode = 'merge'; // 'merge' | 'split'

/**
 * Simple toast helper for sentence tools.
 */
function sentenceShowToast(message, isError = false, isWarning = false) {
  const toast = document.getElementById('toast');
  if (!toast) {
    window.alert(message);
    return;
  }

  if (isError) {
    toast.style.background = '#c33';       // error = red
  } else if (isWarning) {
    toast.style.background = '#f0c36d';    // warning = muted yellow
  } else {
    toast.style.background = '#2e7d32';    // success = green
  }

  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
  }, 5000);
}

/**
 * Render a sentence into a preview box as colored tokens.
 */
function renderSentencePreview(container, sentence) {
  container.innerHTML = '';

  if (!sentence || !sentence.words || sentence.words.length === 0) {
    container.textContent = '(Sentence is empty)';
    return;
  }

  sentence.words.forEach((word, idx) => {
    const span = document.createElement('span');
    span.classList.add('token', 'preview-token');
    span.textContent = word.form || '';

    // apply the same POS color logic as the main sentence display
    try {
      span.style.color = colorForPOS(word);
    } catch {
      // if anything goes weird, just fall back to default color
    }

    container.appendChild(span);
    if (idx !== sentence.words.length - 1) {
      container.appendChild(document.createTextNode(' '));
    }
  });
}

/**
 * Render merged preview: current sentence followed by target sentence.
 */
function renderMergedPreview(container, currentSentence, targetSentence) {
  container.innerHTML = '';

  const pieces = [];
  if (currentSentence && currentSentence.words) pieces.push(currentSentence);
  if (targetSentence && targetSentence.words) pieces.push(targetSentence);

  if (pieces.length === 0) {
    container.textContent = '(Merged result would be empty)';
    return;
  }

  pieces.forEach((sent, sIndex) => {
    sent.words.forEach((word, wIndex) => {
      const span = document.createElement('span');
      span.classList.add('token', 'preview-token');
      span.textContent = word.form || '';

      try {
        span.style.color = colorForPOS(word);
      } catch {}

      container.appendChild(span);

      const isLastToken =
        sIndex === pieces.length - 1 &&
        wIndex === sent.words.length - 1;

      if (!isLastToken) {
        container.appendChild(document.createTextNode(' '));
      }
    });
  });
}

/**
 * Build the inner "Merge sentences" UI into the given container.
 * Shows:
 *   - target sentence preview (colored)
 *   - merged result preview (colored)
 */
function buildMergeUI(contentEl) {
  const data = window.treebankData || [];
  const total = data.length;
  const currentId = Number(window.currentIndex || 1);

  if (!total) {
    contentEl.innerHTML = `<p>No sentences are loaded yet.</p>`;
    return;
  }

  if (total === 1) {
    contentEl.innerHTML = `
      <section id="join-sentences-section">
        <h3>Merge sentences</h3>
        <p class="sentence-tool-intro">
          This document currently has only one sentence,
          so there is nothing to merge.
        </p>
      </section>
    `;
    return;
  }

  const currentSentence = data.find(s => Number(s.id) === currentId);

  contentEl.innerHTML = `
    <section id="join-sentences-section">
      <h3>Merge sentences</h3>
      <p class="sentence-tool-intro">
        Use this tool when a sentence was split too early. Choose which
        sentence to <strong>append to the current sentence (${currentId})</strong>.
        The selected sentence will be <strong>removed</strong> and its words
        will appear at the end of the current sentence.
      </p>

      <label for="join-target-select" class="sentence-tool-label">
        Sentence to append:
      </label>
      <select id="join-target-select"></select>

      <div id="join-target-preview" class="sentence-preview"></div>

      <h4 class="sentence-tool-subheading">Preview of merged sentence</h4>
      <div id="join-merged-preview" class="sentence-preview"></div>

      <button id="join-sentences-confirm">
        Merge sentences
      </button>
    </section>
  `;

  const select        = document.getElementById('join-target-select');
  const targetPreview = document.getElementById('join-target-preview');
  const mergedPreview = document.getElementById('join-merged-preview');

  // Populate dropdown with all sentences except the current one
  data.forEach((sent) => {
    const sid = Number(sent.id);
    if (sid === currentId) return;

    const opt = document.createElement('option');
    opt.value = String(sid);
    opt.textContent = `Sentence ${sid}`;
    select.appendChild(opt);
  });

  // Prefer the next sentence as default if possible
  const nextId = currentId + 1;
  if (Array.from(select.options).some(o => Number(o.value) === nextId)) {
    select.value = String(nextId);
  }

  function updatePreviews() {
    const targetId   = Number(select.value);
    const targetSent = data.find(s => Number(s.id) === targetId);

    renderSentencePreview(targetPreview, targetSent);
    renderMergedPreview(mergedPreview, currentSentence, targetSent);
  }

  updatePreviews();
  select.addEventListener('change', updatePreviews);

  // Join button behavior
  const joinBtn = document.getElementById('join-sentences-confirm');
  joinBtn.addEventListener('click', async () => {
    const targetId = Number(select.value);
    if (!targetId || targetId === currentId) {
      sentenceShowToast('Please choose a different sentence to merge.', true);
      return;
    }

    const ok = await showConfirmDialog(
      `Merge sentence ${targetId} into sentence ${currentId}?\n` +
      `This will remove sentence ${targetId} and can only be undone via the Undo tool.`,
      {
        titleText: 'Merge sentences',
        okText: 'Merge',
        cancelText: 'Cancel'
      }
    );
    if (!ok) return;

    performJoinSentences(currentId, targetId);
  });
}

function buildSplitUI(contentEl) {
  const data = window.treebankData || [];
  const currentId = Number(window.currentIndex || 1);

  if (!data || !data.length) {
    contentEl.innerHTML = `<p>No sentences are loaded yet.</p>`;
    return;
  }

  const sentence = data.find(s => Number(s.id) === currentId);
  if (!sentence || !sentence.words || sentence.words.length < 2) {
    contentEl.innerHTML = `
      <section id="split-sentences-section">
        <h3>Split sentence</h3>
        <p class="sentence-tool-intro">
          The current sentence does not have enough tokens to split.
        </p>
      </section>
    `;
    return;
  }

  const wordCount = sentence.words.length;

  contentEl.innerHTML = `
    <section id="split-sentences-section">
      <h3>Split sentence</h3>
      <p class="sentence-tool-intro">
        Split the <strong>current sentence (${currentId})</strong> into two sentences.
        Choose the point <strong>after</strong> which the sentence should be split.
        The words after that point will become a new sentence that follows the current one.
      </p>

      <label for="split-point-select" class="sentence-tool-label">
        Split after:
      </label>
      <select id="split-point-select"></select>

      <h4 class="sentence-tool-subheading">First Sentence</h4>
      <div id="split-first-preview" class="sentence-preview"></div>

      <h4 class="sentence-tool-subheading">Second Sentence</h4>
      <div id="split-second-preview" class="sentence-preview"></div>

      <button id="split-sentence-confirm">
        Split sentence
      </button>
    </section>
  `;

  const select        = document.getElementById('split-point-select');
  const firstPreview  = document.getElementById('split-first-preview');
  const secondPreview = document.getElementById('split-second-preview');

  // Fill the dropdown: "after 1: FORM", "after 2: FORM", ...
  for (let i = 1; i <= wordCount - 1; i++) {
    const w = sentence.words[i - 1];
    const opt = document.createElement('option');
    opt.value = String(i); // split after word i
    opt.textContent = `after ${i}: ${w.form || ''}`;
    select.appendChild(opt);
  }

  function updateSplitPreviews() {
    const splitAfter = Number(select.value); // 1..wordCount-1
    const firstWords  = sentence.words.slice(0, splitAfter);
    const secondWords = sentence.words.slice(splitAfter);

    renderSentencePreview(firstPreview,  { words: firstWords });
    renderSentencePreview(secondPreview, { words: secondWords });
  }

  updateSplitPreviews();
  select.addEventListener('change', updateSplitPreviews);

  const splitBtn = document.getElementById('split-sentence-confirm');
  splitBtn.addEventListener('click', async () => {
    const splitAfter = Number(select.value);
    if (!Number.isFinite(splitAfter) || splitAfter < 1 || splitAfter >= wordCount) {
      sentenceShowToast('Please choose a valid split point.', true);
      return;
    }

    const ok = await showConfirmDialog(
      `Split sentence ${currentId} into two sentences after word ${splitAfter}?`,
      {
        titleText: 'Split sentence',
        okText: 'Split',
        cancelText: 'Cancel'
      }
    );
    if (!ok) return;

    performSplitSentence(currentId, splitAfter);
  });
}

/**
 * Keep the Sentence tools content in sync with the current sentence / mode.
 * Called from displaySentence() and after merges.
 */
function refreshSentenceToolUI() {
  const sentenceBtn = document.getElementById('sentence-tools');
  const toolBody    = document.getElementById('tool-body');
  if (!sentenceBtn || !toolBody) return;
  if (!sentenceBtn.classList.contains('active')) return;

  const contentEl = document.getElementById('sentence-tool-content');
  if (!contentEl) return;

  if (currentSentenceToolMode === 'split') {
    buildSplitUI(contentEl);
  } else {
    buildMergeUI(contentEl);
  }
}

// expose to other modules (sentenceDisplay.js)
window.refreshSentenceToolUI = refreshSentenceToolUI;

/**
 * Perform the actual merge: update window.treebankData, refresh view, autosave.
 */
function performJoinSentences(sourceId, targetId) {
  const sentences = window.treebankData || [];
  if (!sentences.length) return;

  const sourceIndex = sentences.findIndex(s => Number(s.id) === Number(sourceId));
  const targetIndex = sentences.findIndex(s => Number(s.id) === Number(targetId));

  if (sourceIndex === -1 || targetIndex === -1) {
    sentenceShowToast('Unable to find one of the sentences to merge.', true);
    return;
  }

  const sourceSentence = sentences[sourceIndex];
  const targetSentence = sentences[targetIndex];

  if (!sourceSentence.words) sourceSentence.words = [];
  if (!targetSentence.words) targetSentence.words = [];

  const baseWords  = sourceSentence.words;
  const extraWords = targetSentence.words;

  if (!extraWords.length) {
    sentenceShowToast('The selected sentence has no words. Nothing to merge.', true);
    return;
  }

  // Save state for Undo before mutating
  saveState();

  const offset = baseWords.length;

  // Remap word ids and heads from the target sentence
  const remappedWords = extraWords.map((w, idx) => {
    const clone = { ...w };
    const newId = offset + idx + 1;

    clone.id = String(newId);

    const rawHead = (clone.head !== undefined && clone.head !== null)
      ? String(clone.head)
      : '0';

    const headNum = parseInt(rawHead, 10);
    if (!Number.isNaN(headNum) && headNum !== 0) {
      clone.head = String(headNum + offset);
    } else {
      // Non-numeric or 0 heads become 0 (root-level)
      clone.head = '0';
    }

    return clone;
  });

  // Append words to the source sentence
  sourceSentence.words = baseWords.concat(remappedWords);

  // Remove the target sentence
  sentences.splice(targetIndex, 1);

  // Renumber all sentence ids to remain contiguous (1..N)
  sentences.forEach((s, idx) => {
    s.id = String(idx + 1);
  });

  // Recompute currentIndex and totalSentences
  const newSourceIndex = sentences.indexOf(sourceSentence);
  const newSourceId    = newSourceIndex + 1;

  window.currentIndex   = newSourceId;
  window.totalSentences = sentences.length;

  // Refresh left-hand sentence + tree
  displaySentence(newSourceId);

  // Refresh sentence tools previews
  refreshSentenceToolUI();

  // Keep XML in sync (if autosave is wired)
  if (typeof triggerAutoSave === 'function') {
    triggerAutoSave();
  }

  sentenceShowToast(
    `Merged sentence ${targetId} into sentence ${sourceId}. ` +
    `New sentence id: ${newSourceId}.`
  );
}

function performSplitSentence(sentenceId, splitAfter) {
  const sentences = window.treebankData || [];
  if (!sentences.length) return;

  const sentenceIndex = sentences.findIndex(s => Number(s.id) === Number(sentenceId));
  if (sentenceIndex === -1) {
    sentenceShowToast('Unable to find the sentence to split.', true);
    return;
  }

  const sentence   = sentences[sentenceIndex];
  const words      = sentence.words || [];
  const wordCount  = words.length;

  if (wordCount < 2 || splitAfter < 1 || splitAfter >= wordCount) {
    sentenceShowToast('Invalid split point.', true);
    return;
  }

  // Save for Undo
  saveState();

  // Original segments based on position / id
  const firstWordsOriginal  = words.slice(0, splitAfter);    // ids 1..splitAfter
  const secondWordsOriginal = words.slice(splitAfter);       // ids splitAfter+1..N

  // ----- First sentence: ids 1..splitAfter -----
  const firstWords = firstWordsOriginal.map((w, idx) => {
    const clone = { ...w };
    const newId = idx + 1;
    clone.id = String(newId);

    const rawHead = (clone.head !== undefined && clone.head !== null)
      ? String(clone.head)
      : '0';
    const headNum = parseInt(rawHead, 10);

    if (!Number.isNaN(headNum) && headNum !== 0) {
      if (headNum > splitAfter) {
        // head pointed into what is now the second sentence → detach to root
        clone.head = '0';
      } else {
        // still points within first segment; ids 1..splitAfter remain the same
        clone.head = String(headNum);
      }
    } else {
      clone.head = '0';
    }

    return clone;
  });

  // ----- Second sentence: ids 1..(N - splitAfter) -----
  const secondWords = secondWordsOriginal.map((w, idx) => {
    const clone = { ...w };
    const newId = idx + 1;
    clone.id = String(newId);

    const rawHead = (clone.head !== undefined && clone.head !== null)
      ? String(clone.head)
      : '0';
    const headNum = parseInt(rawHead, 10);

    if (!Number.isNaN(headNum) && headNum !== 0) {
      if (headNum > splitAfter) {
        // head pointed into the part we're keeping → shift it down by splitAfter
        clone.head = String(headNum - splitAfter);
      } else {
        // head pointed back into what is now the first sentence → detach to root
        clone.head = '0';
      }
    } else {
      clone.head = '0';
    }

    return clone;
  });

  // Overwrite current sentence with the first part
  sentence.words = firstWords;

  // Create a fresh sentence object for the second part
  const newSentence = {
    ...sentence,
    words: secondWords
  };

  // Insert the new sentence right after the first one
  sentences.splice(sentenceIndex + 1, 0, newSentence);

  // Renumber sentence ids to be 1..N in order
  sentences.forEach((s, idx) => {
    s.id = String(idx + 1);
  });

  // Recompute currentIndex / totals
  const firstIdx = sentences.indexOf(sentence);
  const firstId  = firstIdx + 1;

  window.currentIndex   = firstId;
  window.totalSentences = sentences.length;

  // Re-render current sentence + tree
  displaySentence(firstId);

  // Refresh the Sentence tools panel (previews & dropdown)
  if (typeof window.refreshSentenceToolUI === 'function') {
    window.refreshSentenceToolUI();
  }

  // Keep XML in sync
  if (typeof triggerAutoSave === 'function') {
    triggerAutoSave();
  }

  sentenceShowToast(
    `Split sentence ${sentenceId} into sentences ${firstId} and ${firstId + 1}.`
  );
}

/**
 * Sets up the Sentence Tools tab and its click handler.
 */
export function setupSentenceTool() {
  if (window.sentenceToolInitialized) return;
  window.sentenceToolInitialized = true;

  const sentenceBtn    = document.getElementById('sentence-tools');
  const toolBody       = document.getElementById('tool-body');
  const allToolButtons = document.querySelectorAll('#toolbar button');

  if (!sentenceBtn || !toolBody) return;

  sentenceBtn.addEventListener('click', () => {
    const wasActive = sentenceBtn.classList.contains('active');

    // Reset all toolbar button states
    allToolButtons.forEach(btn => btn.classList.remove('active'));
    allToolButtons.forEach(btn => btn.style.backgroundColor = '#4e6476');
    sentenceBtn.style.backgroundColor = 'green';

    if (wasActive) {
      // Leaving Sentence tools
      sentenceBtn.classList.remove('active');
      sentenceBtn.style.backgroundColor = '#4e6476';
      toolBody.innerHTML =
        `<p>Please select a tool from the bar above that you would like to use.</p>`;
      exitReadOnly();
      return;
    }

    // Entering Sentence tools
    sentenceBtn.classList.add('active');

    // If we were editing XML, discard safely and exit read-only mode
    discardXmlEdits();
    exitReadOnly();

    // Build the Sentence tools container shell
    toolBody.innerHTML = `
      <div id="sentence-tool-container">
        <div id="sentence-tool-modes">
          <button id="sentence-merge-mode" class="sentence-mode active">
            Merge sentences
          </button>
          <button id="sentence-split-mode" class="sentence-mode">
            Split sentences
          </button>
        </div>
        <div id="sentence-tool-content"></div>
      </div>
    `;

    const contentEl   = document.getElementById('sentence-tool-content');
    const mergeMode   = document.getElementById('sentence-merge-mode');
    const splitMode   = document.getElementById('sentence-split-mode');
    const modeButtons = [mergeMode, splitMode];

    function setMode(mode) {
      currentSentenceToolMode = mode;
      modeButtons.forEach(b => b.classList.remove('active'));
      if (mode === 'merge') {
        mergeMode.classList.add('active');
        buildMergeUI(contentEl);
      } else {
        splitMode.classList.add('active');
        buildSplitUI(contentEl);
      }
    }

    mergeMode.addEventListener('click', () => setMode('merge'));
    splitMode.addEventListener('click', () => setMode('split'));

    // Default mode = merge
    setMode('merge');
  });
}
