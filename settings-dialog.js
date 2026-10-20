// The dialog of the settings of rudof (settings.js): a field for each
// setting, by sections, the settings in TOML, and the configuration that
// rudof gets. Saving checks the settings first (check), and gives them to the
// page (onSave).

import { SETTINGS, ALL_SETTINGS, emptySettings, settingValue, changedCount } from "./settings.js";

function el(doc, tag, props = {}, ...children) {
  const e = Object.assign(doc.createElement(tag), props);
  e.append(...children);
  return e;
}

const fieldId = (key) => `setting-${key.replace(/\./g, "-")}`;

// The field of a setting
function field(doc, setting) {
  const id = fieldId(setting.key);
  let input;
  if (setting.type === "boolean") {
    input = el(doc, "input", { type: "checkbox", id });
    const label = el(doc, "label", { className: "setting setting-boolean", htmlFor: id }, input, el(doc, "span", {}, setting.label));
    if (setting.help) label.append(el(doc, "small", { className: "hint" }, setting.help));
    return label;
  }
  if (setting.type === "select") {
    input = el(doc, "select", { id }, ...setting.options.map(([value, text]) => new Option(text, value)));
  } else {
    input = el(doc, "input", { id, type: "text", spellcheck: false, autocomplete: "off" });
    if (setting.type === "number") input.inputMode = "numeric";
    if (setting.type === "char") input.maxLength = 2;
    if (setting.type === "iri") input.placeholder = "http://example.org/";
    if (setting.type === "iris") input.placeholder = "rdfs:label";
    if (setting.key === "shex_validator.max_steps") input.placeholder = "No limit";
    if (setting.placeholder) input.placeholder = setting.placeholder;
  }
  const label = el(doc, "label", { className: "setting", htmlFor: id }, el(doc, "span", {}, setting.label), input);
  if (setting.help) label.append(el(doc, "small", { className: "hint" }, setting.help));
  return label;
}

// The value of the field of a setting, as text (booleans as booleans)
function readField(doc, setting) {
  const input = doc.getElementById(fieldId(setting.key));
  return setting.type === "boolean" ? input.checked : input.value;
}

function writeField(doc, setting, value) {
  const input = doc.getElementById(fieldId(setting.key));
  if (setting.type === "boolean") input.checked = Boolean(value);
  else if (Array.isArray(value)) input.value = value.join(" ");
  else input.value = value === "" || value == null ? "" : String(value);
}

export function setupSettingsDialog({ dialog, opener, badge, getSettings, onSave, check, preview }) {
  const doc = dialog.ownerDocument;
  const fields = dialog.querySelector(".settings-fields");
  fields.replaceChildren(
    ...SETTINGS.map((section) => {
      const fieldset = el(doc, "fieldset", { className: "settings-section" }, el(doc, "legend", {}, section.title), ...section.settings.map((s) => field(doc, s)));
      if (section.id) fieldset.id = `settings-${section.id}`;
      return fieldset;
    }),
  );
  const toml = dialog.querySelector(".settings-toml");
  const error = dialog.querySelector(".settings-error");
  const previewBox = dialog.querySelector(".settings-preview");

  // The settings of the fields, or an error
  function readSettings() {
    const values = {};
    for (const setting of ALL_SETTINGS) values[setting.key] = settingValue(setting, readField(doc, setting));
    return { values, toml: toml.value };
  }

  function show(settings) {
    for (const setting of ALL_SETTINGS) writeField(doc, setting, settings.values[setting.key] ?? setting.default);
    toml.value = settings.toml;
    update();
  }

  // The configuration that rudof gets, or why the settings are wrong
  function update() {
    try {
      const settings = readSettings();
      previewBox.textContent = preview(settings);
      error.hidden = true;
      return settings;
    } catch (e) {
      error.textContent = e.message ?? String(e);
      error.hidden = false;
      return undefined;
    }
  }

  function showBadge() {
    const n = changedCount(getSettings());
    badge.hidden = n === 0;
    badge.textContent = String(n);
    opener.title = n ? `Settings of rudof (${n} changed)` : "Settings of rudof";
  }

  dialog.addEventListener("input", (e) => {
    if (e.target !== toml || !error.hidden) update();
  });
  dialog.addEventListener("change", update);
  toml.addEventListener("input", update);

  // Opens the dialog, at a section (its id) or at the start
  function open(section) {
    show(getSettings());
    dialog.showModal();
    const fieldset = section && doc.getElementById(`settings-${section}`);
    if (fieldset) {
      fieldset.scrollIntoView?.({ block: "start" });
      fieldset.querySelector("input, select")?.focus();
    }
  }

  opener.addEventListener("click", () => open());
  dialog.querySelector(".settings-reset").addEventListener("click", () => show(emptySettings()));
  dialog.querySelector("form").addEventListener("submit", (e) => {
    if (e.submitter?.value !== "save") return;
    const settings = update();
    if (!settings) {
      // update() says what is wrong in the fields
      e.preventDefault();
      return;
    }
    try {
      check(settings);
    } catch (err) {
      e.preventDefault();
      error.textContent = `rudof can't use these settings: ${err.message ?? err}`;
      error.hidden = false;
      return;
    }
    onSave(settings);
    showBadge();
  });
  showBadge();
  return { open };
}
