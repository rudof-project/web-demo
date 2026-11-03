// The inputs of the page that ask for RDF data, a schema or a query: one
// component for each kind. index.html writes only the textarea of an input,
// with its kind, its label and its example, in its .field:
//
//   <div class="field">
//     <span class="hint" id="shex-data-unused" data-head hidden>…</span>
//     <textarea data-input="rdf" id="shex-data" data-label="RDF data">…</textarea>
//   </div>
//
// expandInputs makes the head of each one: its label, the elements of the
// field marked data-head (in their order), and the menu of its formats (the
// select ${id}-format), or the name of its only format. Its textarea becomes
// an editor (codemirror-setup.js) in the format of the menu. demo.js gives
// all of them where they come from (Text | URL, input-source.js), and
// Visualize to those that can be drawn (visualOf).
//
// - data-input="rdf": RDF data, in the formats of RDF_FORMATS.
// - data-input="schema": a schema. data-language says its language (shex,
//   shacl, dctap or pgschema), with the formats of LANGUAGES. Without it, the
//   page chooses the language: the menu is empty, and the page fills it, or
//   the textarea names a menu of its own (data-format-select, an element
//   marked data-head).
// - data-input="query": a query, in data-language (sparql).
//
// Other attributes: data-label-title (the title of the label),
// data-format-tag="none" (no name of the only format), data-visual (how it
// is drawn, for a schema whose language the page chooses).
//
// It runs as a module of its own, before codemirror-setup.js, which makes the
// editors as soon as it runs.

import { LANGUAGES, RDF_FORMATS } from "./schema-convert.js";

export const INPUT_KINDS = ["rdf", "schema", "query"];

// The languages of queries, and their formats: [value, label]
export const QUERY_LANGUAGES = { sparql: { label: "SPARQL", formats: [["sparql", "SPARQL"]] } };

function el(doc, tag, props = {}, ...children) {
  const e = Object.assign(doc.createElement(tag), props);
  e.append(...children);
  return e;
}

// The formats of an input: [value, label], or undefined when the page
// chooses them
function formatsOf(textarea) {
  const { input, language } = textarea.dataset;
  if (input === "rdf") return RDF_FORMATS;
  if (input === "schema") return language ? LANGUAGES[language]?.formats : undefined;
  if (input === "query") return QUERY_LANGUAGES[language ?? "sparql"]?.formats;
  return undefined;
}

// The menu of the formats of an input
export function formatSelect(doc, id, label, formats = RDF_FORMATS) {
  const select = el(doc, "select", { id: `${id}-format` }, ...formats.map(([value, text]) => el(doc, "option", { value }, text)));
  select.setAttribute("aria-label", `${label} format`);
  return select;
}

// The head and the editor of an input: `textarea` has its kind and its label,
// and is in its field
export function expandInput(textarea) {
  const doc = textarea.ownerDocument;
  if (textarea.dataset.expanded !== undefined) return textarea;
  const { id } = textarea;
  const label = textarea.dataset.label ?? id;
  const labelEl = el(doc, "label", { htmlFor: id }, label);
  if (textarea.dataset.labelTitle) labelEl.title = textarea.dataset.labelTitle;
  const head = el(doc, "div", { className: "field-head" }, labelEl);
  // The language of a schema or a query (data-language becomes the format of
  // the editor)
  if (textarea.dataset.language && textarea.dataset.input !== "rdf") textarea.dataset.inputLanguage = textarea.dataset.language;
  head.append(...[...textarea.parentElement.children].filter((e) => e.hasAttribute("data-head")));
  const formats = formatsOf(textarea);
  if (formats?.length === 1) {
    // One format: the editor has it, and the head says its name, unless the
    // label already does
    const [[value, name]] = formats;
    textarea.dataset.language = value;
    if (textarea.dataset.formatTag !== "none" && !label.includes(name)) head.append(el(doc, "span", { className: "format-tag" }, name));
  } else if (formats) {
    const select = formatSelect(doc, id, label, formats);
    head.append(select);
    textarea.dataset.formatSelect = select.id;
    delete textarea.dataset.language;
  } else if (!textarea.dataset.formatSelect) {
    // The page fills the menu
    const select = formatSelect(doc, id, label, []);
    head.append(select);
    textarea.dataset.formatSelect = select.id;
  }
  textarea.before(head);
  textarea.dataset.editor = "";
  textarea.spellcheck = false;
  textarea.dataset.expanded = "";
  return textarea;
}

// The fields of all the inputs of a page
export function expandInputs(doc = document) {
  return [...doc.querySelectorAll("textarea[data-input]")].map(expandInput);
}

// The ids of the inputs of some kinds, in the order of the page
export function inputsOf(doc, ...kinds) {
  return [...doc.querySelectorAll("textarea[data-input]")].filter((t) => kinds.includes(t.dataset.input)).map((t) => t.id);
}

// How an input is drawn by Visualize: "rdf" (RDF data), "shex" (a ShEx
// schema), or undefined
export function visualOf(textarea) {
  if (textarea.dataset.visual) return textarea.dataset.visual;
  if (textarea.dataset.input === "rdf") return "rdf";
  if (textarea.dataset.input === "schema" && textarea.dataset.inputLanguage === "shex") return "shex";
  return undefined;
}

// In the page: before the editors are made
if (typeof document !== "undefined" && document.querySelector("textarea[data-input]")) expandInputs(document);
