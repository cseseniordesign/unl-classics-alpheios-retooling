// ─── Compare Modal: Instructor Code Lookup ───────────────────────────────────

// Add the basename of every XML file placed in instructorTrees/ here.
const INSTRUCTOR_TREE_FILES = [
    'TestXML1_TEACHER.xml',
    // 'AnotherTree.xml',
];

// ── DOM helpers ───────────────────────────────────────────────────────────────

function getElements() {
    return {
        compareBtn : document.getElementById('compare'),
        overlay    : document.getElementById('compare-modal-overlay'),
        codeInput  : document.getElementById('compare-code-input'),
        errorMsg   : document.getElementById('compare-error-msg'),
        cancelBtn  : document.getElementById('compare-modal-cancel'),
        okBtn      : document.getElementById('compare-modal-ok'),
    };
}

// ── Modal open / close ────────────────────────────────────────────────────────

function openCompareModal({ codeInput, errorMsg, overlay }) {
    codeInput.value      = '';
    errorMsg.textContent = '';
    overlay.removeAttribute('hidden');
    codeInput.focus();
}

function closeCompareModal({ overlay }) {
    overlay.setAttribute('hidden', '');
}

// ── Validation ────────────────────────────────────────────────────────────────

function isValidCode(value) {
    return /^\d{6}$/.test(value);
}

// ── File search ───────────────────────────────────────────────────────────────

/**
 * Searches every XML file in instructorTrees/ for a <treebank> whose `code`
 * attribute matches the supplied 6-digit code.
 *
 * Returns the raw XML string of the first matching file, or null if none match.
 */
async function findInstructorTree(code) {
    const baseUrl = new URL('instructorTrees/', window.location.href).href;

    for (const filename of INSTRUCTOR_TREE_FILES) {
        const url = baseUrl + filename;
        let xmlText;

        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            xmlText = await response.text();
        } catch (err) {
            console.warn(`Could not fetch ${url}:`, err);
            continue;
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
        const root   = xmlDoc.querySelector('treebank');

        if (root && root.getAttribute('code') === code) {
            return xmlText;
        }
    }

    return null;
}

// ── Submit handler ────────────────────────────────────────────────────────────

async function handleSubmit(els) {
    const { codeInput, errorMsg, okBtn, overlay } = els;
    const code = codeInput.value.trim();

    if (!isValidCode(code)) {
        errorMsg.textContent = 'Please enter exactly 6 digits.';
        codeInput.focus();
        return;
    }

    okBtn.disabled       = true;
    okBtn.textContent    = 'Searching\u2026';
    errorMsg.textContent = '';

    try {
        const xmlText = await findInstructorTree(code);

        if (xmlText === null) {
            errorMsg.textContent = 'No instructor tree found for that code.';
            codeInput.focus();
            return;
        }

        // Store the matched XML globally so other modules can consume it
        window.instructorTreeXML  = xmlText;
        window.instructorTreeCode = code;

        console.log(`Instructor tree loaded (code: ${code})`);

        closeCompareModal({ overlay });

        // Notify the rest of the application
        document.dispatchEvent(new CustomEvent('instructorTreeLoaded', {
            detail: { code, xmlText }
        }));

    } catch (err) {
        errorMsg.textContent = 'An error occurred while loading. Please try again.';
        console.error('Instructor tree load error:', err);
    } finally {
        okBtn.disabled    = false;
        okBtn.textContent = 'Load Tree';
    }
}

// ── Public setup ──────────────────────────────────────────────────────────────

export function setupCompareModal() {
    const els = getElements();
    const { compareBtn, overlay, codeInput, cancelBtn, okBtn } = els;

    if (!compareBtn || !overlay) return;

    compareBtn.addEventListener('click', () => openCompareModal(els));
    cancelBtn.addEventListener('click',  () => closeCompareModal(els));
    okBtn.addEventListener('click',      () => handleSubmit(els));

    codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  handleSubmit(els);
        if (e.key === 'Escape') closeCompareModal(els);
    });

    // Strip non-digits as the user types
    codeInput.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 6);
    });

    // Backdrop click closes the modal
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeCompareModal(els);
    });
}
