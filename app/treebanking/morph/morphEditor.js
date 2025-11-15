import { ensureFormsArray, composeUserPostag } from './morphHelpers.js';
import { applyActiveSelectionToWord, renderUserFormsList } from './morphTool.js';
import { triggerAutoSave } from '../xml/saveXML.js';

// Inline editor that appears under the button and closes on save
export function renderCreateEditorBelow(word, toolBody) {
ensureFormsArray(word);

// Only one editor at a time
toolBody.querySelector('.morph-editor-inline')?.remove();

const host = document.createElement('div');
host.className = 'morph-editor-inline';
host.style.marginTop = '12px';
host.innerHTML = `
    <div class="field">
    <label>Lemma</label>
    <input id="nf-lemma" type="text" value="${(word.lemma || '').trim()}" />
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

const nfLemma = host.querySelector('#nf-lemma');
const nfPos   = host.querySelector('#nf-pos');
const nfDyn   = host.querySelector('#nf-dynamic');

// Option maps
const PERSON = [["",  "---"], ["1", "1st"], ["2", "2nd"], ["3", "3rd"]];
const TENSE  = { "": "---", p:"present", i:"imperfect", r:"perfect", l:"plusquamperfect", f:"future", a:"aorist" };
const MOOD   = { "": "---", i:"indicative", s:"subjunctive", o:"optative", n:"infinitive", m:"imperative", p:"participle" };
const VOICE  = { "": "---", a:"active", e:"medio-passive", p:"passive" };
const NUMBER = { "": "---", s:"singular", p:"plural", d:"dual" };
const GENDER = { "": "---", m:"masculine", f:"feminine", n:"neuter", c:"common" };
const CASES  = { "": "---", n:"nominative", g:"genitive", d:"dative", a:"accusative", v:"vocative" };
const DEGREE = { "": "---", p:"positive", c:"comparative", s:"superlative" };

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

        // --- Create all wrappers ONCE (order here doesn't matter, we’ll reorder later)
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
        const VERB_LAYOUT = {
            "":  ["tWrap", "mWrap", "vWrap"],                      // default (---)
            "i": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap"],    // indicative
            "s": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap"],    // subjunctive
            "o": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap"],    // optative
            "m": ["pWrap", "nWrap", "tWrap", "mWrap", "vWrap"],    // imperative
            "n": ["tWrap", "mWrap", "vWrap"],                      // infinitive
            "p": ["nWrap", "tWrap", "mWrap", "vWrap",                       // participle
                 "gWrap", "cWrap", "dWrap"]
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
        add('Person', buildSelect('nf-person', PERSON));
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

host.querySelector('#nf-reset').addEventListener('click', () => {
    nfLemma.value = (word.lemma || '').trim();
    nfPos.value = '';
    nfDyn.innerHTML = '';
});

// Cancel button: close the inline form editor
host.querySelector('#nf-cancel').addEventListener('click', () => {
    host.remove();
});

host.querySelector('#nf-save').addEventListener('click', () => {
    // Guardrail: POS is required
    if (!nfPos.value) {
    alert('Please choose a Part of Speech.');
    return;
    }

    const posChar = nfPos.value;

    // Collect dynamic fields if present
    const fields = {
        person: nfDyn.querySelector('#nf-person')?.value || '',
        tense:  nfDyn.querySelector('#nf-tense')?.value || '',
        mood:   nfDyn.querySelector('#nf-mood')?.value  || '',
        voice:  nfDyn.querySelector('#nf-voice')?.value || '',
        number: nfDyn.querySelector('#nf-num')?.value   || '',
        gender: nfDyn.querySelector('#nf-g')?.value     || '',
        case:   nfDyn.querySelector('#nf-case')?.value  || '',
        degree: nfDyn.querySelector('#nf-deg')?.value   || ''
    };

    // --- Require all visible fields to be filled in ---
    const missingFields = [];

    // Clear old highlights first
    nfDyn.querySelectorAll('.field').forEach(f => f.classList.remove('invalid'));
    nfLemma.closest('.field')?.classList.remove('invalid');

    const markInvalid = (el) => el?.closest('.field')?.classList.add('invalid');

    // Lemma required
    if (!nfLemma.value.trim()) {
    missingFields.push('Lemma');
    markInvalid(nfLemma);
    }

    if (posChar === 'v') {
        const mood = fields.mood;

        const personEl = nfDyn.querySelector('#nf-person');
        const numEl    = nfDyn.querySelector('#nf-num');
        const tenseEl  = nfDyn.querySelector('#nf-tense');
        const voiceEl  = nfDyn.querySelector('#nf-voice');
        const genderEl = nfDyn.querySelector('#nf-g');
        const caseEl   = nfDyn.querySelector('#nf-case');

        const finite = ['i','s','o','m'];   // indicative, subjunctive, optative, imperative
        const isInf  = (mood === 'n');      // infinitive
        const isPart = (mood === 'p');      // participle

        // ------------------------
        // FINITE VERBS (normal)
        // ------------------------
        if (finite.includes(mood)) {
            if (!fields.person) { missingFields.push('Person'); markInvalid(personEl); }
            if (!fields.number) { missingFields.push('Number'); markInvalid(numEl); }
            if (!fields.tense)  { missingFields.push('Tense');  markInvalid(tenseEl); }
            if (!fields.voice)  { missingFields.push('Voice');  markInvalid(voiceEl); }
        }

        // ------------------------
        // INFINITIVE
        // ------------------------
        if (isInf) {
            if (!fields.tense) { missingFields.push('Tense'); markInvalid(tenseEl); }
            if (!fields.voice) { missingFields.push('Voice'); markInvalid(voiceEl); }

        }

        // ------------------------
        // PARTICIPLE
        // ------------------------
        if (isPart) {
            if (!fields.number) { missingFields.push('Number'); markInvalid(numEl); }
            if (!fields.gender) { missingFields.push('Gender'); markInvalid(genderEl); }
            if (!fields.case)   { missingFields.push('Case');   markInvalid(caseEl); }
            if (!fields.tense)  { missingFields.push('Tense');  markInvalid(tenseEl); }
            if (!fields.voice)  { missingFields.push('Voice');  markInvalid(voiceEl); }
        }
    }


    // For nouns, pronouns, articles
    if (['n', 'm', 'l'].includes(posChar)) {
        const numEl = nfDyn.querySelector('#nf-num');
        const gEl   = nfDyn.querySelector('#nf-g');
        const cEl   = nfDyn.querySelector('#nf-case');

        if (!fields.number) { missingFields.push('Number'); markInvalid(numEl); }
        if (!fields.gender) { missingFields.push('Gender'); markInvalid(gEl); }
        if (!fields.case)   { missingFields.push('Case');   markInvalid(cEl); }
    }

    // For pronouns: person, number, gender, case required
    if (posChar === 'p') {
        const personEl = nfDyn.querySelector('#nf-person');
        const numEl    = nfDyn.querySelector('#nf-num');
        const gEl      = nfDyn.querySelector('#nf-g');
        const cEl      = nfDyn.querySelector('#nf-case');

        if (!fields.person) { missingFields.push('Person'); markInvalid(personEl); }
        if (!fields.number) { missingFields.push('Number'); markInvalid(numEl); }
        if (!fields.gender) { missingFields.push('Gender'); markInvalid(gEl); }
        if (!fields.case)   { missingFields.push('Case');   markInvalid(cEl); }
    }

    // For adjectives
    if (posChar === 'a') {
        const numEl = nfDyn.querySelector('#nf-num');
        const gEl   = nfDyn.querySelector('#nf-g');
        const cEl   = nfDyn.querySelector('#nf-case');
        const dEl   = nfDyn.querySelector('#nf-deg');

        if (!fields.number) { missingFields.push('Number'); markInvalid(numEl); }
        if (!fields.gender) { missingFields.push('Gender'); markInvalid(gEl); }
        if (!fields.case)   { missingFields.push('Case');   markInvalid(cEl); }
        if (!fields.degree) { missingFields.push('Degree'); markInvalid(dEl); }
    }

    if (missingFields.length > 0) {
    alert(`Please fill in all required fields:\n${missingFields.join(', ')}`);
    return;
    }

    // Remove red outline when user fixes a field
    host.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('input', () => el.closest('.field')?.classList.remove('invalid'));
    el.addEventListener('change', () => el.closest('.field')?.classList.remove('invalid'));
    });

    // Compose a compact tag using your helper already in this file
    const postag = composeUserPostag(posChar, fields);
    const normalizedLemma = (nfLemma.value || '').trim() || word.form;

    // Save the new form and activate it
    word.forms.push({ lemma: normalizedLemma, postag, source: 'you' });
    word.activeForm = word.forms.length - 1;
    triggerAutoSave(); // autosave after creating new form


    // Apply to the token/tree and refresh list, then close editor
    applyActiveSelectionToWord(word);
    renderUserFormsList(word, toolBody);
    host.remove();

    // Redraw (update colors + labels instantly)
    if (typeof window.fastRefreshTree === 'function') {
        window.fastRefreshTree();
    }

    triggerAutoSave(); // autosave after creating new form

    // Ensure the top (document) checkbox is unticked when user form is active
    const topCheckbox = toolBody.querySelector('.morph-entry > input[type="checkbox"]');
    if (topCheckbox) topCheckbox.checked = false;

    // Re-render header card so colors/tags mirror the active form
    if (typeof window.renderMorphInfo === 'function') {
        window.renderMorphInfo(word);
    }

    // Refresh XML tab if open
    if (typeof window.updateXMLIfActive === 'function') {
        window.updateXMLIfActive();
    }
});
}