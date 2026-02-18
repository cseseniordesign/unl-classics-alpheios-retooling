import { ensureFormsArray, composeUserPostag, parseMorphTag } from './morphHelpers.js';
import { applyActiveSelectionToWord, renderUserFormsList } from './morphTool.js';
import { triggerAutoSave } from '../xml/saveXML.js';
import { showConfirmDialog } from '../ui/modal.js';
import { getLanguage } from '../input/language.js';

// Inline editor that appears under the button and closes on save
export function renderCreateEditorBelow(word, toolBody, opts = {}) {
    const seedForm = opts.seedForm || null;
    ensureFormsArray(word);
    const lang = getLanguage();
    const isLatin = String(lang).toLowerCase().startsWith('lat');

    // Only one editor at a time
    toolBody.querySelector('.morph-editor-inline')?.remove();

    const host = document.createElement('div');
    host.className = 'morph-editor-inline';
    host.style.marginTop = '12px';
    host.innerHTML = `
        <div class="field">
        <label>Lemma</label>
        <input id="nf-lemma" type="text" value="${(
            (seedForm?.lemma || word._displayLemma || word._doc?.lemma || word.lemma || word.form || '').trim()
        )}"/>
        </div>

        <div class="field">
        <label>Part of Speech</label>
        <select id="nf-pos">
            <option value="">— choose —</option>
            <option value="n">noun</option>
            <option value="a">adjective</option>
            <option value="v">verb</option>
            <option value="p">pronoun</option>
            <option value="l">article</option>
            <option value="d">adverb</option>
            <option value="c">conjunction</option>
            <option value="r">adposition</option>
            <option value="m">numeral</option>
            <option value="i">interjection</option>
            <option value="u">punctuation</option>
        </select>
        </div>

        <div id="nf-dynamic"></div>

        <div class="morph-actions">
        <button id="nf-reset" class="btn btn-reset" type="button">Reset</button>
        <button id="nf-cancel" class="btn btn-cancel" type="button">Cancel</button>
        <button id="nf-save"  class="btn btn-save"  type="button">Save</button>
        </div>
    `;
    toolBody.querySelector('.morph-container')?.appendChild(host);
    // Scroll the new editor into view so the click feels responsive
    requestAnimationFrame(() => {
    host.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
    });

    const nfLemma = host.querySelector('#nf-lemma');
    const nfPos   = host.querySelector('#nf-pos');

    // POS adjustments for Latin
    if (isLatin) {
    // Remove Article (l)
    nfPos.querySelector('option[value="l"]')?.remove();

    // Replace interjection (i) with exclamation (e)
    const intOpt = nfPos.querySelector('option[value="i"]');
    if (intOpt) {
        intOpt.textContent = 'exclamation';
        intOpt.value = 'e';            
    }
    }

    const nfDyn   = host.querySelector('#nf-dynamic');

    // Remove red outline when user fixes a field 
    host.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('input', () => el.closest('.field')?.classList.remove('invalid'));
    el.addEventListener('change', () => el.closest('.field')?.classList.remove('invalid'));
    });

    const initialLemma = (seedForm?.lemma || word._displayLemma || word._doc?.lemma || word.lemma || word.form || '').trim();

    function resetEditorToBlankCreate() {
    // lemma stays prefilled
    nfLemma.value = initialLemma;

    // POS goes back to blank (— choose —)
    nfPos.value = '';

    // remove all the dynamic selects
    nfDyn.innerHTML = '';

    // clear validation UI if you use it
    host.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
    }

    // Option maps
    const PERSON = [["",  "---"], ["1", "1st"], ["2", "2nd"], ["3", "3rd"]];
    const TENSE = isLatin
    ? { "": "---", p:"present", i:"imperfect", r:"perfect", l:"plusquamperfect", f:"future", t:"future perfect" }
    : { "": "---", p:"present", i:"imperfect", r:"perfect", l:"plusquamperfect", f:"future", t:"future perfect", a:"aorist" };
    // Greek: optative exists; Latin: no optative, add gerund/gerundive/supine
    const MOOD = isLatin
    ? { "": "---", i:"indicative", s:"subjunctive", n:"infinitive", m:"imperative", p:"participle", d:"gerund", g:"gerundive", u:"supine" }
    : { "": "---", i:"indicative", s:"subjunctive", o:"optative", n:"infinitive", m:"imperative", p:"participle" };

    // Greek: medio-passive (e); Latin: no medio-passive, add deponens (d)
    const VOICE = isLatin
    ? { "": "---", a:"active", p:"passive", d:"deponens" }
    : { "": "---", a:"active", e:"medio-passive", p:"passive" };

    // Latin: singular/plural only
    const NUMBER = isLatin
    ? { "": "---", s:"singular", p:"plural" }
    : { "": "---", s:"singular", p:"plural", d:"dual" };

    // Latin: no common gender
    const GENDER = isLatin
    ? { "": "---", m:"masculine", f:"feminine", n:"neuter" }
    : { "": "---", m:"masculine", f:"feminine", n:"neuter", c:"common" };

    // Latin: add ablative (b) + locative (l)
    const CASES = isLatin
    ? { "": "---", n:"nominative", g:"genitive", d:"dative", a:"accusative", b:"ablative", l:"locative", v:"vocative" }
    : { "": "---", n:"nominative", g:"genitive", d:"dative", a:"accusative", v:"vocative" };

    const DEGREE = { "": "---", p:"positive", c:"comparative", s:"superlative" };

    /**
     * Need to replace interjection with exclamtion while in latin (has no other fields)
     * No article pos in latin
     * Pronoun has no "Person" field
     * Verb defaults to Tense, Mood, and Voice
     * - If mood is indicative, fields are: Person, Number, Tense, Mood, and Voice
     * - If mood is subjunctive, fields are: Person, Number, Tense, Mood, and Voice
     * - If mood is infinitive, fields are: Tense Mood, and Voice
     * - If mood is imperative, fields are: Person, Number, Tense, Mood, and Voice
     * - If mood is gerund, fields are: Person, Number, Tense, Mood, Voice, and Casus
     * - If mood is gerundive, fields are Person, Number, Tense, Mood, Voice, Gender, and Casus
     * - If mood is participle, fields are: Number, Tense, Mood, Voice, Gender, Casus, and Degree
     * - If mood is supine, fields are: Person, Number, Tense, Mood, and Voice
     */

    const buildSelect = (id, map) => {
        const sel = document.createElement('select');
        sel.id = id;

        const entries = Array.isArray(map) ? map : Object.entries(map);

        entries.forEach(([v, l]) => {
            const o = document.createElement('option');
            o.value = v;
            o.textContent = l;
            sel.appendChild(o);
        });

        sel.className = 'cf-select';
        sel.style.width = '100%';
        sel.value = "";            // force default to '---' when present
        return sel;
    };

function createLabel(text){
    const l = document.createElement('label');
    l.textContent = text;
    return l;
}

function renderDynamicForPOS(pos) {
    nfDyn.innerHTML = '';
    if (pos === 'i' || pos === 'e' || pos === 'c' || pos === 'r' || pos === 'u') {
        nfDyn.innerHTML = '';
        return;
    }

    const add = (label, el) => {
        const wrap = document.createElement('div');
        wrap.className = 'field';
        const lab = document.createElement('label');
        lab.textContent = label;
        wrap.append(lab, el);
        nfDyn.appendChild(wrap);
        return wrap;
    };

    // ===================================================================
    //                         VERBS (Matches Arethusa)
    // ===================================================================
    if (pos === 'v') {
        const personSel = buildSelect('nf-person', PERSON);
        const numSel    = buildSelect('nf-num', NUMBER);
        const tenseSel  = buildSelect('nf-tense', TENSE);
        const moodSel   = buildSelect('nf-mood', MOOD);
        const voiceSel  = buildSelect('nf-voice', VOICE);

        const genderSel = buildSelect('nf-g', GENDER);
        const caseSel   = buildSelect('nf-case', CASES);
        const degSel    = buildSelect('nf-deg', DEGREE);

        // --- Create all wrappers ONCE
        const pWrap = add('Person', personSel);
        const nWrap = add('Number', numSel);
        const tWrap = add('Tense',  tenseSel);
        const mWrap = add('Mood',   moodSel);
        const vWrap = add('Voice',  voiceSel);

        const div = document.createElement('div');
        div.className = 'morph-divider';
        nfDyn.appendChild(div);

        const gWrap = add('Gender', genderSel);
        const cWrap = add('Casus',  caseSel);
        const dWrap = add('Degree', degSel);

        // Map wrapper names → elements so we can reorder / show / hide easily
        const WRAPPERS = { pWrap, nWrap, tWrap, mWrap, vWrap, gWrap, cWrap, dWrap, div };

        // Layout for each mood, in **postag order**
        // "" = '---' initial; treat like infinitive (no person/number)
        const VERB_LAYOUT = isLatin
        ? {
            "":  ["tWrap", "mWrap", "vWrap"],

            // indicative/subjunctive/imperative: Person, Number, Tense, Mood, Voice
            "i": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap"],
            "s": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap"],
            "m": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap"],

            // infinitive: Tense, Mood, Voice
            "n": ["tWrap", "mWrap", "vWrap"],

            // gerund: Person, Number, Tense, Mood, Voice, Casus
            "d": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap", "div", "cWrap"],

            // gerundive: Person, Number, Tense, Mood, Voice, Gender, Casus
            "g": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap", "div", "gWrap", "cWrap"],

            // participle: Number, Tense, Mood, Voice, Gender, Casus, Degree
            "p": ["nWrap", "tWrap", "mWrap", "vWrap", "div", "gWrap", "cWrap", "dWrap"],

            // supine: Person, Number, Tense, Mood, Voice
            "u": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap"]
            }
        : {
            "":  ["tWrap", "mWrap", "vWrap"],
            "i": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap"],
            "s": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap"],
            "o": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap"],
            "m": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap"],
            "n": ["tWrap", "mWrap", "vWrap"],
            "p": ["nWrap", "tWrap", "mWrap", "vWrap", "div", "gWrap", "cWrap", "dWrap"]
            };

        function applyVerbLayout() {
            const mood = moodSel.value || "";
            const order = VERB_LAYOUT[mood] || VERB_LAYOUT[""];

            // 1) Hide everything
            Object.values(WRAPPERS).forEach(el => {
            if (!el) return;
            el.style.display = 'none';
            });

            // 2) Show + reorder according to layout
            order.forEach(key => {
            const el = WRAPPERS[key];
            if (!el) return;

            // hr vs normal field
            if (key === "div") {
                el.style.display = 'block';
                nfDyn.appendChild(el);
            } else {
                el.style.display = 'flex';
                nfDyn.appendChild(el);
            }
            });
        }

        // Initial state: mood is '---' so you get Tense / Mood / Voice only
        applyVerbLayout();

        // Whenever mood changes, update the layout to match Arethusa
        moodSel.addEventListener('change', applyVerbLayout);

        return;
    }

    // ===================================================================
    //                       PRONOUN (p)
    // ===================================================================
    if (pos === 'p') {
    if (!isLatin) add('Person', buildSelect('nf-person', PERSON));
    add('Number', buildSelect('nf-num', NUMBER));
    add('Gender', buildSelect('nf-g',    GENDER));
    add('Casus',  buildSelect('nf-case', CASES));
    return;
    }

    // ===================================================================
    //                   ADJECTIVE (a)
    // ===================================================================
    if (pos === 'a') {
        add('Number', buildSelect('nf-num',   NUMBER));
        add('Gender', buildSelect('nf-g',     GENDER));
        add('Casus',  buildSelect('nf-case',  CASES));
        add('Degree', buildSelect('nf-deg',   DEGREE));
        return;
    }

    // ===================================================================
    //     Noun / Article / Numeral (n, l, m)
    // ===================================================================
    if (['n', 'l', 'm'].includes(pos)) {
        add('Number', buildSelect('nf-num', NUMBER));
        add('Gender', buildSelect('nf-g',   GENDER));
        add('Casus',  buildSelect('nf-case', CASES));
        return;
    }

    // ===================================================================
    //               Adverb (d)
    // ===================================================================
    if (pos === 'd') {
        add('Degree', buildSelect('nf-deg', DEGREE));
        return;
    }

    // Other POS have no dynamic fields
    nfDyn.innerHTML = '';
}


nfPos.addEventListener('change', e => renderDynamicForPOS(e.target.value));

    // --- Prefill from clicked form (clone) ---
    const setSelectIfExists = (selector, val) => {
    const el = nfDyn.querySelector(selector);
    if (!el) return;
    el.value = (val ?? '');
    };

    if (seedForm?.postag) {
        const parsed = parseMorphTag(seedForm.postag) || {};
        let posChar = seedForm.postag[0]?.toLowerCase() || '';

        if (isLatin && posChar === 'i') posChar = 'e';  
        if (!isLatin && posChar === 'e') posChar = 'i'; 

        if (posChar) {
            // 1) set POS
            nfPos.value = posChar;

            // 2) render correct dynamic fields
            renderDynamicForPOS(posChar);

            // 3) VERB special-case: set mood first so layout reveals correct fields
            if (posChar === 'v') {
                const moodSel = nfDyn.querySelector('#nf-mood');
                if (moodSel) {
                    moodSel.value = parsed.mood || '';
                    moodSel.dispatchEvent(new Event('change')); // triggers layout update
                }
            }

            // 4) fill the rest (only if the field exists for that POS/layout)
            setSelectIfExists('#nf-person', parsed.person);
            setSelectIfExists('#nf-num',    parsed.number);
            setSelectIfExists('#nf-tense',  parsed.tense);
            setSelectIfExists('#nf-mood',   parsed.mood);
            setSelectIfExists('#nf-voice',  parsed.voice);
            setSelectIfExists('#nf-g',      parsed.gender);
            setSelectIfExists('#nf-case',   parsed.case);
            setSelectIfExists('#nf-deg',    parsed.degree);
        }
    }

host.querySelector('#nf-reset').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetEditorToBlankCreate();
});


// Cancel button: close the inline form editor
host.querySelector('#nf-cancel').addEventListener('click', () => {
    host.remove();
});

host.querySelector('#nf-save').addEventListener('click', async () => {
  const lemmaVal = (nfLemma.value || '').trim();
  const posChar  = (nfPos.value || '').trim();

  // Clear old highlights
  nfDyn.querySelectorAll('.field').forEach(f => f.classList.remove('invalid'));
  nfLemma.closest('.field')?.classList.remove('invalid');
  nfPos.closest('.field')?.classList.remove('invalid');

  const markInvalid = (el) => el?.closest('.field')?.classList.add('invalid');

  // -------------------------
  // HARD REQUIRED: Lemma + POS
  // -------------------------
  if (!lemmaVal) {
    markInvalid(nfLemma);
    await showConfirmDialog(
      'Lemma cannot be blank.',
      { titleText: 'Missing required field', okText: 'OK', cancelText: 'OK' }
    );
    nfLemma.focus();
    return;
  }

  if (!posChar) {
    markInvalid(nfPos);
    await showConfirmDialog(
      'Part of Speech cannot be blank.',
      { titleText: 'Missing required field', okText: 'OK', cancelText: 'OK' }
    );
    nfPos.focus();
    return;
  }

    // -------------------------
    // OPTIONAL FIELDS (prompt-only)
    // Only warn about fields that are currently rendered for this POS/layout
    // -------------------------
    const isBlank = (v) => !v || String(v).trim() === '' || String(v).trim() === '---';

    const labelMap = {
    'nf-person': 'Person',
    'nf-tense':  'Tense',
    'nf-mood':   'Mood',
    'nf-voice':  'Voice',
    'nf-num':    'Number',
    'nf-g':      'Gender',
    'nf-case':   'Casus',
    'nf-deg':    'Degree'
    };

    // Start with empty defaults
    const fields = {
    person: '',
    tense: '',
    mood: '',
    voice: '',
    number: '',
    gender: '',
    case: '',
    degree: ''
    };

    const missing = [];
    const addMissing = (name, el) => {
    missing.push({ name, el });
    markInvalid(el);
    };

    // Look ONLY at inputs/selects currently inside nfDyn
    nfDyn.querySelectorAll('select, input').forEach(el => {
        const label = labelMap[el.id];
        if (!label) return;

        // only count fields that are currently visible
        const fieldWrap = el.closest('.field');
        if (!fieldWrap) return;

        // If wrapper is display:none (verb layout), skip it
        if (fieldWrap.style.display === 'none') return;

        // More robust: skip if hidden due to CSS/ancestor hiding
        if (fieldWrap.offsetParent === null) return;

        const val = el.value ?? '';

        if (el.id === 'nf-person') fields.person = val;
        if (el.id === 'nf-tense')  fields.tense  = val;
        if (el.id === 'nf-mood')   fields.mood   = val;
        if (el.id === 'nf-voice')  fields.voice  = val;
        if (el.id === 'nf-num')    fields.number = val;
        if (el.id === 'nf-g')      fields.gender = val;
        if (el.id === 'nf-case')   fields.case   = val;
        if (el.id === 'nf-deg')    fields.degree = val;

        if (isBlank(val)) addMissing(label, el);
    });

    // Prompt once if any optional fields are blank
    if (missing.length > 0) {
    const names = [...new Set(missing.map(m => m.name))];

    const ok = await showConfirmDialog(
        `You left these morph fields blank:\n\n${names.join(', ')}\n\nSave anyway?`,
        { titleText: 'Missing morph fields', okText: 'Save anyway', cancelText: 'Go back' }
    );

    if (!ok) {
        missing[0]?.el?.focus?.();
        return;
    }
}

  // -------------------------
  // SAVE (compose supports blanks using '-' slots)
  // -------------------------
  const postag = composeUserPostag(posChar, fields);

  word.forms.push({ lemma: lemmaVal, postag, source: 'you' });
  word.activeForm = word.forms.length - 1;

  triggerAutoSave();

  applyActiveSelectionToWord(word);
  renderUserFormsList(word, toolBody);
  host.remove();

  if (typeof window.fastRefreshTree === 'function') window.fastRefreshTree();

  triggerAutoSave();

  const docEntry = toolBody.querySelector('.morph-entry[data-index="-1"]');
  const topCheckbox = docEntry?.querySelector('input[type="checkbox"]');
  if (topCheckbox) topCheckbox.checked = false;

  if (typeof window.renderMorphInfo === 'function') window.renderMorphInfo(word);
  if (typeof window.updateXMLIfActive === 'function') window.updateXMLIfActive();
});
}