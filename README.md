# Arethusa Lite

A browser-based dependency treebanking editor for ancient and modern languages. Arethusa Lite is a lightweight reimplementation of the [Alpheios/Arethusa](https://github.com/alpheios-project/arethusa) treebanking toolchain, designed to run as a static web application with no server-side infrastructure required.

Built at the University of Nebraska–Lincoln Classics department, it supports annotating texts in the Ancient Language Dependency Treebank (ALDT) format and several other annotation schemes.

---

## Features

- **Dependency tree editor** — visualize and edit syntactic dependency trees using an interactive D3.js SVG canvas
- **Morphology annotation** — assign part-of-speech and morphological attributes (case, number, gender, tense, etc.) per word, with optional lookup via the Morpheus API
- **Relation labeling** — assign dependency relation labels (SBJ, OBJ, ATR, ADV, etc.) by clicking head and dependent words
- **Selector tool** — search for tokens by form, lemma, POS, or relation across the full document
- **Multiple input paths** — paste raw text or upload an existing ALDT XML file
- **Multiple language support** — Greek, Latin, English, Persian, Arabic, and more
- **Multiple tagsets** — ALDT, Universal Dependencies, Harrington, Smyth Grammar, Wheelock, and others; easily extensible
- **Undo / redo** — full undo and redo history for all structural edits
- **Autosave** — every edit is automatically serialized back to XML and persisted in `localStorage`
- **XML tool** — view and hand-edit the raw ALDT XML for any sentence in app, with schema validation via WebAssembly (xmllint)
- **Table view** — switch between tree visualization and a data table
- **Tree comparison** — load two treebank files side-by-side and diff them visually as well as through a data table with empircal difference tracking

---

## Getting Started

### Prerequisites

- A modern browser with ES Module support (Chrome or Edge recommended, Firefox and Safari have known issues with downloading XML smoothly)
- A local file storage system

### Installation

```bash
git clone https://github.com/unl-classics/alpheios-retooling.git
cd unl-classics-alpheios-retooling
npm install
```

`npm install` only fetches development dependencies (Jest) and the `xmllint-wasm` runtime dependency. There is no build step.

### Running the App

Open the app from GitPages
`https://cseseniordesign.github.io/unl-classics-alpheios-retooling/`

## OR

Start a local server from the repository root and open `index.html`:

```bash
npx serve .
# then open http://localhost:3000 in your browser
```

Or with Python:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

---

## Usage

### 1. Input Page (`index.html`)

Choose how to load your text:

| Option | How |
|---|---|
| **Paste text** | Type or paste into the textarea and click **Edit** |
| **Upload XML** | Upload an existing ALDT treebank `.xml` file |

Select the language and text direction, then click **Edit** to open the editor.

**Advanced Options** (click to expand) let you choose an annotation tagset, set a custom tokenization service URL, and configure tokenization parameters (enclitic splitting/shifting). You can also compare two treebanks from this panel.

### 2. Editor Page (`treebanking.html`)

The main workspace has three areas:

- **Header** — navigation controls (first/prev/next/last sentence, sentence selector), and action buttons (save, undo, redo, questions, tree compare, exit)
- **Sentence strip** — the words of the current sentence as clickable tokens
- **Tool panel** (left sidebar) — tabbed tools: Treebank (Default Mode), Morph, Relation, aT (Artifical Token), Selector, Sentence, XML

**Editing morphology:**
1. Click the **morph** tab
2. Click a word token — the morphology panel populates (fetching from Morpheus if supported for the language)
3. Adjust POS and attribute dropdowns as needed and confirm
- *Clicking the cog icon*
    - Preselect: Assigns every word a morphology based on the configured morphology service's first choice
    - Alternate Morph: Allows input of alternate morpology microservices

**Editing a dependency arc:**
1. Click the **relation** tab to activate the relation tool
2. Click the intended **child** word (highlighted)
3. Select the label; the arc and label update immediately above the word
- *Clicking the cog icon*
    - Advanced Mode: When multiple words are selected, the option to assign all selected words the same relation appears

**Adding an Artifical Token (aT)**
1. Click the **aT** tab to activate the artifical token tool
2. Input the word to be added to the tree
3. Select the *Insertion Point* of the artifical token
4. Click **Add token**

**Selecting batches of words**
1. Click the **selector** tab
2. Input the *token*, *form*, or *label* to search by
3. Click on the words that match the input to deselect them

**Merging and splitting sentences**
1. Click the **sentence** tab
2. If merging, select the sentence to append to the current sentence
3. If splitting, select a word from the sentence to be the last word before the split
4. Click either *Merge sentences* or *Split sentences* depending on step 2 or 3

**Editing XML**
1. Click the **xml** tab
2. Click *Edit XML*
3. Make changes to the XML
4. Click *Confirm*

**Navigating across sentences**
- Double backwards arrow will move to first sentence
- Single backwards arrow will move one sentence backward
- Dropdown will display all sentences in the given XML file as well as a begging of its contents
- Single forwards arrow will move one sentence forward
- Double forwards arrow will move the the last sentence

**Saving your work:**
- Edits autosave to `localStorage` continuously
- Click the **save (floppy disk)** button to download the current treebank as an `.xml` file

**Undoing**
- When clicked will undo structural changes in order of which they were made
- *Does not affect any other changes made*

**Redoing**
- When clicked will redo structural changes in order of which they were undone
- *Does not affect any other changes made*

**Questions**
- Displays a page with information regarding the application
    - Navigation, Editing, View Options, etc.

**Exiting Tree Editor**
- Prompts to ensure exit
- *ENSURE ALL WORK IS SAVED THAT WOULD LIKE TO BE KEPT BEFORE EXITING*

***-=Hot Keys=-***
| Key | Action |
|---|---|
| `Esc` | Deselect all currently selected word tokens |
| `W` | Move the active selection one word forward in the sentence |
| `E` | Move the active selection one word backward in the sentence |
| `Right-click` (tree node) | Opens a quick-edit menu to reassign the word's dependency relation without switching to the Relation tab |

### 3. Tree Comparison (`gs.html`)

Upload two ALDT XML files as Tree A and Tree B (Under advanced options on the input page). Differences in head assignments or relation labels are highlighted. Navigation buttons for each tree can be operated independently.

**Navigating across sentences**
- Double backwards arrow will move to first sentence
- Single backwards arrow will move one sentence backward
- Dropdown will display all sentences in the given XML file as well as a begging of its contents
- Single forwards arrow will move one sentence forward
- Double forwards arrow will move the the last sentence

**Viewing trees to compare**
- Tree on left acts as the tree to compare against
- All variations will appear on the right tree to display inconsistencies 
- Tree can be independently operated and viewed

**Comparison data table**
- Click on the **table** button *or* scroll down from the trees
    - Empircal data about the differences between the two tress is displayed in the table
    - All sentence numbers are listed underneath the table, colored green if perfectly correct, and red if any inconsistancy
        - When clicked, the trees will open to the sentence number that was clicked

---

## Project Structure

```
/
├── index.html              Input / landing page
├── treebanking.html        Main editor page
├── gs.html                 Tree comparison page
├── questions.html          In-app help modal content
├── main.js                 Editor bootstrap and top-level event wiring
├── treebanking.css
├── inputPage.css
├── package.json
├── jest.config.js
└── app/
    └── treebanking/
        ├── aT/             Arethusa Transform utility
        ├── configs/        Source Arethusa JSON configs (relations, morph attributes)
        ├── dist/           Compiled tagset JSON files consumed at runtime
        ├── gs/             Tree comparison modules
        ├── input/          Input page logic (language settings, tokenizer, compare)
        ├── libs/           Vendored libraries (xmllint-wasm WebAssembly bundle)
        ├── morph/          Morphology tool (editor UI, Morpheus API, lexicon)
        ├── relation/       Dependency relation tool
        ├── schemas/        ALDT XML schema files for validation
        ├── table/          Table view renderer
        ├── tags/           Tagset registry, config loader, store, selector UI
        ├── tests/          Jest unit tests
        ├── tree/           D3.js tree renderer and tree manipulation utilities
        ├── ui/             Navigation, sentence display, hotkeys, modals
        └── xml/            XML parsing, loading, saving, undo, tokenizer, selector
```

---

## Tagsets

The editor ships with support for the following annotation formats:

| ID | Label | Language | Status |
|---|---|---|---|
| `aldt-lat` | Ancient Language Dependency Treebank (Latin) | Latin | Stable |
| `aldt-grc` | Ancient Language Dependency Treebank (Greek) | Greek | Stable |
| `sg` | Smyth Grammar labels | Greek | Stable |
| `JMH` | JMH Ancient Greek | Greek | Stable |
| `ud` | Universal Dependencies | Multiple | Stable |
| `pedalion` | Pedalion Ancient Greek | Greek | Stable |
| `persian` | Persian morphology | Persian | Beta |
| `lyon-lat` | Lyon Latin | Latin | Beta |
| `lyon-grc` | Lyon Greek | Greek | Beta |

To add a custom tagset, create the relation and morphology config JSONs under `configs/`, compile a dist JSON, and register it in `app/treebanking/tags/tagsetRegistry.js`.

---

## External Services

The app uses the following external services, all of which are optional and can be overridden with custom URLs in Advanced Options:

| Service | Purpose | Default |
|---|---|---|
| LLT Segtok | Tokenizes raw input text into treebank XML | `https://services.perseids.org/llt/segtok` |
| Morpheus | Morphological analysis for Greek and Latin | Perseids Morpheus REST endpoint |
| Perseids CTS | Canonical text retrieval | `https://cts.perseids.org/` |

---

## Dependencies

| Package | Role |
|---|---|
| [D3.js v7](https://d3js.org/) | SVG tree layout and rendering (loaded via CDN) |
| [simple-keyboard](https://virtual-keyboard.js.org/) | Virtual keyboard for all available scripts (loaded via CDN) |
| [xmllint-wasm](https://github.com/nicowillis/xmllint-wasm) | WebAssembly build of libxml2 for in-browser XML schema validation |
| [Jest](https://jestjs.io/) | Unit testing (dev dependency) |

---

## Acknowledgments

This project builds on the work of the [Alpheios Project](https://alpheios.net/) and the [Perseus Digital Library](http://www.perseus.tufts.edu/). Treebank data formats follow conventions established by the [Ancient Greek and Latin Dependency Treebank](https://perseusdl.github.io/treebank_data/) project. Sponsored by the [UNL Classics and Religious Studied Department](https://classics.unl.edu/)
