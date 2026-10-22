// Inputs given by a URL, as in RDFShape: next to the name of an input (RDF
// data, a schema, a query), "Text | URL" says where it comes from. With URL,
// a field takes the place of the editor, and the page reads the URL when the
// tab runs (readUrlInputs): its text goes to the textarea of the input, so
// the rest of the page reads it as before. The URL can be a prefixed name,
// with the prefixes that `prefixesOf` gives (those of the endpoint of the
// tab): es:E371 is https://www.wikidata.org/wiki/Special:EntitySchemaText/E371
// on Wikidata.
//
// The text of an input is kept while it is given by a URL: Text gives it
// back, and URL gives back the last URL. "Edit as text" reads the URL and
// puts its text in the editor.

// The format of a file by its extension, for the format menus that have it
const EXTENSIONS = {
  ttl: "turtle", turtle: "turtle", nt: "ntriples", rdf: "rdfxml", owl: "rdfxml", xml: "rdfxml",
  jsonld: "jsonld", trig: "trig", n3: "n3", nq: "nquads", shex: "shexc", shexc: "shexc", shexj: "shexj",
};

// The inputs given by a URL, by the id of their textarea: { url, text } (the
// URL as written, and the text of the editor, kept)
const sources = new Map();
// The last URL of each input, which URL gives back
const lastUrls = new Map();
let options = {};

function el(doc, tag, props = {}, ...children) {
  const e = Object.assign(doc.createElement(tag), props);
  e.append(...children);
  return e;
}

// The URL that a URL field means: a URL, or a prefixed name of one of the
// prefixes ([alias, iri]), else the text as it is
export function resolveUrl(text, prefixes = []) {
  const value = text.trim();
  if (!value || /^[a-z][\w+.-]*:\/\//i.test(value)) return value;
  const prefixed = value.match(/^([A-Za-z][\w.-]*)?:(\S*)$/);
  if (prefixed) {
    const iri = new Map(prefixes).get(prefixed[1] ?? "");
    if (iri !== undefined) return iri + prefixed[2];
  }
  return value;
}

// The format of the file of a URL, if its extension says it
export function formatOfUrl(url) {
  try {
    const name = new URL(url).pathname.split("/").pop();
    return name.includes(".") ? EXTENSIONS[name.split(".").pop().toLowerCase()] : undefined;
  } catch {
    return undefined;
  }
}

// The text of a URL, or why it can't be read
export async function fetchText(url, fetchFn = (...args) => fetch(...args)) {
  let response;
  try {
    response = await fetchFn(url);
  } catch (e) {
    // fetch says only "Failed to fetch", whatever the reason
    throw new Error("is it online, and does its server allow other sites to read it (CORS)?", { cause: e });
  }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
  return response.text();
}

export const isUrlSource = (id) => sources.has(id);
export const urlOf = (id) => sources.get(id)?.url ?? "";
// The URL of an input given by a URL, resolved
export const resolvedUrlOf = (id) => (sources.has(id) ? resolveUrl(sources.get(id).url, options.prefixesOf?.(id)) : undefined);
// The inputs of an element (a tab) that are given by URLs
export const urlInputsIn = (root) => [...sources.keys()].filter((id) => root.contains(root.ownerDocument.getElementById(id)));

const textareaOf = (doc, id) => doc.getElementById(id);
const editorOf = (doc, id) => doc.querySelector(`[data-editor-for="${id}"]`);
const labelOf = (doc, id) => doc.querySelector(`label[for="${id}"]`)?.textContent.trim() ?? id;

// Shows an input as text (its editor) or as a URL (its field)
function show(doc, id) {
  const url = sources.has(id);
  const box = doc.getElementById(`${id}-source`);
  for (const b of box.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.source === (url ? "url" : "text")));
  // The field of the input hides its editor (see demo.css)
  const editor = editorOf(doc, id) ?? textareaOf(doc, id);
  editor.parentElement.classList.toggle("url-source", url);
  const field = doc.getElementById(`${id}-url-box`);
  field.hidden = !url;
  if (url) {
    doc.getElementById(`${id}-url`).value = sources.get(id).url;
    showResolved(doc, id);
  }
}

// Under the field: the URL that a prefixed name means
export function showResolved(doc, id, read) {
  const hint = doc.getElementById(`${id}-url-hint`);
  if (!hint || !sources.has(id)) return;
  const { url } = sources.get(id);
  const resolved = resolveUrl(url, options.prefixesOf?.(id));
  hint.textContent = read ?? (resolved && resolved !== url.trim() ? `→ ${resolved}` : "");
}

// Gives an input as text, or by a URL (with the URL)
export function setSource(doc, id, source, { url } = {}) {
  const textarea = textareaOf(doc, id);
  if (source === "url") {
    if (!sources.has(id)) sources.set(id, { url: lastUrls.get(id) ?? "", text: textarea.value });
    if (url !== undefined) sources.get(id).url = url;
  } else if (sources.has(id)) {
    // The text it had
    textarea.value = sources.get(id).text;
    lastUrls.set(id, sources.get(id).url);
    sources.delete(id);
  }
  show(doc, id);
}

// Gives an input as this text (from the page: an example, a result used as
// input…), and no more by a URL
export function setText(doc, id, text) {
  if (sources.has(id)) lastUrls.set(id, sources.get(id).url);
  sources.delete(id);
  textareaOf(doc, id).value = text;
  show(doc, id);
}

// Reads the URL of an input into its textarea, and the format of its file
// into its format menu. Returns the URL read.
export async function readUrlInput(doc, id) {
  const url = resolvedUrlOf(id);
  if (!url) throw new Error(`Write the URL of the ${labelOf(doc, id)}, or choose Text.`);
  let text;
  try {
    text = await fetchText(url, options.fetch);
  } catch (e) {
    throw new Error(`The ${labelOf(doc, id)} can't be read from ${url}: ${e.message}`, { cause: e });
  }
  textareaOf(doc, id).value = text;
  const select = textareaOf(doc, id).dataset.formatSelect && doc.getElementById(textareaOf(doc, id).dataset.formatSelect);
  const format = formatOfUrl(url);
  if (select && format && [...select.options].some((o) => o.value === format) && select.value !== format) {
    select.value = format;
    select.dispatchEvent(new doc.defaultView.Event("change"));
  }
  showResolved(doc, id, `Read ${text.length.toLocaleString("en")} characters from ${url}`);
  return url;
}

// Reads the inputs of an element (a tab) that are given by URLs
export async function readUrlInputs(doc, root) {
  for (const id of urlInputsIn(root)) await readUrlInput(doc, id);
}

// The switch and the field of the URL of each input. `prefixesOf(id)`: the
// prefixes of its prefixed names; `onChange`: when an input changes where it
// comes from, or its URL.
export function setupInputSources(doc, ids, { prefixesOf, onChange, fetch: fetchFn } = {}) {
  options = { prefixesOf, fetch: fetchFn };
  for (const id of ids) {
    const textarea = textareaOf(doc, id);
    if (!textarea) continue;
    const name = labelOf(doc, id);
    const button = (source, text, title) => {
      const b = el(doc, "button", { type: "button", title }, text);
      b.dataset.source = source;
      return b;
    };
    const box = el(
      doc,
      "div",
      { className: "view-switch source-switch", id: `${id}-source` },
      button("text", "Text", `Write the ${name}`),
      button("url", "URL", `Read the ${name} from a URL, when the tab runs`),
    );
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", `Where the ${name} comes from`);
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || (b.dataset.source === "url") === sources.has(id)) return;
      setSource(doc, id, b.dataset.source);
      if (b.dataset.source === "url") doc.getElementById(`${id}-url`).focus();
      onChange?.(id);
    });
    doc.querySelector(`label[for="${id}"]`).after(box);

    const input = el(doc, "input", { type: "text", id: `${id}-url`, className: "url-input", spellcheck: false, autocomplete: "off", placeholder: "https://…" });
    input.setAttribute("aria-label", `URL of the ${name}`);
    input.addEventListener("input", () => {
      sources.get(id).url = input.value;
      showResolved(doc, id);
      onChange?.(id);
    });
    const edit = el(doc, "button", { type: "button", className: "link url-to-text", title: `Read the URL, and write its text in the editor of the ${name}` }, "Edit as text");
    const hint = el(doc, "span", { className: "hint url-hint", id: `${id}-url-hint` });
    edit.addEventListener("click", async () => {
      try {
        await readUrlInput(doc, id);
        const text = textarea.value;
        setText(doc, id, text);
        onChange?.(id);
      } catch (e) {
        hint.textContent = e.message;
      }
    });
    const field = el(doc, "div", { className: "url-box", id: `${id}-url-box`, hidden: true }, el(doc, "div", { className: "url-row" }, input, edit), hint);
    (editorOf(doc, id) ?? textarea).after(field);
  }
}
