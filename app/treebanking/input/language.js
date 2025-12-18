const STORAGE_KEY = "textLanguage";
const DEFAULT_LANG = "grc";

// Current languages that are supported
const MORPHEUS_SUPPORTED = new Set(["grc", "lat"]);

export function normalizeLang(raw) {
    const s = (raw ?? "").toString().trim().toLowerCase();
    if (!s || s === "null" || s === "undefined") return DEFAULT_LANG;

    // Accept both codes and human labels.
    const map = {
        greek: "grc",
        grc: "grc",

        latin: "lat",
        lat: "lat",

        english: "eng",
        eng: "eng",

        persian: "fas",
        farsi: "fas",
        fas: "fas",

        arabic: "ara",
        ara: "ara",
    };

    return map[s] || (s || DEFAULT_LANG);
}

export function setLanguage(rawLang, { persist = true } = {}) {
    const lang = normalizeLang(rawLang);

    // Backward compatibility for existing code paths
    window.treebankLang = lang;
    window.treeLanguage = lang;

    if (persist) localStorage.setItem(STORAGE_KEY, lang);

    window.dispatchEvent(new CustomEvent("arethusa:languagechange", { detail: { lang } }));

    return lang;
}

export function getLanguage() {
    // Prefer runtime overrides, else stored choice, else default
    const lang =
        window.treebankLang ||
        window.treeLanguage ||
        localStorage.getItem(STORAGE_KEY) ||
        DEFAULT_LANG;

    return setLanguage(lang, { persist: false });
}

export function isMorpheusSupported(lang = getLanguage()) {
    return MORPHEUS_SUPPORTED.has(normalizeLang(lang));
}