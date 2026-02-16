function getModalElements() {
  const overlay = document.getElementById("app-modal-overlay");
  const msg     = document.getElementById("app-modal-message");
  const ok      = document.getElementById("app-modal-ok");
  const cancel  = document.getElementById("app-modal-cancel");
  const title   = document.getElementById("app-modal-title");

  if (!overlay || !msg || !ok || !cancel || !title) {
    return null;
  }
  return { overlay, msg, ok, cancel, title };
}

/**
 * Show a nice asynchronous confirm dialog.
 *
 * Usage:
 *   const ok = await showConfirmDialog("Text...", { titleText: "Title" });
 *   if (!ok) return;
 */
export function showConfirmDialog(message, options = {}) {
  const els = getModalElements();

  // Fallback to native confirm if HTML somehow missing (safety net)
  if (!els) {
    const result = window.confirm(message);
    return Promise.resolve(result);
  }

  const { overlay, msg, ok, cancel, title } = els;
  const {
    titleText  = "Please confirm",
    okText     = "OK",
    cancelText = "Cancel"
  } = options;

  return new Promise((resolve) => {
    msg.textContent    = message;
    title.textContent  = titleText;
    ok.textContent     = okText;
    cancel.textContent = cancelText;

    overlay.hidden = false;

    const cleanup = (result) => {
      overlay.hidden = true;
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };

    const onOk = (e) => {
      e.stopPropagation();
      cleanup(true);
    };

    const onCancel = (e) => {
      e.stopPropagation();
      cleanup(false);
    };

    const onBackdrop = (e) => {
      if (e.target === overlay) {
        cleanup(false);
      }
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        return; // Let modal handle this (can change behavior later if desired)
      } else if (e.key === "Enter") {
        cleanup(true);
      }
    };

    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey, { capture: true });

    // Default focus on OK for quick keyboard flow
    ok.focus();
  });
}

export function showPromptDialog(message, options = {}) {
  const els = getModalElements();

  // Fallback: native prompt
  if (!els) {
    const def = options.defaultValue ?? "";
    const result = window.prompt(message, def);
    return Promise.resolve(result); // string | null
  }

  const { overlay, msg, ok, cancel, title } = els;
  const {
    titleText     = "Save as",
    okText        = "Save",
    cancelText    = "Cancel",
    defaultValue  = "",
    placeholder   = "treebank.xml"
  } = options;

  return new Promise((resolve) => {
    // Build an input 
    let input = overlay.querySelector("#app-modal-input");
    if (!input) {
      input = document.createElement("input");
      input.id = "app-modal-input";
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;

      // simple inline styling 
      input.style.width = "100%";
      input.style.boxSizing = "border-box";
      input.style.marginTop = "10px";
      input.style.padding = "10px";
      input.style.border = "1px solid #ccc";
      input.style.borderRadius = "8px";
      input.style.fontSize = "14px";

      msg.insertAdjacentElement("afterend", input);
    }

    msg.textContent    = message;
    title.textContent  = titleText;
    ok.textContent     = okText;
    cancel.textContent = cancelText;

    input.value = defaultValue;
    input.placeholder = placeholder;

    overlay.hidden = false;

    const cleanup = (result) => {
      overlay.hidden = true;
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };

    const onOk = (e) => {
      e.stopPropagation();
      cleanup(input.value);
    };

    const onCancel = (e) => {
      e.stopPropagation();
      cleanup(null);
    };

    const onBackdrop = (e) => {
      if (e.target === overlay) cleanup(null);
    };

    const onKey = (e) => {
      if (e.key === "Enter") cleanup(input.value);
      if (e.key === "Escape") cleanup(null);
    };

    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey, { capture: true });

    // Focus + select for quick rename
    input.focus();
    input.select();
  });
}