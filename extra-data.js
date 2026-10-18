// More RDF data in a tab: under the RDF data of the RDF, ShEx, SHACL, DCTAP
// and SPARQL tabs, "Add RDF data" adds another editor with its own format.
// rudof merges all of them (readData with merge) before it converts,
// validates or queries them.

import { setupEditors, editorFor } from "./codemirror-setup.js";

export const DATA_TABS = ["rdf", "shex", "shacl", "dctap", "sparql"];

// The editors added to each tab: [{ block, textarea, select }]
const extras = new Map(DATA_TABS.map((prefix) => [prefix, []]));
let added = 0;

function el(doc, tag, props = {}, ...children) {
  const e = Object.assign(doc.createElement(tag), props);
  e.append(...children);
  return e;
}

// Their labels say their order: RDF data 2, 3…
function renumber(prefix) {
  extras.get(prefix).forEach(({ block }, i) => {
    block.querySelector("label").textContent = `RDF data ${i + 2}`;
  });
}

// Adds the editor of more RDF data to a tab, with its text and format (the
// format of the RDF data of the tab by default). onChange: after it is added
// or removed.
export function addData(doc, prefix, { text = "", format, onChange } = {}) {
  const main = doc.getElementById(`${prefix}-data-format`);
  added += 1;
  const id = `${prefix}-data-more${added}`;
  const select = el(doc, "select", { id: `${id}-format` }, ...[...main.options].map((o) => new Option(o.text, o.value)));
  select.setAttribute("aria-label", "RDF data format");
  select.value = format && [...select.options].some((o) => o.value === format) ? format : main.value;
  const textarea = el(doc, "textarea", { id, spellcheck: false, className: "medium", placeholder: "More RDF data, merged with the data above" });
  textarea.dataset.editor = "";
  textarea.dataset.formatSelect = select.id;
  textarea.value = text;
  const remove = el(doc, "button", { type: "button", className: "link remove-data", title: "Remove this RDF data" }, "Remove");
  const block = el(
    doc,
    "div",
    { className: "extra-data" },
    el(doc, "div", { className: "field-head" }, el(doc, "label", { htmlFor: id }, "RDF data"), remove, select),
    textarea,
  );
  doc.getElementById(`${prefix}-extra-data`).append(block);
  const entry = { block, textarea, select };
  extras.get(prefix).push(entry);
  setupEditors(block);
  renumber(prefix);
  remove.addEventListener("click", () => {
    editorFor(id)?.destroy();
    block.remove();
    extras.set(prefix, extras.get(prefix).filter((e) => e !== entry));
    renumber(prefix);
    onChange?.();
  });
  return entry;
}

// The RDF data added to a tab: [{ text, format }]
export function extraData(prefix) {
  return (extras.get(prefix) ?? []).map(({ textarea, select }) => ({ text: textarea.value, format: select.value }));
}

// Removes the RDF data added to a tab
export function clearExtraData(prefix) {
  for (const { block, textarea } of extras.get(prefix) ?? []) {
    editorFor(textarea.id)?.destroy();
    block.remove();
  }
  extras.set(prefix, []);
}

// The button "Add RDF data", and the place of the editors, under the RDF data
// of each tab
export function setupExtraData(doc, { onChange } = {}) {
  for (const prefix of DATA_TABS) {
    const field = doc.getElementById(`${prefix}-data`).closest(".field");
    const list = el(doc, "div", { id: `${prefix}-extra-data`, className: "extra-data-list" });
    const add = el(doc, "button", { type: "button", className: "link add-data", id: `${prefix}-add-data` }, "+ Add RDF data");
    add.title = "Merge other RDF data with this one";
    add.addEventListener("click", () => {
      const { textarea } = addData(doc, prefix, { onChange });
      textarea.focus();
      onChange?.();
    });
    field.append(list, add);
  }
}
