/**
 * tagsetRegistry.js
 * -----------------
 * Maps each user-facing tagset name to:
 *   - distFile : path to the compiled arethusa-configs dist JSON
 *   - format   : the treebank/@format value this config expects
 *   - lang     : primary language ('grc', 'lat', 'eng', 'per', etc.)
 *   - hasMorph : whether this config includes morphology annotation
 *
 * Paths are relative to the repo root (where index.html lives).
 * Adjust the distFile paths if your dist folder is nested differently.
 */

export const TAGSET_REGISTRY = [
  {
    id: 'aldt-lat',
    label: 'Ancient Language Dependency Treebank (Latin)',
    distFile: '../dist/aldt-misc.json',
    format: 'aldt',
    lang: 'lat',
    hasMorph: true,
  },
  {
    id: 'aldt-grc',
    label: 'Ancient Language Dependency Treebank (Greek)',
    distFile: '../dist/aldt-misc-grc.json',
    format: 'aldt',
    lang: 'grc',
    hasMorph: true,
  },
  {
    id: 'smyth',
    label: 'Smyth Grammar Tag Set',
    distFile: '../dist/smyth3.json',
    format: 'smyth',
    lang: 'grc',
    hasMorph: true,
  },
  // {
  //   id: 'jmh_lat',
  //   label: 'JMH Latin Tagset',
  //   distFile: '../dist/jmh_lat.json',
  //   format: 'jmh_lat',
  //   lang: 'lat',
  //   hasMorph: true,
  // },
  {
    id: 'jmh_grc',
    label: 'JMH Greek Tagset',
    distFile: '../dist/jmhgreek.json',
    format: 'jmh_grc',
    lang: 'grc',
    hasMorph: true,
  },
  // {
  //   id: 'aldt_lat_no_morph',
  //   label: 'ALDT Latin (Without Morphology)',
  //   distFile: '../dist/aldt_lat_no_morph.json',
  //   format: 'aldt',
  //   lang: 'lat',
  //   hasMorph: false,
  // },
  // {
  //   id: 'aldt_grc_no_morph',
  //   label: 'ALDT Greek (Without Morphology)',
  //   distFile: '/app/treebanking/dist/aldt_grc_no_morph.json',
  //   format: 'aldt',
  //   lang: 'grc',
  //   hasMorph: false,
  // },
  {
    id: 'ud_english',
    label: 'UD English',
    distFile: '/app/treebanking/dist/ud.json',
    format: 'conllu',
    lang: 'eng',
    hasMorph: true,
  },
  {
    id: 'persian',
    label: 'Persian (Beta)',
    distFile: '/app/treebanking/dist/persian.json',
    format: 'persian',
    lang: 'per',
    hasMorph: true,
    beta: true,
  },
  {
    id: 'lyon_lat',
    label: 'Lyon Latin (Beta)',
    distFile: '/app/treebanking/dist/lyonLatin.json',
    format: 'lyon_lat',
    lang: 'lat',
    hasMorph: true,
    beta: true,
  },
  {
    id: 'lyon_grc',
    label: 'Lyon Grec (Beta)',
    distFile: '/app/treebanking/dist/lyonGrec.json',
    format: 'lyon_grc',
    lang: 'grc',
    hasMorph: true,
    beta: true,
  },
  {
    id: 'pedalion',
    label: 'Pedalion',
    distFile: '/app/treebanking/dist/pedalion.json',
    format: 'pedalion',
    lang: 'grc',
    hasMorph: true,
  },
];

/** Look up a registry entry by id */
export function getRegistryEntry(id) {
  return TAGSET_REGISTRY.find(t => t.id === id) || null;
}
