import { showToast } from '/main.js';
import parseTreeBankXML from '../xml/parser.js';
import { validateXML } from '../libs/xmllint/index-browser.mjs';
import { compareTreebanks } from '../gs/compareEngine.js';  

// ─── Schema / language helpers (mirrors xmlLoader.js) ───────────────────────

async function fetchSchema() {
  return fetch('/app/treebanking/schemas/treebank-1.7.xsd').then(r => r.text());
}

async function isRealISOLanguage(code) {
  try {
    const response = await fetch('/assets/languages.json');
    const languageCodes = await response.json();
    return languageCodes.some(l => l.Id.toLowerCase() === code.toLowerCase());
  } catch (err) {
    console.error('Could not load language database:', err);
    return false;
  }
}

async function validateLanguage(xmlDoc) {
  const root = xmlDoc.documentElement;
  const lang = root.getAttribute('xml:lang') || root.getAttribute('lang');
  if (!lang) {
    return { ok: false, msg: "Missing 'xml:lang' attribute in <treebank>." };
  }
  const valid = await isRealISOLanguage(lang.toLowerCase());
  if (!valid) {
    return { ok: false, msg: `Unsupported language code '${lang}'. Use a valid code e.g. 'grc', 'lat'.` };
  }
  return { ok: true, lang };
}

async function validateXMLContent(xmlContent, schema) {
  const result = await validateXML({ xml: xmlContent, schema });
  if (result.errors && result.errors.length > 0) {
    console.error('Validation errors:', result.errors);
    return false;
  }
  return true;
}

// ─── Read a File object as UTF-8 text ───────────────────────────────────────

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file, 'UTF-8');
  });
}

// ─── Main compare handler ────────────────────────────────────────────────────

async function handleCompare() {
  const inputA = document.getElementById('compare-file-a');
  const inputB = document.getElementById('compare-file-b');

  const fileA = inputA?.files[0];
  const fileB = inputB?.files[0];

  if (!fileA || !fileB) {
    showToast('Please select both Tree A and Tree B XML files.');
    return;
  }

  if (!fileA.name.toLowerCase().endsWith('.xml')) {
    showToast('Tree A: Please upload an XML file.');
    return;
  }
  if (!fileB.name.toLowerCase().endsWith('.xml')) {
    showToast('Tree B: Please upload an XML file.');
    return;
  }

  const btn = document.getElementById('compareBtn');
  btn.disabled = true;
  btn.textContent = 'Validating…';

  try {
    const [xmlA, xmlB] = await Promise.all([
      readFileAsText(fileA),
      readFileAsText(fileB),
    ]);

    const parser = new DOMParser();
    const docA = parser.parseFromString(xmlA, 'text/xml');
    const docB = parser.parseFromString(xmlB, 'text/xml');

    // Language validation
    const langResultA = await validateLanguage(docA);
    if (!langResultA.ok) {
      showToast(`Tree A – ${langResultA.msg}`);
      return;
    }
    const langResultB = await validateLanguage(docB);
    if (!langResultB.ok) {
      showToast(`Tree B – ${langResultB.msg}`);
      return;
    }

    // Schema validation (fetch schema once)
    const schema = await fetchSchema();
    const [validA, validB] = await Promise.all([
      validateXMLContent(xmlA, schema),
      validateXMLContent(xmlB, schema),
    ]);

    if (!validA) { showToast('Tree A is not a valid treebank XML file.'); return; }
    if (!validB) { showToast('Tree B is not a valid treebank XML file.'); return; }

    // Parse and store both treebanks
    const dataA = parseTreeBankXML(xmlA);
    const dataB = parseTreeBankXML(xmlB);
    const comparison = compareTreebanks(dataA, dataB);

    console.log('=== GOLD STANDARD COMPARISON ===');
    console.log('Full comparison object:', comparison);
    console.log('Report:', comparison.report);
    console.log('Details:', comparison.details);
    console.table({
      sentences: comparison.report.sentences,
      words: comparison.report.words,
      heads: comparison.report.heads,
      relations: comparison.report.relations,
      lemmata: comparison.report.lemmata,
      postags: {
        total: comparison.report.postags.total,
        right: comparison.report.postags.right,
        wrong: comparison.report.postags.wrong,
        almost: comparison.report.postags.almost,
        unique: comparison.report.postags.unique
      }
    });
    console.log('Postag datapoints:', comparison.report.postags.datapoints);

    // Clear any previous single-tree session data to avoid pollution
    localStorage.removeItem('xmlContent');
    localStorage.removeItem('treebankData');

    // Store compare data
    localStorage.setItem('compareXmlA', xmlA);
    localStorage.setItem('compareXmlB', xmlB);
    localStorage.setItem('compareDataA', JSON.stringify(dataA));
    localStorage.setItem('compareDataB', JSON.stringify(dataB));
    localStorage.setItem('compareReport', JSON.stringify(comparison.report));
    localStorage.setItem('compareDetails', JSON.stringify(comparison.details));
    localStorage.setItem('compareLabelA', fileA.name);
    localStorage.setItem('compareLabelB', fileB.name);

    window.location.href = './gs.html';

  } catch (err) {
    console.error('Compare error:', err);
    showToast('An error occurred while loading the files.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Compare';
    inputA.value = '';
    inputB.value = '';
  }
}

// ─── Wire up button ──────────────────────────────────────────────────────────

document.getElementById('compareBtn')?.addEventListener('click', handleCompare);
