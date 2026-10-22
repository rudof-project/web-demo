// rudof online demo: converting, validating (ShEx, SHACL, PGSchema) and
// querying (SPARQL) RDF data and property graphs with the @rudof/rudof npm
// package (rudof compiled to WebAssembly), loaded from jsDelivr.

import { PANELS, hasState, panelOfParams, stateParams, queryString, inputsOfParams } from "./permalink.js";
import { setupLayout } from "./layout.js";
import { queryEndpoint, queryPrefixes, solutionsCsv, endpointError, endpointConfig, PAGE_ENDPOINT, KNOWN_ENDPOINTS } from "./endpoint.js";
import { dctapConfig, columnClass, parsePrefixes, BASIC_PREFIXES, BASE_CONFIG } from "./dctap.js";
import { setupTableView } from "./table-view.js";
import { parseCsv } from "./csv.js";
import { makeTableTools } from "./table-tools.js";
import { COMMON_PREFIXES, endpointFileURL, endpointToml } from "./prefixes.js";
import { setPrefixSource } from "./prefix-completion.js";
import { loadSettings, saveSettings, configWithSettings, settingsEndpoints, settingsConfig, pageSetting, limitsOf } from "./settings.js";
import { setupSettingsDialog } from "./settings-dialog.js";
import { DATA_TABS, setupExtraData, addData, extraData, clearExtraData } from "./extra-data.js";
import { parseBoxTable } from "./box-table.js";
import { setupInputSources, setSource, setText, isUrlSource, urlOf, resolvedUrlOf, urlInputsIn, readUrlInputs, showResolved } from "./input-source.js";
import { startLog, loggingFetch, logSummary, logTime, limitsText, renderQueries, isStopping } from "./endpoint-log.js";
import { LANGUAGES, TARGETS, DEFAULT_TARGET, canConvert, readSchema as readAnySchema, readShexSchema, hasShexImports, hasRelativeImports, convertSchema, sourceLabel, targetLabel, asSource } from "./schema-convert.js";
import { devDependencies } from "./package.json";

// The exact version of package.json (the one the tests use), so that updating
// rudof is only a change of package.json. Exact, not a range: jsDelivr caches
// what a range (like 0.3) points to, so a range can keep serving an older
// release for days. update-rudof.yml updates it when rudof is released on npm.
const RUDOF_VERSION = devDependencies["@rudof/rudof"];
const RUDOF_MODULE = `https://cdn.jsdelivr.net/npm/@rudof/rudof@${RUDOF_VERSION}/web/rudof_wasm.js`;
// The same rudof, built with the `endpoints` feature: it validates and queries
// the data of SPARQL endpoints (useEndpoint, and the ...Async methods). Its
// .wasm only loads in browsers with JSPI (WebAssembly.Suspending: Chrome and
// Edge 137+), so the others load RUDOF_MODULE, and so do all browsers when
// it can't be loaded. It is in the package since rudof 0.3.27.
const RUDOF_ENDPOINTS_MODULE = `https://cdn.jsdelivr.net/npm/@rudof/rudof@${RUDOF_VERSION}/endpoints/web/rudof_wasm.js`;
const HAS_JSPI = typeof WebAssembly.Suspending === "function";

// PlantUML, compiled to JavaScript with TeaVM, draws the diagrams. It is
// loaded the first time a diagram is shown.
const PLANTUML_VERSION = "1.2026.8";
const PLANTUML_BASE = `https://cdn.jsdelivr.net/npm/@plantuml/core@${PLANTUML_VERSION}/`;

const $ = (id) => document.getElementById(id);

// The last successful validation of each tab, so that changing the result
// format serializes it again without validating again.
const last = {};

// The tabs that can run on an endpoint (see Endpoints), and the endpoint of a
// tab, if it doesn't run on the data of the page
const ENDPOINT_TABS = ["shex", "shacl", "dctap", "sparql"];
// The inputs that can also be given by a URL (input-source.js): the RDF
// data, the schemas and the queries
const URL_INPUTS = [
  "rdf-data", "convert-schema", "shex-data", "shex-schema", "shacl-data", "shacl-shapes",
  "dctap-data", "dctap-schema", "pgschema-schema", "sparql-data", "sparql-query",
];
// The prefixes of the prefixed names of the URL of an input: common ones,
// and those of the endpoint of its tab, which win
function urlPrefixes(id) {
  const tab = id.split("-")[0];
  const endpoint = ENDPOINT_TABS.includes(tab) ? endpointOf(tab) : "";
  const url = endpoint ? endpointUrlOf(endpoint) : "";
  return [...COMMON_PREFIXES, ...(url ? (settingsEndpointPrefixes.get(url) ?? endpointPrefixes.get(url) ?? []) : [])];
}

// Writes a text in an input (an example, a result used as input…): the
// input is text then, and no more a URL
function setInputText(id, text) {
  if (URL_INPUTS.includes(id)) setText(document, id, text);
  else $(id).value = text;
}

// The fetch of the requests to endpoints, which logs them: rudof's
// (setFetch) and the page's (endpoint.js). Details of the log of a run on an
// endpoint stays open for the next runs when it is open.
const pageFetch = loggingFetch();
// The dialog of the settings (setupSettings), which the Options of the
// endpoints open
let settingsDialog;
// The log of the last run of each tab on an endpoint: only it is drawn
const currentLogs = {};
// How long a new run waits for a stopped run of its tab to end
const STOPPING_WAIT = 15_000;
const endpointOf = (prefix) => $(`${prefix}-endpoint`).value.trim();
// Whether a tab uses its RDF data with its endpoint
const withData = (prefix) => Boolean($(`${prefix}-endpoint-data`)?.checked);
// The endpoints of the Endpoint menus, as [name, url], and the item of the
// menus for any other endpoint
const OTHER_ENDPOINT = "other";
let knownEndpoints = KNOWN_ENDPOINTS;
// The settings of rudof that the user changed (settings.js), which the
// browser keeps
function localStorageOrNone() {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}
let settings = loadSettings(localStorageOrNone());

// The endpoints of the menus: those that rudof knows (the page knows some
// before rudof is loaded), and those of the settings, with their prefixes
let rudofKnownEndpoints = KNOWN_ENDPOINTS;
const settingsEndpointPrefixes = new Map();
// The limits of the requests to the endpoints of the settings, and to those
// that rudof knows (in their TOML files, such as min_request_interval_ms of
// Wikidata), by their URLs
const settingsEndpointLimits = new Map();
const endpointLimits = new Map();

// The names of the endpoints in rudof, by their URLs, and their prefixes
// (readEndpointPrefixes): being read, and read, as [alias, iri]
const endpointNames = new Map(KNOWN_ENDPOINTS.map(([name, url]) => [url, name]));
const endpointPrefixReads = new Map();
const endpointPrefixes = new Map();

// ---------------------------------------------------------------------------
// Tabs
//
// Two levels: the sections (Data, Validate, Query), and inside each one its
// own tabs (RDF and Property graph, ShEx, SHACL and PGSchema, SPARQL). The URL
// fragment names both, e.g. #validate/shacl.

const tabName = (tab) => tab.id.replace("tab-", "");
const tabsOf = (tablist) => [...tablist.querySelectorAll(':scope > [role="tab"]')];
const sectionTabs = tabsOf(document.querySelector('.tabs:not(.subtabs)'));

// The tab selected inside a section.
function selectedSubtab(section) {
  return tabsOf($(`panel-${tabName(section)}`).querySelector(".subtabs")).find(
    (t) => t.getAttribute("aria-selected") === "true",
  );
}

function selectTab(tab, focus = false) {
  for (const t of tabsOf(tab.parentElement)) {
    const selected = t === tab;
    t.setAttribute("aria-selected", String(selected));
    t.tabIndex = selected ? 0 : -1;
    $(t.getAttribute("aria-controls")).hidden = !selected;
  }
  if (focus) tab.focus();
  const section = sectionTabs.find((t) => t.getAttribute("aria-selected") === "true");
  history.replaceState(null, "", `#${tabName(section)}/${tabName(selectedSubtab(section))}`);
}

// A tab chosen by the user. When the URL has the inputs of the tab before, it
// gets the ones of this tab instead.
function chooseTab(tab, focus = false) {
  selectTab(tab, focus);
  if (hasState(new URLSearchParams(location.search))) updatePermalink();
}

for (const tab of document.querySelectorAll('[role="tab"]')) {
  tab.addEventListener("click", () => chooseTab(tab));
  tab.addEventListener("keydown", (e) => {
    const tabs = tabsOf(tab.parentElement);
    const i = tabs.indexOf(tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    chooseTab(tabs[(next + tabs.length) % tabs.length], true);
  });
}

// Earlier links named only the tab: #shex, #shacl, #pgschema, #rdf.
const OLD_FRAGMENTS = { shex: "validate/shex", shacl: "validate/shacl", pgschema: "validate/pgschema", rdf: "data/rdf" };

// The URL fragment selects the tabs, on load and when it changes.
function selectTabFromHash() {
  const fragment = location.hash.slice(1);
  const [section, subtab] = (OLD_FRAGMENTS[fragment] ?? fragment).split("/");
  const sectionTab = sectionTabs.find((t) => tabName(t) === section);
  if (!sectionTab) return;
  const sub = subtab && $(`tab-${subtab}`);
  if (sub && $(`panel-${section}`).contains(sub)) selectTab(sub);
  selectTab(sectionTab);
}
// ---------------------------------------------------------------------------
// Permalinks
//
// After each operation, the query of the URL gets the inputs and options of
// the tab shown (see permalink.js), and the Permalink button copies the URL.
// When the page opens, they are put back in their tab.

const params = new URLSearchParams(location.search);

// A result format of SPARQL that is only there after a query is run
let pendingSparqlFormat;

function currentPanel() {
  const section = sectionTabs.find((t) => t.getAttribute("aria-selected") === "true");
  return { section: tabName(section), panel: tabName(selectedSubtab(section)) };
}

// The value of an input in permalinks: checkboxes are true or false
const inputValue = (id) => ($(id).type === "checkbox" ? String($(id).checked) : $(id).value);

function permalinkURL() {
  const { section, panel } = currentPanel();
  const url = new URL(location.href);
  const ids = PANELS[panel].params;
  // The inputs given by URLs: their URLs (schema-url=…), not their text
  const pairs = stateParams(panel, inputValue, url.searchParams).map(([name, value]) => (isUrlSource(ids[name]) ? [`${name}-url`, urlOf(ids[name])] : [name, value]));
  // The RDF data added to the tab: data-2, data-2-format…
  if (DATA_TABS.includes(panel)) {
    extraData(panel).forEach(({ text, format }, i) => pairs.push([`data-${i + 2}`, text], [`data-${i + 2}-format`, format]));
  }
  url.search = queryString(pairs);
  url.hash = `${section}/${panel}`;
  return url.href;
}

function updatePermalink() {
  history.replaceState(null, "", permalinkURL());
}

// The old values of the selects in permalinks, and their values now
const VALUE_ALIASES = {
  // rudof 0.3.28 calls cautious and brave lfp and gfp
  "shacl-recursion": { cautious: "lfp", brave: "gfp" },
};

function restoreInputs() {
  if (!hasState(params)) return;
  const fragment = location.hash.slice(1);
  let panel = (OLD_FRAGMENTS[fragment] ?? fragment).split("/")[1];
  if (!PANELS[panel]) {
    // A URL without a tab: the tab of its parameters
    panel = panelOfParams(params);
    history.replaceState(null, "", `#${PANELS[panel].section}/${panel}`);
  }
  for (let [id, value] of inputsOfParams(panel, params)) {
    const input = $(id);
    if (input instanceof HTMLSelectElement) {
      // Values that have other names now
      value = VALUE_ALIASES[id]?.[value] ?? value;
      if (![...input.options].some((o) => o.value === value)) {
        if (id === "sparql-result-format") pendingSparqlFormat = value;
        continue;
      }
      input.value = value;
      // The editor highlights the text in its format
      input.dispatchEvent(new Event("change"));
    } else if (input.type === "checkbox") {
      input.checked = value === "true";
      input.dispatchEvent(new Event("change"));
    } else {
      input.value = value;
    }
  }
  // The inputs given by URLs
  for (const [name, id] of Object.entries(PANELS[panel].params)) {
    if (URL_INPUTS.includes(id) && params.has(`${name}-url`)) setSource(document, id, "url", { url: params.get(`${name}-url`) });
  }
  // The RDF data added to the tab, in their order
  if (DATA_TABS.includes(panel)) {
    clearExtraData(panel);
    const numbers = [...params.keys()].map((name) => name.match(/^data-(\d+)$/)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
    for (const n of numbers) addData(document, panel, { text: params.get(`data-${n}`), format: params.get(`data-${n}-format`) ?? undefined, onChange: updatePermalink });
  }
}

// ---------------------------------------------------------------------------
// Schema: a schema of any language, converted to other formats and languages
// (schema-convert.js). The menus have the conversions rudof can't do yet,
// which can't be chosen.

const NOT_YET = " (not in rudof yet)";

// The example of each language: the schemas of the Validate tabs
const SCHEMA_EXAMPLES = {
  shex: [$("shex-schema").textContent, "shexc"],
  shacl: [$("shacl-shapes").textContent, "turtle"],
  dctap: [$("dctap-schema").textContent, "dctap"],
  pgschema: [$("pgschema-schema").textContent, "pgschema"],
};

const option = (value, text, enabled = true) => {
  const o = new Option(enabled ? text : text + NOT_YET, value);
  o.disabled = !enabled;
  return o;
};

// Options of a select, keeping its value when it is still one of them
function setOptions(select, options, preferred) {
  const value = select.value;
  select.replaceChildren(...options);
  const enabled = (v) => options.some((o) => o.value === v && !o.disabled);
  select.value = [value, preferred].find(enabled) ?? options.find((o) => !o.disabled)?.value ?? "";
  select.dispatchEvent(new Event("change"));
}

function convertSource() {
  const language = $("convert-language").value;
  const text = $("convert-schema").value;
  const config = rudofConfig(
    language === "dctap" ? dctapConfig($("convert-prefixes").value, { picklistSeparator: $("convert-picklist").value }) : BASE_CONFIG,
  );
  return { language, format: $("convert-format").value, text, config };
}

function updateTargetFormats() {
  const from = $("convert-language").value;
  const to = $("convert-to").value;
  const options = TARGETS[to].formats.map(([value, text, available]) => option(value, text, available && canConvert(from, to, value)));
  setOptions($("convert-result-format"), options, DEFAULT_TARGET[from][0] === to ? DEFAULT_TARGET[from][1] : undefined);
}

function updateTargets() {
  const from = $("convert-language").value;
  const options = Object.entries(TARGETS).map(([value, { label }]) => option(value, label, canConvert(from, value)));
  setOptions($("convert-to"), options, DEFAULT_TARGET[from][0]);
}

// A new language of the schema: its formats, its example (when the schema is
// still the example of the language before), and what it converts to
let convertLanguage = $("convert-language").value;
function changeConvertLanguage() {
  const language = $("convert-language").value;
  const before = SCHEMA_EXAMPLES[convertLanguage];
  if (!isUrlSource("convert-schema") && (!$("convert-schema").value.trim() || (before && $("convert-schema").value === before[0]))) {
    $("convert-schema").value = SCHEMA_EXAMPLES[language][0];
  }
  convertLanguage = language;
  setOptions(
    $("convert-format"),
    LANGUAGES[language].formats.map(([value, text]) => option(value, text)),
    SCHEMA_EXAMPLES[language][1],
  );
  $("convert-dctap-options").hidden = language !== "dctap";
  $("convert-view").hidden = language !== "dctap";
  if (language !== "dctap") convertTable.setView("csv");
  updateTargets();
}

$("convert-language").addEventListener("change", changeConvertLanguage);
$("convert-to").addEventListener("change", () => {
  updateTargetFormats();
  reformat("convert");
});

function readConvertSource() {
  const start = performance.now();
  const source = convertSource();
  const result = () => ({ kind: "ok", millis: performance.now() - start, verdict: convertVerdict(), source });
  // A ShEx schema with imports: rudof gets them first, in a new session
  if (source.language === "shex" && hasShexImports(source.text, source.format)) {
    source.base = importBase("convert", source.text);
    const fresh = freshSession();
    return waiting(
      Promise.resolve(readAnySchema(fresh, source)).then(() => ({ ...result(), session: fresh })),
      READING_IMPORTS,
    );
  }
  readAnySchema(session("convert"), source);
  return result();
}

function convertVerdict() {
  const source = { language: $("convert-language").value, format: $("convert-format").value };
  return `${sourceLabel(source)} → ${targetLabel({ to: $("convert-to").value, format: $("convert-result-format").value })}`;
}

function serializeConversion() {
  last.convert.verdict = convertVerdict();
  const target = { to: $("convert-to").value, format: $("convert-result-format").value };
  return convertSchema(session("convert"), session("convert-shex"), last.convert.source, target);
}

// The result, read back as the schema: when it is a schema in a format of its language
function convertedAsSource() {
  return asSource({ to: $("convert-to").value, format: $("convert-result-format").value });
}

function updateConvertSchemaButtons() {
  const converted = Boolean(last.convert) && !crashed && $("convert-result").dataset.kind === "ok";
  $("convert-copy").disabled = !converted;
  $("convert-use-as-input").disabled = !converted || !convertedAsSource();
}

$("convert-copy").addEventListener("click", async (e) => {
  const button = e.currentTarget;
  try {
    await navigator.clipboard.writeText($("convert-output").textContent);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy failed";
  }
  setTimeout(() => (button.textContent = "Copy"), 1500);
});

$("convert-use-as-input").addEventListener("click", () => {
  const source = convertedAsSource();
  if (!source) return;
  const text = $("convert-output").textContent;
  $("convert-language").value = source.language;
  changeConvertLanguage();
  $("convert-format").value = source.format;
  $("convert-format").dispatchEvent(new Event("change"));
  setInputText("convert-schema", text);
  $("convert-schema").focus();
});

setupLayout();
// The DCTAP profile, as CSV or as a table
setupTableView({
  textarea: $("dctap-schema"),
  container: $("dctap-table"),
  toggle: document.querySelectorAll("#dctap-view button"),
  cellClass: columnClass,
});
// The schema of the Schema tab, when it is a DCTAP profile
const convertTable = setupTableView({
  textarea: $("convert-schema"),
  container: $("convert-table"),
  toggle: document.querySelectorAll("#convert-view button"),
  cellClass: columnClass,
});
// The formats and targets of the schema of the Schema tab
changeConvertLanguage();
refreshKnownEndpoints();
setupExtraData(document, { onChange: updatePermalink });
setupInputSources(document, URL_INPUTS, { prefixesOf: urlPrefixes, onChange: updatePermalink });
restoreInputs();
showEndpointUse();
showShaclOptions();
showShapesFromData();
showTargetsUsed();
selectTabFromHash();
window.addEventListener("hashchange", selectTabFromHash);

$("permalink").addEventListener("click", async (e) => {
  const button = e.currentTarget;
  updatePermalink();
  try {
    await navigator.clipboard.writeText(location.href);
    button.textContent = "Copied";
  } catch {
    // The link is in the address bar anyway
    button.textContent = "Copy failed";
  }
  setTimeout(() => (button.textContent = "Permalink"), 1500);
});

// ---------------------------------------------------------------------------
// Results

// `output` is text, an element (a table built from a report), or
// `{ plantuml }`: the source of a diagram, which is drawn.
function showResult(prefix, { verdict, kind, output, millis }) {
  const box = $(`${prefix}-result`);
  box.hidden = false;
  box.dataset.kind = kind;
  box.querySelector(".verdict").textContent = verdict;
  box.querySelector(".timing").textContent = millis === undefined ? "" : `${millis.toFixed(0)} ms`;
  const pre = box.querySelector(".output");
  const table = box.querySelector(".table-output");
  const diagram = box.querySelector(".diagram");
  const isElement = output instanceof Element;
  const isDiagram = typeof output === "object" && output !== null && "plantuml" in output;
  if (table) {
    table.hidden = !isElement;
    table.replaceChildren(...(isElement ? [output] : []));
  }
  if (diagram) diagram.hidden = !isDiagram;
  if (isDiagram) {
    pre.textContent = output.plantuml;
    pre.hidden = !diagram.classList.contains("show-source");
    drawDiagram(box, output.plantuml);
    return;
  }
  diagrams.set(box, null); // a diagram still being drawn is not shown
  pre.hidden = isElement;
  if (!isElement) pre.textContent = plain(output);
  showCsvView(box, prefix, kind !== "error" && kind !== "running" && !isElement);
}

// CSV results, as text (in the viewer of the result) or as a table: the
// switch of the result chooses, for all the results, and the browser
// remembers it.
const CSV_VIEW_KEY = "rudof-demo-view-results";
let csvView = "csv";
try {
  csvView = localStorage.getItem(CSV_VIEW_KEY) === "table" ? "table" : "csv";
} catch {
  // not remembered
}

function csvTable(text) {
  const [header = [], ...rows] = parseCsv(text);
  const el = (tag, props = {}, ...children) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children);
    return e;
  };
  return makeTableTools(el(
    "table",
    { className: "report csv-result" },
    el("thead", {}, el("tr", {}, ...header.map((h) => el("th", {}, h)))),
    el("tbody", {}, ...rows.map((row) => el("tr", {}, ...row.map((cell) => el("td", {}, el("code", {}, cell)))))),
  ));
}

// text: whether the result is text, which may be CSV (not an error or a table)
function showCsvView(box, prefix, text = box.dataset.csvText === "true") {
  const toggle = box.querySelector(".csv-switch");
  if (!toggle) return;
  box.dataset.csvText = String(text);
  const isCsv = text && $(`${prefix}-result-format`)?.value === "csv";
  const asTable = isCsv && csvView === "table";
  toggle.hidden = !isCsv;
  for (const button of toggle.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.view === csvView));
  box.classList.toggle("csv-as-table", asTable);
  const table = box.querySelector(".csv-output");
  table.hidden = !asTable;
  table.replaceChildren(...(asTable ? [csvTable(box.querySelector(".output").textContent)] : []));
}

for (const button of document.querySelectorAll(".csv-switch button")) {
  button.addEventListener("click", () => {
    csvView = button.dataset.view;
    try {
      localStorage.setItem(CSV_VIEW_KEY, csvView);
    } catch {
      // not remembered
    }
    for (const box of document.querySelectorAll(".result:has(.csv-switch)")) showCsvView(box, box.id.replace(/-result$/, ""));
  });
}

// Diagrams

let plantuml;

function loadPlantuml() {
  plantuml ??= (async () => {
    // Graphviz (Viz.js), which PlantUML uses for layout, is a classic script.
    await new Promise((resolve, reject) => {
      const script = Object.assign(document.createElement("script"), { src: `${PLANTUML_BASE}viz-global.js` });
      script.onload = resolve;
      script.onerror = () => reject(new Error("could not load Graphviz"));
      document.head.append(script);
    });
    return import(/* @vite-ignore */ `${PLANTUML_BASE}plantuml.js`);
  })();
  plantuml.catch(() => (plantuml = undefined)); // try again next time
  return plantuml;
}

async function plantumlSvg(source) {
  const { renderToString } = await loadPlantuml();
  return new Promise((resolve, reject) =>
    renderToString(source.split(/\r\n|\r|\n/), resolve, (message) => reject(new Error(message))),
  );
}

// The diagram being drawn in each result box, so that only the last one is shown.
const diagrams = new WeakMap();

async function drawDiagram(box, source) {
  const image = box.querySelector(".diagram-image");
  const download = box.querySelector('[data-action="download"]');
  const token = {};
  diagrams.set(box, token);
  const note = (text, className = "diagram-status") => image.replaceChildren(Object.assign(document.createElement("p"), { className, textContent: text }));
  note(plantuml ? "Drawing the diagram…" : "Loading PlantUML (about 2 MB, only the first time)…");
  download.removeAttribute("href");
  try {
    const svg = await plantumlSvg(source);
    if (diagrams.get(box) !== token) return;
    // As an image, so that nothing in the SVG runs in the page
    if (box.dataset.svg) URL.revokeObjectURL(box.dataset.svg);
    box.dataset.svg = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    image.replaceChildren(Object.assign(new Image(), { src: box.dataset.svg, alt: "Diagram" }));
    download.href = box.dataset.svg;
  } catch (e) {
    if (diagrams.get(box) === token) note(`Could not draw the diagram: ${e.message ?? e}`, "diagram-status error");
  }
}

for (const diagram of document.querySelectorAll(".diagram")) {
  diagram.querySelector('[data-action="source"]').addEventListener("click", (e) => {
    const shown = diagram.classList.toggle("show-source");
    diagram.closest(".result").querySelector(".output").hidden = !shown;
    e.currentTarget.textContent = shown ? "Hide PlantUML source" : "Show PlantUML source";
  });
}

let crashed = false;

function showError(prefix, e) {
  // A panic in Rust aborts the WebAssembly module, which can't be used again.
  if (e instanceof WebAssembly.RuntimeError) {
    crashed = true;
    setStatus("error", "rudof stopped working: reload the page to continue");
    for (const b of document.querySelectorAll('button[id$="-validate"]')) b.disabled = true;
    showResult(prefix, {
      verdict: "Internal error",
      kind: "error",
      output: `rudof crashed (${e.message}). Please reload the page, and report the input at\nhttps://github.com/rudof-project/rudof/issues`,
    });
    return;
  }
  showResult(prefix, {
    verdict: e.name && e.name !== "Error" ? e.name : "Error",
    kind: "error",
    output: e.message ?? String(e),
  });
}

// Tables are made for terminals: remove their colors (ANSI escape codes) and
// hyperlinks (OSC 8), which browsers would show as stray characters.
const TERMINAL_ESCAPES = /\x1b\]8;[^\x1b\x07]*(?:\x1b\\|\x07)|\x1b\[[0-9;]*[A-Za-z]/g;

function plain(text) {
  return text.replace(TERMINAL_ESCAPES, "");
}

function count(n, word, plural = `${word}s`) {
  return `${n} ${n === 1 ? word : plural}`;
}

function setStatus(kind, text) {
  const status = $("status");
  status.className = `status ${kind}`;
  status.textContent = text;
}

// ---------------------------------------------------------------------------
// Validation

let rudofModule;
// Whether the loaded rudof can use endpoints (see RUDOF_ENDPOINTS_MODULE), and
// why rudof with endpoints could not be loaded, if it was tried
let rudofEndpoints = false;
let endpointsError;
// Settled when rudof is loaded, or could not be (see Loading)
let markRudofLoaded;
const rudofLoaded = new Promise((resolve) => (markRudofLoaded = resolve));
const sessions = {};

// The settings of rudof (settings.js) apply to every session: the
// configuration of an operation (TOML) with the settings over it. Each
// session has the configuration of the settings it was last given (stamp).
let settingsStamp = 0;
const configStamps = new WeakMap();

// The configuration of rudof for an operation, with the settings
function rudofConfig(toml = BASE_CONFIG) {
  return rudofModule.RudofConfig.fromToml(configWithSettings(toml, settings));
}

// Gives a session the configuration of an operation, with the settings
function configure(rudof, toml) {
  rudof.updateConfig(rudofConfig(toml));
  configStamps.set(rudof, settingsStamp);
  return rudof;
}

// A session of the page, with the settings
function session(name) {
  sessions[name] ??= new rudofModule.Rudof();
  if (configStamps.get(sessions[name]) !== settingsStamp) configure(sessions[name]);
  return sessions[name];
}

// ---------------------------------------------------------------------------
// Endpoints
//
// The ShEx, SHACL, DCTAP and SPARQL tabs can run on the data of a SPARQL
// endpoint instead of the RDF data of the tab: rudof (built with endpoints)
// sends the queries, with useEndpoint and the ...Async methods. Without such
// a rudof, the SPARQL tab sends the query itself (endpoint.js), and the
// validations can't run on endpoints.

// How the results name an endpoint: by its host, or by its name in rudof
function endpointName(endpoint) {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

// Why the validations can't use endpoints
function noEndpoints() {
  if (!HAS_JSPI) {
    return "Validating the data of an endpoint needs a browser with JSPI (JavaScript Promise Integration), such as Chrome or Edge 137 or later.";
  }
  if (endpointsError) return `rudof with endpoints could not be loaded in this browser, so it can't validate the data of an endpoint: ${endpointsError}`;
  return "The rudof of this page can't validate the data of an endpoint: it was built without endpoints.";
}

// The data is not used when the tab runs on an endpoint.
function showEndpointUse() {
  for (const prefix of ENDPOINT_TABS) {
    const onEndpoint = Boolean(endpointOf(prefix));
    const unused = onEndpoint && !withData(prefix);
    $(`${prefix}-data`).closest(".field").classList.toggle("unused", unused);
    $(`${prefix}-data-unused`).hidden = !unused;
    // "With the RDF data" is for endpoints
    $(`${prefix}-endpoint-data`).closest("label").hidden = !onEndpoint;
    $(`${prefix}-endpoint-options`).hidden = !onEndpoint;
    showEndpointPrefixes(prefix);
  }
  showEndpointChoices();
}

// The prefixes that rudof declares for the endpoints it knows (see
// prefixes.js), read once, with the limits of their requests. Endpoints that
// rudof doesn't know have none.
function readEndpointPrefixes(url) {
  if (settingsEndpointPrefixes.has(url)) return Promise.resolve(settingsEndpointPrefixes.get(url));
  const name = endpointNames.get(url);
  if (!name) return Promise.resolve([]);
  if (!endpointPrefixReads.has(url)) {
    const read = fetch(endpointFileURL(RUDOF_VERSION, name))
          .then((response) => (response.ok ? response.text() : ""))
          .then((text) => {
            if (!text) return [];
            const { prefixes, description } = endpointToml(text);
            endpointLimits.set(url, limitsOf(description));
            return prefixes;
          })
          .catch((e) => {
            console.info(`The prefixes of ${name} could not be read: ${e.message ?? e}`);
            return [];
          });
    endpointPrefixReads.set(url, read.then((prefixes) => (endpointPrefixes.set(url, prefixes), prefixes)));
  }
  return endpointPrefixReads.get(url);
}

// Under the Endpoint field: the prefixes that the endpoint declares, as
// SPARQL declarations, to read or copy (the editors offer them too).
async function showEndpointPrefixes(prefix) {
  const box = $(`${prefix}-endpoint-prefixes`);
  const endpoint = endpointOf(prefix);
  const prefixes = endpoint ? await readEndpointPrefixes(endpoint) : [];
  if (endpointOf(prefix) !== endpoint) return; // changed meanwhile
  box.hidden = prefixes.length === 0;
  const name = knownEndpoints.find(([, url]) => url === endpoint)?.[0] ?? endpointName(endpoint);
  box.querySelector("summary").textContent = `Prefixes of ${name} (${prefixes.length})`;
  box.querySelector("pre").textContent = prefixes.map(([alias, iri]) => `PREFIX ${alias}: <${iri}>`).join("\n");
  // The URLs of the inputs of the tab, with the prefixes of the endpoint
  for (const id of urlInputsIn($(`panel-${prefix}`))) showResolved(document, id);
}

// The prefixes that the editors offer: those of the endpoint of their tab,
// then common ones (prefix-completion.js adds those of their text)
setPrefixSource((view) => {
  const tab = (view.dom.dataset.editorFor ?? "").split("-")[0];
  const endpoint = ENDPOINT_TABS.includes(tab) ? endpointOf(tab) : "";
  return [
    ...prefixesOfEndpoint(endpoint).map(([alias, iri]) => [alias, iri, "endpoint"]),
    ...COMMON_PREFIXES.map(([alias, iri]) => [alias, iri, "common"]),
  ];
});

// The menu of each Endpoint field: none (the data of the page), the endpoints
// that rudof knows, or another one, whose URL is written in the field. The
// field has the URL of the endpoint chosen, and is what the tab uses.
function fillEndpointChoices() {
  for (const prefix of ENDPOINT_TABS) {
    $(`${prefix}-endpoint-choice`).replaceChildren(
      new Option("None: the RDF data below", ""),
      ...knownEndpoints.map(([name, url]) => new Option(`${name} (${endpointName(url)})`, url)),
      new Option("Other: write its URL", OTHER_ENDPOINT),
    );
  }
  showEndpointChoices();
}

// The menus say the endpoint of their field
function showEndpointChoices() {
  for (const prefix of ENDPOINT_TABS) {
    const choice = $(`${prefix}-endpoint-choice`);
    const endpoint = endpointOf(prefix);
    if (!endpoint && choice.value === OTHER_ENDPOINT) continue; // to be written
    choice.value = !endpoint ? "" : knownEndpoints.some(([, url]) => url === endpoint) ? endpoint : OTHER_ENDPOINT;
  }
}

for (const prefix of ENDPOINT_TABS) {
  const input = $(`${prefix}-endpoint`);
  $(`${prefix}-endpoint-choice`).addEventListener("change", (e) => {
    const choice = e.currentTarget.value;
    if (choice === OTHER_ENDPOINT) {
      if (knownEndpoints.some(([, url]) => url === input.value.trim())) input.value = "";
      input.focus();
    } else {
      input.value = choice;
    }
    showEndpointUse();
    updatePermalink();
  });
  input.addEventListener("input", showEndpointUse);
  $(`${prefix}-endpoint-data`).addEventListener("change", () => {
    showEndpointUse();
    updatePermalink();
  });
  $(`${prefix}-endpoint`).addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !(e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      run(prefix);
    }
  });
}

// When rudof is loaded: the endpoints it knows are suggested, or the
// validations say why they can't use endpoints.
function setupEndpoints() {
  if (!rudofEndpoints) {
    for (const prefix of ENDPOINT_TABS.filter((p) => p !== "sparql")) {
      const input = $(`${prefix}-endpoint`);
      input.disabled = true;
      $(`${prefix}-endpoint-choice`).disabled = true;
      input.placeholder = "Not available on this page (see at the right)";
      input.closest(".endpoint-row").querySelector(".endpoint-hint").textContent = noEndpoints();
    }
    refreshKnownEndpoints();
    return;
  }
  let known = [];
  try {
    // rudof lists them only when it has data
    const rudof = new rudofModule.Rudof();
    rudof.readData("", "turtle");
    known = rudof.listEndpoints();
  } catch (e) {
    console.info(`rudof did not list its endpoints: ${e.message ?? e}`);
  }
  const byUrl = new Map(rudofKnownEndpoints.map(([name, url]) => [url, name]));
  for (const [name, url] of known) {
    byUrl.set(url, name);
    endpointNames.set(url, name);
  }
  rudofKnownEndpoints = [...byUrl].map(([url, name]) => [name, url]);
  refreshKnownEndpoints();
}

// The endpoints of the menus, by name (Wikidata_qlever: Wikidata qlever),
// and the prefixes of those of the settings
function refreshKnownEndpoints() {
  const byUrl = new Map(rudofKnownEndpoints.map(([name, url]) => [url, name.replace(/_/g, " ")]));
  settingsEndpointPrefixes.clear();
  settingsEndpointLimits.clear();
  let fromSettings = [];
  try {
    fromSettings = settingsEndpoints(settings);
  } catch (e) {
    console.warn(`The endpoints of the settings can't be read: ${e.message ?? e}`);
  }
  for (const [name, url, prefixes, limits] of fromSettings) {
    byUrl.set(url, name);
    settingsEndpointPrefixes.set(url, prefixes);
    settingsEndpointLimits.set(url, limits);
  }
  knownEndpoints = [...byUrl].map(([url, name]) => [name, url]).sort(([a], [b]) => a.localeCompare(b, "en", { sensitivity: "base" }));
  fillEndpointChoices();
  // The prefixes of the endpoints chosen, which rudof or the settings name now
  for (const prefix of ENDPOINT_TABS) showEndpointPrefixes(prefix);
}

// The prefixes of an endpoint, when they are known
const prefixesOfEndpoint = (url) => settingsEndpointPrefixes.get(url) ?? endpointPrefixes.get(url) ?? [];

// The limits of the requests to an endpoint of its own (of the settings, or
// of rudof), which win over those of the settings for all the endpoints
const limitsOfEndpoint = (url) => settingsEndpointLimits.get(url) ?? endpointLimits.get(url) ?? {};

// How validations get the data of the nodes (a setting): SPARQL queries, or
// dereferencing their IRIs. The SPARQL tab always queries the endpoint.
const strategyOf = (prefix) => (prefix === "sparql" ? "sparql" : pageSetting(settings, "endpoint_strategy"));

// The limits that rudof applies to the requests to an endpoint: its own,
// else the settings, else the defaults of rudof (0 ms for localhost). rudof
// waits longer when the endpoint answers 429 Too Many Requests.
function endpointLimitsOf(endpoint) {
  const url = endpointUrlOf(endpoint);
  const general = settingsConfig(settings).rdf ?? {};
  const own = limitsOfEndpoint(url);
  let local = false;
  try {
    local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    // a name
  }
  const pick = (key, fallback) => own[key] ?? (Number.isInteger(general[key]) ? general[key] : fallback);
  return {
    interval: pick("min_request_interval_ms", local ? 0 : 1100),
    concurrent: pick("max_concurrent_requests", 1),
    nodes: pick("max_nodes_per_query", 20),
    own: Object.keys(own).length > 0,
  };
}

// Reads the RDF data of a tab in a session: its data, and the data added to
// it (extra-data.js), merged. With merge, merged with the data the session
// has (the data of an endpoint).
function readTabData(rudof, prefix, merge = false) {
  rudof.readData($(`${prefix}-data`).value, $(`${prefix}-data-format`).value, undefined, undefined, merge);
  for (const { text, format } of extraData(prefix)) rudof.readData(text, format, undefined, undefined, true);
}

// The session of a tab with its data: the RDF data of the tab, or its
// endpoint. On an endpoint, it is a new session, which becomes the session of
// the tab when its result is shown: a session that waits for an endpoint can't
// do anything else, and the endpoint may answer after the tab is run again.
//
// `config` is the configuration of rudof (TOML) for the tab, if it has one,
// and `prefixes` the prefixes of its schema: rudof knows an endpoint given by
// its URL by the name PAGE_ENDPOINT, with these prefixes, which its shape
// maps can use. An endpoint can also be the name of one that rudof knows
// (such as wikidata), with the prefixes that rudof gives it.
// With `fresh`, the session on the RDF data of the tab is a new one too: a
// session that waits for the schemas that a schema imports can't do anything
// else either.
function dataSession(prefix, { config, prefixes, fresh = false } = {}) {
  const endpoint = endpointOf(prefix);
  if (!endpoint) {
    const rudof = fresh ? new rudofModule.Rudof() : session(prefix);
    rudof.resetAll();
    configure(rudof, config);
    readTabData(rudof, prefix);
    return { rudof };
  }
  if (!rudofEndpoints) throw new Error(noEndpoints());
  const byUrl = /^[a-z][\w+.-]*:/i.test(endpoint);
  // The prefixes of the endpoint, and those of the schema, which win
  const all = { ...Object.fromEntries(prefixesOfEndpoint(endpoint)), ...prefixes };
  // With the limits of the requests that the endpoint has, which win over the
  // settings
  const toml = byUrl ? `${config ?? BASE_CONFIG}\n${endpointConfig(endpoint, all, limitsOfEndpoint(endpoint))}` : config;
  const rudof = new rudofModule.Rudof(rudofConfig(toml));
  configStamps.set(rudof, settingsStamp);
  rudof.useEndpoint(byUrl ? PAGE_ENDPOINT : endpoint, strategyOf(prefix), {});
  // The RDF data of the tab too, merged with the data of the endpoint
  if (withData(prefix)) readTabData(rudof, prefix, true);
  return { rudof, endpoint };
}

// The prefixes declared in a schema (PREFIX or @prefix lines: ShExC, ShExR and
// SHACL in Turtle), for the shape maps of validations on endpoints
const schemaPrefixes = (text) => parsePrefixes(text).prefixes;

// The result of a validation: `validate` on the data of the page, or
// `validateAsync` on an endpoint, with `result` to make the result of its report.
function validation({ rudof, endpoint }, validate, validateAsync, result) {
  if (!endpoint) return result(validate());
  return validateAsync().then(
    (report) => {
      const r = result(report);
      return { ...r, verdict: `${r.verdict} on ${endpointName(endpoint)}`, session: rudof };
    },
    (e) => Promise.reject(endpointError(endpoint, e)),
  );
}

// What the result says while rudof gets the schemas that a schema imports
const READING_IMPORTS = "Reading the imported schemas…";

// The base of the relative imports of a schema: the URL of its file, when it
// is the schema of the example of a manifest loaded in the tab
function importBase(validator, text) {
  if (!hasRelativeImports(text)) return undefined;
  // The URL it was read from
  const id = validator === "convert" ? "convert-schema" : "shex-schema";
  if (isUrlSource(id)) return resolvedUrlOf(id);
  if (loadedExample?.validator !== validator) return undefined;
  return loadedExample.example.inputs.schema?.url;
}

// A new session with the settings, for the schemas with imports
function freshSession(config) {
  const rudof = new rudofModule.Rudof(rudofConfig(config));
  configStamps.set(rudof, settingsStamp);
  return rudof;
}

// A promise that the result shows while it waits, with its text
function waiting(promise, text) {
  promise.waiting = text;
  return promise;
}

function validateShex() {
  const start = performance.now();
  const schema = $("shex-schema").value;
  const format = $("shex-schema-format").value;
  // With imports, rudof gets them first (readShexAsync), in a new session
  const imports = hasShexImports(schema, format);
  const data = dataSession("shex", { prefixes: schemaPrefixes(schema), fresh: imports });
  const validate = () => {
    data.rudof.readShapemap($("shex-shapemap").value);
    return validation(data, () => data.rudof.validateShex(), () => data.rudof.validateShexAsync(), (report) => shexResult(report, start));
  };
  if (!imports) {
    data.rudof.readShex(schema, format);
    return validate();
  }
  const read = readShexSchema(data.rudof, schema, format, importBase("shex", schema));
  return waiting(
    read.then(validate).then((result) => ({ ...result, session: data.rudof })),
    READING_IMPORTS,
  );
}

function shexResult(report, start) {
  const millis = performance.now() - start;
  const failed = report.entries.filter((e) => e.status !== "conformant").length;
  return {
    verdict: report.conforms
      ? `Conforms: ${count(report.entries.length, "node")} validated`
      : `Does not conform: ${failed} of ${count(report.entries.length, "node")} failed`,
    kind: report.conforms ? "ok" : "fail",
    millis,
  };
}

// The results of a validation as a table that can be sorted: the details
// that rudof writes as text, with a row of each node and shape. The verdict
// of each row (Status of ShEx, Severity of SHACL) is marked.
const CONFORMS = new Set(["OK", "Conforms"]);

function validationTable(text) {
  const parsed = parseBoxTable(text);
  if (!parsed) return text; // no results: rudof says so in text
  const el = (tag, props = {}, ...children) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children);
    return e;
  };
  const verdict = parsed.header.findIndex((h) => h === "Status" || h === "Severity");
  const details = parsed.header.indexOf("Details");
  const rows = parsed.rows.map((row) =>
    el(
      "tr",
      { className: CONFORMS.has(row[verdict]) ? "ok" : "fail" },
      ...row.map((cell, i) => {
        if (i === verdict) return el("td", { className: "verdict-cell" }, cell);
        if (i === details) return el("td", {}, el("div", { className: "details" }, cell));
        return el("td", {}, el("code", {}, cell));
      }),
    ),
  );
  return makeTableTools(
    el("table", { className: "report" }, el("thead", {}, el("tr", {}, ...parsed.header.map((h) => el("th", {}, h)))), el("tbody", {}, ...rows)),
  );
}

function serializeShex() {
  const format = $("shex-result-format").value;
  if (format === "table") return validationTable(session("shex").serializeShexValidationResults("details"));
  return session("shex").serializeShexValidationResults(format);
}

// DCTAP: rudof converts the profile to ShEx, with the prefixes of the profile
// (dctap.js), and validates with the ShEx schema. Other engines (SHACL) will
// take their own schemas from the profile when rudof can convert it to them.
function dctapSession(name) {
  const rudof = session(name);
  rudof.resetAll();
  return configure(rudof, dctapConfig($("dctap-prefixes").value, { picklistSeparator: $("dctap-picklist").value }));
}

// The ShEx schema (ShExJ) of the profile
function dctapToShex(rudof, format = "shexj") {
  return rudof.convertSchemas($("dctap-schema").value, "dctap", "shex", "csv", format);
}

function validateDctap() {
  const engine = $("dctap-engine").value;
  if (engine !== "shex") throw new Error(`rudof can't convert DCTAP to ${engine.toUpperCase()} yet, so this demo can only validate it with ShEx`);
  const start = performance.now();
  const declarations = $("dctap-prefixes").value;
  const config = dctapConfig(declarations, { picklistSeparator: $("dctap-picklist").value });
  const data = dataSession("dctap", { config, prefixes: { ...BASIC_PREFIXES, ...schemaPrefixes(declarations) } });
  data.rudof.readShex(dctapToShex(data.rudof), "shexj");
  data.rudof.readShapemap($("dctap-shapemap").value);
  return validation(data, () => data.rudof.validateShex(), () => data.rudof.validateShexAsync(), (report) => shexResult(report, start));
}

function serializeDctap() {
  const format = $("dctap-result-format").value;
  if (format === "table") return validationTable(session("dctap").serializeShexValidationResults("details"));
  return session("dctap").serializeShexValidationResults(format);
}

// The profile converted: to ShEx (and what rudof makes from ShEx: diagrams,
// SPARQL queries), or written back as rudof reads it.
function readDctap() {
  const start = performance.now();
  const rudof = dctapSession("dctap-schema");
  rudof.readDctap($("dctap-schema").value, "csv");
  rudof.readShex(dctapToShex(rudof), "shexj");
  return { kind: "ok", millis: performance.now() - start, verdict: dctapVerdict() };
}

function dctapVerdict() {
  return `DCTAP → ${label("dctap-schema-result-format")}`;
}

function serializeDctapSchema() {
  const rudof = session("dctap-schema");
  const format = $("dctap-schema-result-format").value;
  last["dctap-schema"].verdict = dctapVerdict();
  if (format === "internal") return rudof.serializeDctap("internal");
  if (format === "dctap-json") return rudof.serializeDctap("json");
  if (format === "plantuml") return { plantuml: rudof.serializeCurrentShex("plantuml") };
  if (format === "sparql") return rudof.convertSchemas(rudof.serializeCurrentShex("shexj"), "shex", "sparql", "shexj", "internal");
  return rudof.serializeCurrentShex(format);
}

// The configuration of SHACL validation: the recursion semantics, and the
// results that rudof keeps: the errors, and the evidences (why nodes
// conform), of every constraint or of the shapes only.
function shaclConfig() {
  const flag = (id) => String($(id).checked);
  return [
    BASE_CONFIG,
    "[shacl]",
    `recursion_semantics = ${JSON.stringify($("shacl-recursion").value)}`,
    `store_errors = ${flag("shacl-errors")}`,
    `store_evidences = ${flag("shacl-evidences")}`,
    `evidence_shapes_only = ${flag("shacl-evidences-shapes")}`,
    "",
  ].join("\n");
}

// "of shapes only" is about evidences, and the menu of the recursion says
// what its choice means
function showShaclOptions() {
  $("shacl-evidences-shapes").disabled = !$("shacl-evidences").checked;
  const recursion = $("shacl-recursion");
  recursion.title = recursion.selectedOptions[0]?.title ?? "";
}
$("shacl-evidences").addEventListener("change", showShaclOptions);
$("shacl-recursion").addEventListener("change", showShaclOptions);

// The shapes graph is optional: without it, rudof takes the shapes from the
// RDF data (readShacl without shapes)
function shapesOfData() {
  return !$("shacl-shapes").value.trim();
}
function showShapesFromData() {
  $("shacl-shapes-from-data").hidden = !shapesOfData();
}
$("shacl-shapes").addEventListener("input", showShapesFromData);
function shaclShapes() {
  return shapesOfData() ? null : $("shacl-shapes").value;
}

// The target declarations (optional): RDF triples, such as
// :PersonShape sh:targetNode :alice, merged with the shapes graph before the
// validation. rudof reads both as RDF data in a session of their own, and
// reads the merged graph as the shapes.
function hasTargets() {
  return Boolean($("shacl-targets").value.trim());
}
function showTargetsUsed() {
  $("shacl-targets-used").hidden = !hasTargets();
  $("shacl-targets-used").textContent = shapesOfData() ? "Merged with the shapes of the RDF data" : "Merged with the shapes graph";
}
$("shacl-targets").addEventListener("input", showTargetsUsed);
$("shacl-shapes").addEventListener("input", showTargetsUsed);

// Reads the shapes of the SHACL tab in a session: the shapes graph (or the
// shapes of the RDF data), merged with the target declarations
function readShaclShapes(rudof) {
  if (!hasTargets()) {
    rudof.readShacl(shaclShapes(), $("shacl-shapes-format").value);
    return;
  }
  const graph = session("shacl-targets");
  graph.resetAll();
  if (shapesOfData()) readTabData(graph, "shacl");
  else graph.readData($("shacl-shapes").value, $("shacl-shapes-format").value);
  try {
    graph.readData($("shacl-targets").value, $("shacl-targets-format").value, undefined, undefined, true);
  } catch (e) {
    throw new Error(`The target declarations can't be read: ${e.message ?? e}`, { cause: e });
  }
  rudof.readShacl(graph.serializeData("turtle"), "turtle");
}

// What the shapes are, in the verdict, when they are not only the shapes graph
function shapesNote() {
  const parts = [shapesOfData() && "the shapes of the RDF data", hasTargets() && "the target declarations"].filter(Boolean);
  return parts.length ? ` (with ${parts.join(" and ")})` : "";
}
for (const id of ["shacl-recursion", "shacl-errors", "shacl-evidences", "shacl-evidences-shapes"]) $(id).addEventListener("change", updatePermalink);

function validateShacl() {
  const start = performance.now();
  const data = dataSession("shacl", { config: shaclConfig(), prefixes: schemaPrefixes($("shacl-shapes").value) });
  const mode = $("shacl-mode").value;
  readShaclShapes(data.rudof);
  const note = shapesNote();
  return validation(data, () => data.rudof.validateShacl(mode), () => data.rudof.validateShaclAsync(mode), (report) => {
    const result = shaclResult(report, start);
    return { ...result, verdict: result.verdict + note };
  });
}

function shaclResult(report, start) {
  const millis = performance.now() - start;
  const violations = report.entries.filter((e) => e.severity === "Violation").length;
  const others = report.entries.length - violations;
  // Without the errors, rudof doesn't say them
  const errors = $("shacl-errors").checked ? `: ${count(violations, "violation")}${others ? `, ${count(others, "other result")}` : ""}` : "";
  return {
    verdict: report.conforms ? "Conforms" : `Does not conform${errors}`,
    kind: report.conforms ? "ok" : "fail",
    millis,
  };
}

function serializeShacl() {
  const format = $("shacl-result-format").value;
  if (format === "table") return validationTable(session("shacl").serializeShaclValidationResults("details"));
  return session("shacl").serializeShaclValidationResults(format);
}

function validatePgschema() {
  const rudof = session("pgschema");
  const start = performance.now();
  rudof.resetAll();
  rudof.readData($("pgschema-data").value, "pg");
  rudof.readPgschema($("pgschema-schema").value);
  rudof.readTypemap($("pgschema-typemap").value);
  const report = rudof.validatePgschema();
  const millis = performance.now() - start;
  const failed = report.entries.filter((e) => !e.conforms).length;
  return {
    verdict: report.conforms
      ? `Conforms: ${count(report.entries.length, "node or edge", "nodes or edges")} validated`
      : `Does not conform: ${failed} of ${count(report.entries.length, "node or edge", "nodes or edges")} failed`,
    kind: report.conforms ? "ok" : "fail",
    millis,
    report,
  };
}

// A table of the report: one row per node or edge of the type map.
function pgschemaTable(report) {
  const el = (tag, props = {}, ...children) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children);
    return e;
  };
  const rows = report.entries.map((e) =>
    el(
      "tr",
      { className: e.conforms ? "ok" : "fail" },
      el("td", {}, el("code", {}, e.nodeId)),
      el("td", {}, el("code", {}, e.typeName)),
      el("td", { className: "verdict-cell" }, e.conforms ? "✓ conforms" : "✗ fails"),
      el("td", {}, el("div", { className: "details" }, e.details)),
    ),
  );
  return makeTableTools(
    el(
      "table",
      { className: "report" },
      el("thead", {}, el("tr", {}, ...["Id", "Type", "Result", "Details"].map((h) => el("th", {}, h)))),
      el("tbody", {}, ...rows),
    ),
  );
}

function serializePgschema() {
  const format = $("pgschema-result-format").value;
  if (format === "table") return pgschemaTable(last.pgschema.report);
  return session("pgschema").serializePgschemaValidationResults(format);
}

const label = (id) => $(id).selectedOptions[0].text;

function rdfVerdict(triples) {
  const to = label("rdf-result-format").replace(" (PlantUML)", "");
  const more = extraData("rdf").length;
  const from = more ? `${label("rdf-data-format")} and ${count(more, "more RDF data", "more RDF data")}` : label("rdf-data-format");
  return `${count(triples, "triple")}, ${from} → ${to}`;
}

function convertRdf() {
  const rudof = session("rdf");
  const start = performance.now();
  rudof.resetAll();
  readTabData(rudof, "rdf");
  // Counted in N-Triples, one triple per line.
  const triples = rudof.serializeData("ntriples").split("\n").filter((l) => l.trim()).length;
  const millis = performance.now() - start;
  return {
    verdict: rdfVerdict(triples),
    kind: "ok",
    millis,
    triples,
  };
}

function serializeRdf() {
  const format = $("rdf-result-format").value;
  let output = session("rdf").serializeData(format);
  if (format === "plantuml") output = { plantuml: output };
  // The verdict names the output format, which may have just changed.
  last.rdf.verdict = rdfVerdict(last.rdf.triples);
  return output;
}

// Property graph data, written back in YARS-PG or as JSON.
function convertPg() {
  const rudof = session("pg");
  const start = performance.now();
  rudof.resetAll();
  rudof.readData($("pg-data").value, "pg");
  let size = "";
  try {
    const graph = JSON.parse(rudof.serializeData("json"));
    size = `${count(graph.nodes.length, "node")} and ${count(graph.edges.length, "edge")}, `;
  } catch {
    // rudof versions before 0.3.23 don't write property graphs as JSON.
  }
  const millis = performance.now() - start;
  return { size, kind: "ok", millis, verdict: `${size}YARS-PG → ${label("pg-result-format")}` };
}

function serializePg() {
  last.pg.verdict = `${last.pg.size}YARS-PG → ${label("pg-result-format")}`;
  return session("pg").serializeData($("pg-result-format").value);
}

// SPARQL queries. The result formats depend on the kind of query: SELECT gives
// a table of solutions, ASK true or false, CONSTRUCT and DESCRIBE a graph.
const SPARQL_FORMATS = {
  select: [["table", "Table"], ["json", "JSON"], ["csv", "CSV"]],
  ask: [["text", "Text"]],
  graph: [
    ["turtle", "Turtle"],
    ["ntriples", "N-Triples"],
    ["rdfxml", "RDF/XML"],
    ["jsonld", "JSON-LD"],
    ["trig", "TriG"],
    ["n3", "N3"],
    ["nquads", "N-Quads"],
  ],
};

const SPARQL_EXAMPLES = {
  select: `PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?name ?age WHERE {
  ?person a foaf:Person ;
          foaf:name ?name .
  OPTIONAL { ?person foaf:age ?age }
}
ORDER BY ?name`,
  count: `PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?name (COUNT(?friend) AS ?friends) WHERE {
  ?person foaf:name ?name .
  OPTIONAL { ?person foaf:knows ?friend }
}
GROUP BY ?name
ORDER BY DESC(?friends)`,
  ask: `PREFIX foaf: <http://xmlns.com/foaf/0.1/>

ASK { ?person foaf:age ?age FILTER (?age < 18) }`,
  construct: `PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX : <http://example.org/>

CONSTRUCT { ?b :isKnownBy ?a } WHERE { ?a foaf:knows ?b }`,
  describe: `DESCRIBE <http://example.org/carol>`,
};

$("sparql-example").addEventListener("change", (e) => {
  if (!e.target.value) return;
  setInputText("sparql-query", SPARQL_EXAMPLES[e.target.value]);
  e.target.value = "";
  $("sparql-query").focus();
});

function setSparqlFormats(kind) {
  const select = $("sparql-result-format");
  const formats = SPARQL_FORMATS[kind];
  if ([...select.options].map((o) => o.value).join() === formats.map(([v]) => v).join()) return;
  select.replaceChildren(...formats.map(([value, text]) => new Option(text, value)));
  // The format of a permalink, once the query gives results it has
  if (formats.some(([value]) => value === pendingSparqlFormat)) {
    select.value = pendingSparqlFormat;
    pendingSparqlFormat = undefined;
  }
}

function sparqlVerdict(results) {
  if (results.kind === "select") return count(results.rows.length, "result");
  if (results.kind === "ask") return `ASK: ${results.boolean}`;
  return count(results.graph.split("\n").filter((l) => l.trim()).length, "triple");
}

// A query on the data of the page, or on an endpoint through rudof. The
// prefixes of the results are those of the data, or of the query.
function runSparql() {
  const endpoint = endpointOf("sparql");
  if (endpoint && !rudofEndpoints) {
    if (withData("sparql")) {
      throw new Error(`Querying an endpoint with the RDF data of the page needs rudof with endpoints. ${noEndpoints()} The page can query the endpoint alone, without the RDF data.`);
    }
    return runSparqlOnEndpoint(endpoint);
  }
  const start = performance.now();
  const query = $("sparql-query").value;
  const data = dataSession("sparql");
  data.rudof.readQuery(query);
  const result = (results) => {
    const millis = performance.now() - start;
    setSparqlFormats(results.kind);
    if (!endpoint) return { verdict: sparqlVerdict(results), kind: "ok", millis, results, prefixes: dataPrefixes(data.rudof) };
    const verdict = `${sparqlVerdict(results)} from ${endpointName(endpoint)}`;
    return { verdict, kind: "ok", millis, results, prefixes: queryPrefixes(query), session: data.rudof };
  };
  if (!endpoint) return result(data.rudof.runQuery());
  return data.rudof.runQueryAsync().then(result, (e) => Promise.reject(endpointError(endpoint, e)));
}

// A query that the page sends to an endpoint itself (see endpoint.js), when
// rudof can't. Its graphs are read with rudof, and written in N-Triples, as
// rudof gives the graphs of local queries.
async function runSparqlOnEndpoint(endpoint) {
  const query = $("sparql-query").value;
  const start = performance.now();
  const results = await queryEndpoint(endpoint, query, pageFetch);
  const millis = performance.now() - start;
  if (results.kind === "graph") {
    const rudof = session("sparql-endpoint");
    rudof.resetAll();
    rudof.readData(results.text, results.format);
    results.graph = rudof.serializeData("ntriples");
  }
  setSparqlFormats(results.kind);
  const verdict = `${sparqlVerdict(results)} from ${new URL(endpoint).host}`;
  return { verdict, kind: "ok", millis, results, prefixes: queryPrefixes(query) };
}

// The prefixes declared in the loaded data, as [alias, IRI] pairs, read from
// its Turtle serialization.
function dataPrefixes(rudof) {
  return [...rudof.serializeData("turtle").matchAll(/^@prefix ([^:\s]*): <([^>]*)> \.$/gm)].map((m) => [m[1], m[2]]);
}

const XSD = "http://www.w3.org/2001/XMLSchema#";

// An RDF term (as rudof writes it: <iri>, "literal"@lang, "literal"^^<type>,
// _:blank) shown as a reader would write it: IRIs as prefixed names when a
// prefix of the data matches, literals by their value with a note for a
// language or an unusual datatype. The full term is the tooltip.
function termCell(term, prefixes) {
  const td = document.createElement("td");
  if (term == null) return td;
  const qualify = (iri) => {
    for (const [alias, ns] of [...prefixes, ["xsd", XSD]]) {
      if (iri.startsWith(ns) && /^[\w-]*$/.test(iri.slice(ns.length))) return `${alias}:${iri.slice(ns.length)}`;
    }
    return `<${iri}>`;
  };
  let text = term;
  let note = "";
  const iri = term.match(/^<(.*)>$/s);
  const literal = term.match(/^"(.*)"(?:@([\w-]+)|\^\^<(.*)>)?$/s);
  if (iri) {
    text = qualify(iri[1]);
  } else if (literal) {
    text = literal[1].replace(/\\(["\\])/g, "$1").replace(/\\n/g, "\n");
    const [, , lang, datatype] = literal;
    const plain = ["string", "integer", "decimal", "double", "boolean"].map((t) => XSD + t);
    if (lang) note = `@${lang}`;
    else if (datatype && !plain.includes(datatype)) note = qualify(datatype);
  }
  const code = Object.assign(document.createElement("code"), { textContent: text, title: term });
  // Sorted by the value, without its note
  td.dataset.sort = text;
  td.append(code);
  if (note) td.append(" ", Object.assign(document.createElement("span"), { className: "term-note", textContent: note }));
  return td;
}

// Solutions of a SELECT query as a table; unbound values are left empty.
function sparqlTable({ variables, rows }, prefixes) {
  const el = (tag, props = {}, ...children) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children);
    return e;
  };
  return makeTableTools(
    el(
      "table",
      { className: "report solutions" },
      el("thead", {}, el("tr", {}, ...variables.map((v) => el("th", {}, v)))),
      el(
        "tbody",
        {},
        ...rows.map((row) => el("tr", {}, ...row.map((value) => termCell(value, prefixes)))),
      ),
    ),
  );
}

function serializeSparql() {
  const { results, prefixes } = last.sparql;
  const format = $("sparql-result-format").value;
  if (results.kind === "select") {
    if (format === "table") return sparqlTable(results, prefixes);
    // The results of an endpoint, as it gave them
    if (results.json) return format === "csv" ? solutionsCsv(results.json) : JSON.stringify(results.json, null, 2);
    return session("sparql").serializeQueryResults(format);
  }
  if (results.kind === "ask") return String(results.boolean);
  // The graph of CONSTRUCT and DESCRIBE, written with the prefixes of the data.
  const declarations = prefixes.map(([alias, iri]) => `prefix ${alias}: <${iri}>\n`).join("");
  const graph = session("sparql-graph");
  graph.resetAll();
  graph.readData(declarations + results.graph, "turtle");
  return graph.serializeData(format);
}

// Schemas converted to other formats (and diagrams), in their own sessions so
// that validation results are kept.
const schemaInput = { shex: "shex-schema-format", shacl: "shacl-shapes-format" };

function schemaVerdict(language) {
  return `${label(schemaInput[language])} → ${label(`${language}-schema-result-format`)}`;
}

function readSchema(language) {
  const rudof = session(`${language}-schema`);
  const start = performance.now();
  rudof.resetAll();
  if (language === "shex") {
    const schema = $("shex-schema").value;
    const format = $("shex-schema-format").value;
    if (hasShexImports(schema, format)) {
      // With its imports, in a new session (see validateShex)
      const fresh = freshSession();
      const result = () => ({ kind: "ok", millis: performance.now() - start, verdict: schemaVerdict(language), session: fresh });
      return waiting(readShexSchema(fresh, schema, format, importBase("shex", schema)).then(result), READING_IMPORTS);
    }
    rudof.readShex(schema, format);
  } else {
    // The shapes of the RDF data, when there is no shapes graph
    if (shapesOfData()) readTabData(rudof, "shacl");
    readShaclShapes(rudof);
  }
  return { kind: "ok", millis: performance.now() - start, verdict: schemaVerdict(language) };
}

// SHACL shapes converted to ShEx (ShExJ), through Turtle.
function shaclToShex(format) {
  const turtle = session("shacl-schema").serializeShacl("turtle");
  return session("shacl-convert").convertSchemas(turtle, "shacl", "shex", "turtle", format);
}

function serializeSchema(language) {
  const rudof = session(`${language}-schema`);
  const format = $(`${language}-schema-result-format`).value;
  last[`${language}-schema`].verdict = schemaVerdict(language);
  if (language === "shex") {
    if (format === "plantuml") return { plantuml: rudof.serializeCurrentShex("plantuml") };
    if (format === "sparql") {
      return rudof.convertSchemas(rudof.serializeCurrentShex("shexj"), "shex", "sparql", "shexj", "internal");
    }
    return rudof.serializeCurrentShex(format);
  }
  // SHACL
  if (format === "shexc") return shaclToShex("shexc");
  if (format === "plantuml") {
    const shex = session("shacl-shex");
    shex.resetAll();
    shex.readShex(shaclToShex("shexj"), "shexj");
    return { plantuml: shex.serializeCurrentShex("plantuml") };
  }
  return rudof.serializeShacl(format);
}

const validators = {
  convert: { validate: readConvertSource, serialize: serializeConversion },
  shex: { validate: validateShex, serialize: serializeShex },
  shacl: { validate: validateShacl, serialize: serializeShacl },
  dctap: { validate: validateDctap, serialize: serializeDctap },
  "dctap-schema": { validate: readDctap, serialize: serializeDctapSchema },
  pgschema: { validate: validatePgschema, serialize: serializePgschema },
  rdf: { validate: convertRdf, serialize: serializeRdf },
  pg: { validate: convertPg, serialize: serializePg },
  sparql: { validate: runSparql, serialize: serializeSparql },
};
// PGSchema has one syntax, PGSchemaC, which rudof can't write yet.
for (const language of ["shex", "shacl"]) {
  validators[`${language}-schema`] = { validate: () => readSchema(language), serialize: () => serializeSchema(language) };
}

// Data tabs: copy the result, or use it as the new input.
const CONVERTERS = ["rdf", "pg"];

function updateConvertButtons() {
  updateConvertSchemaButtons();
  for (const prefix of CONVERTERS) {
    const converted = Boolean(last[prefix]) && !crashed;
    const format = $(`${prefix}-result-format`).value;
    $(`${prefix}-copy`).disabled = !converted;
    // Only data in a format that can be read back
    $(`${prefix}-use-as-input`).disabled = !converted || format === "plantuml" || (prefix === "pg" && format === "json");
  }
}

for (const prefix of CONVERTERS) {
  const output = () => $(`${prefix}-result`).querySelector(".output").textContent;
  $(`${prefix}-copy`).addEventListener("click", async (e) => {
    const button = e.currentTarget;
    try {
      await navigator.clipboard.writeText(output());
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy failed";
    }
    setTimeout(() => (button.textContent = "Copy"), 1500);
  });
  $(`${prefix}-use-as-input`).addEventListener("click", () => {
    // The result has the RDF data added to the tab already
    if (prefix === "rdf") clearExtraData("rdf");
    setInputText(`${prefix}-data`, output());
    if (prefix === "rdf") {
      $("rdf-data-format").value = $("rdf-result-format").value;
      // The editor highlights the data in its new format
      $("rdf-data-format").dispatchEvent(new Event("change"));
    }
    $(`${prefix}-data`).focus();
  });
}


// The last run of each tab, so that only its result is shown (a query on an
// endpoint takes a while, and can be run again meanwhile).
const running = {};

// ---------------------------------------------------------------------------
// What the runs on endpoints ask the endpoints (endpoint-log.js): under the
// verdict, how many queries were sent and how long the run takes, with
// Details (the queries and the answers) and Stop.


// The URL of an endpoint, also of one that rudof knows by its name
function endpointUrlOf(endpoint) {
  if (/^[a-z][\w+.-]*:/i.test(endpoint)) return endpoint;
  return [...knownEndpoints, ...rudofKnownEndpoints].find(([name]) => name === endpoint || name.replace(/_/g, " ") === endpoint)?.[1] ?? endpoint;
}

// The view of the queries in the result of a tab: the progress, the limits
// of the requests, and the table of the queries. While the run waits, the
// result shows it; then the switch "Result | Queries" of the result does.
function queriesViewOf(prefix) {
  const box = $(`${prefix}-result`);
  let view = box.querySelector(".queries-view");
  if (view) return view;
  const el = (tag, props = {}, ...children) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children);
    return e;
  };
  const stop = el("button", { type: "button", className: "link queries-stop", title: "Stop waiting for the endpoint: the queries that wait are aborted" }, "Stop");
  const options = el("button", { type: "button", className: "link queries-options", title: "The limits of the requests to endpoints, in the settings" }, "Options");
  options.addEventListener("click", () => settingsDialog?.open("endpoints"));
  view = el(
    "div",
    { className: "queries-view" },
    el("div", { className: "queries-progress" }, el("span", { className: "queries-summary" }), stop),
    el("div", { className: "queries-limits" }, el("span", {}), options),
    el("div", { className: "queries-table" }),
  );
  box.querySelector(".result-head").after(view);
  // The switch of the views, in the head of the result
  const button = (name, text) => {
    const b = el("button", { type: "button" }, text);
    b.dataset.view = name;
    return b;
  };
  const toResult = button("result", "Result");
  const toQueries = button("queries", "Queries");
  const viewSwitch = el("div", { className: "view-switch queries-switch", hidden: true }, toResult, toQueries);
  viewSwitch.setAttribute("role", "group");
  viewSwitch.setAttribute("aria-label", "Result or queries to the endpoint");
  viewSwitch.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) showView(prefix, b.dataset.view);
  });
  box.querySelector(".result-head .timing").before(viewSwitch);
  return view;
}

// Shows the result of a tab, or the queries of its run
function showView(prefix, name) {
  const box = $(`${prefix}-result`);
  if (name === "queries") box.dataset.view = "queries";
  else delete box.dataset.view;
  for (const b of box.querySelectorAll(".queries-switch button")) b.setAttribute("aria-pressed", String(b.dataset.view === (name === "queries" ? "queries" : "result")));
}

// Starts the log of a run of a tab on its endpoint, shown in its result.
// `onStop`: when the user stops it, with the number of queries that wait for
// an answer.
function showEndpointLog(prefix, endpoint, onStop) {
  const view = queriesViewOf(prefix);
  const box = $(`${prefix}-result`);
  const viewSwitch = box.querySelector(".queries-switch");
  viewSwitch.hidden = true;
  showView(prefix, "queries");
  let frame;
  const draw = (log) => {
    frame = undefined;
    if (currentLogs[prefix] !== log) return; // the tab runs again
    const running = log.end === undefined;
    let summary = logSummary(log);
    if (log.rudofCount !== undefined && log.rudofCount !== log.entries.length) {
      summary += ` (rudof counted ${log.rudofCount}: the list can have queries of other tabs)`;
    }
    view.querySelector(".queries-summary").textContent = summary;
    view.querySelector(".queries-stop").hidden = !running;
    // The limits of rudof (the page sends the query of the SPARQL tab itself
    // when rudof can't)
    const limits = endpointLimitsOf(endpoint);
    const strategy = (strategyOf(prefix) === "dereference" ? " · the RDF of the IRIs of the nodes (dereference)" : "") + shaclFetchText(prefix);
    view.querySelector(".queries-limits span").textContent = rudofEndpoints
      ? `Limits: ${limitsText(limits)}${strategy}${limits.own ? ` (those of ${endpointName(endpoint)})` : ""}`
      : "The page sends the query to the endpoint itself.";
    view.querySelector(".queries-options").hidden = !rudofEndpoints;
    // The request that has the focus keeps it
    const focused = view.contains(document.activeElement) ? document.activeElement.dataset?.n : undefined;
    view.querySelector(".queries-table").replaceChildren(renderQueries(document, log));
    if (focused !== undefined) view.querySelector(`tr.query-row[data-n="${focused}"]`)?.focus();
    viewSwitch.querySelector('[data-view="queries"]').textContent = `Queries (${log.entries.length})`;
    if (running && box.dataset.kind === "running") box.querySelector(".timing").textContent = logTime(log);
  };
  const log = startLog(endpointUrlOf(endpoint), {
    onChange: (l) => {
      frame ??= requestAnimationFrame(() => draw(l));
    },
  });
  currentLogs[prefix] = log;
  // The time, while it waits
  const ticker = setInterval(() => log.end === undefined && draw(log), 500);
  view.querySelector(".queries-stop").onclick = () => {
    const waiting = log.entries.filter((e) => e.millis === undefined).length;
    // rudof goes on until it gives up (log.finish), without sending requests
    log.stop();
    clearInterval(ticker);
    viewSwitch.hidden = false;
    onStop(waiting);
  };
  const finish = log.finish;
  log.finish = () => {
    clearInterval(ticker);
    finish();
    if (currentLogs[prefix] !== log) return;
    draw(log);
    // Then the result (the queries, when the user stopped the run), and the
    // switch between them
    viewSwitch.hidden = false;
    if (!log.stopped) showView(prefix, "result");
  };
  draw(log);
  return log;
}

// How SHACL gets the data of the endpoint (the settings of [shacl])
function shaclFetchText(prefix) {
  if (prefix !== "shacl") return "";
  const shacl = settingsConfig(settings).shacl ?? {};
  if (shacl.fetch_strategy !== "by-shape") return " · SHACL: node by node";
  return ` · SHACL: shape by shape, ${shacl.prefetch_batch_size ?? 50} nodes per query, ${shacl.prefetch_max_rounds ?? 16} shape references deep`;
}

function hideEndpointLog(prefix) {
  delete currentLogs[prefix];
  const box = $(`${prefix}-result`);
  showView(prefix, "result");
  const viewSwitch = box.querySelector(".queries-switch");
  if (viewSwitch) viewSwitch.hidden = true;
}

async function run(prefix) {
  if (!rudofModule || crashed) return;
  const { validate, serialize } = validators[prefix];
  const token = (running[prefix] = {});
  // A stopped run of the tab ends first (at most STOPPING_WAIT): its
  // requests and those of the new run can't be told apart
  const previous = currentLogs[prefix];
  if (previous && isStopping(previous)) {
    showResult(prefix, { verdict: "Stopping the previous run…", kind: "running", output: "" });
    await Promise.race([previous.finished, new Promise((resolve) => setTimeout(resolve, STOPPING_WAIT))]);
    if (running[prefix] !== token) return;
  }
  // A run on an endpoint has its log
  // (with rudof with endpoints, or the SPARQL tab, which sends the query)
  const endpoint = ENDPOINT_TABS.includes(prefix) && (rudofEndpoints || prefix === "sparql") && endpointOf(prefix);
  const log = endpoint
    ? showEndpointLog(prefix, endpoint, (waiting) => {
        if (running[prefix] !== token) return;
        running[prefix] = {};
        delete last[prefix];
        showResult(prefix, {
          verdict: "Stopped",
          kind: "error",
          output: `The run on ${endpointName(endpoint)} was stopped${waiting ? `, with ${waiting} ${waiting === 1 ? "query" : "queries"} waiting for an answer` : ""}. Queries has the queries that were sent.`,
        });
        updateConvertButtons();
      })
    : hideEndpointLog(prefix);
  try {
    // The inputs of the tab given by URLs (with the prefixes of its endpoint)
    const panel = $(`${prefix}-result`).closest('[role="tabpanel"]');
    if (urlInputsIn(panel).length) {
      showResult(prefix, { verdict: "Reading the inputs from their URLs…", kind: "running", output: "" });
      const tab = prefix.split("-")[0];
      if (ENDPOINT_TABS.includes(tab) && endpointOf(tab)) await readEndpointPrefixes(endpointUrlOf(endpointOf(tab)));
      await readUrlInputs(document, panel);
      if (running[prefix] !== token) return;
    }
    if (endpoint) showResult(prefix, { verdict: `Waiting for ${endpointName(endpoint)}…`, kind: "running", output: "" });
    // The limits of an endpoint that rudof knows are in its TOML file, read
    // with its prefixes
    if (endpoint && rudofEndpoints) {
      await readEndpointPrefixes(endpointUrlOf(endpoint));
      if (running[prefix] !== token) return;
    }
    let result = validate();
    if (result instanceof Promise) {
      if (!endpoint) showResult(prefix, { verdict: result.waiting ?? "Waiting for the endpoint…", kind: "running", output: "" });
      result = await result;
      if (running[prefix] !== token) return;
    }
    // The session that ran on an endpoint has the results now, and the
    // number of requests it sent (rudof can't say it while it waits)
    if (log && result.session?.requestCount) log.rudofCount = Number(result.session.requestCount());
    if (result.session) {
      sessions[prefix] = result.session;
      delete result.session;
    }
    last[prefix] = result;
    last[prefix].verdict += expectation(prefix, last[prefix].kind);
    const output = serialize();
    showResult(prefix, { ...last[prefix], output });
  } catch (e) {
    if (running[prefix] !== token) return;
    delete last[prefix];
    showError(prefix, e);
  } finally {
    log?.finish();
  }
  updateConvertButtons();
  updatePermalink();
}

function reformat(prefix) {
  if (!last[prefix] || crashed) return;
  try {
    const output = validators[prefix].serialize();
    showResult(prefix, { ...last[prefix], output });
  } catch (e) {
    showError(prefix, e);
  }
  updateConvertButtons();
  updatePermalink();
}

for (const prefix of Object.keys(validators)) {
  $(`${prefix}-validate`).addEventListener("click", () => run(prefix));
  $(`${prefix}-result-format`).addEventListener("change", () => reformat(prefix));
  $(`panel-${prefix}`)?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      run(prefix);
    }
  });
}

// ---------------------------------------------------------------------------
// Manifests
//
// ?manifestURL=<url> lists the examples of a manifest (see manifest.js) above
// the tabs, and ?example=<n> loads the n-th one (from 1), unless the URL has
// the inputs too (a permalink of the example, maybe edited). An example is
// loaded in the tab of its action (data, validate, query or schema), and waits for
// the button of the tab (Validate, Run query, Convert). manifest.js, with its
// YAML parser, is only loaded then.

// The example loaded last, and the text it put in each input, to compare the
// result with the one the manifest expects while the inputs are unchanged.
let loadedExample;
let choosing;

function manifestNote(parts, kind = "") {
  const note = $("manifest-note");
  note.className = `manifest-note ${kind}`.trim();
  note.replaceChildren(...parts);
  note.hidden = parts.length === 0;
}

const STATUS_MARKS = { conformant: "✓ ", nonconformant: "✗ " };

function exampleOption(example) {
  const text = `${STATUS_MARKS[example.status] ?? ""}${example.label}${example.unsupported ? " (not supported)" : ""}`;
  const option = new Option(text, String(example.index));
  option.disabled = Boolean(example.unsupported);
  option.title = example.unsupported ? `This example ${example.unsupported}. ${example.hint ?? ""}`.trim() : (example.dataLabel ?? "");
  return option;
}

// The examples that can't be run, and why: below the list, closed until the
// user opens it. Each one has the reason, a hint, a link to the help page,
// and the entry as the demo read it.
function showProblems(examples) {
  const problems = examples.filter((e) => e.unsupported);
  const box = $("manifest-problems");
  box.hidden = problems.length === 0;
  if (!problems.length) return;
  const el = (tag, props = {}, ...children) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children);
    return e;
  };
  box.querySelector("summary").textContent =
    problems.length === 1 ? "Why 1 example can't be run" : `Why ${problems.length} examples can't be run`;
  box.querySelector("ul").replaceChildren(
    ...problems.map((example) =>
      el(
        "li",
        { id: `manifest-problem-${example.index + 1}` },
        el("p", { className: "problem-title" }, el("strong", {}, example.label), ` (entry ${example.index + 1}${example.sections?.length ? `, in ${example.sections.join(" › ")}` : ""}${example.group ? `, ${example.group}` : ""})`),
        el("p", { className: "problem-reason" }, `This example ${example.unsupported}.`),
        el(
          "p",
          { className: "problem-hint" },
          example.hint ?? "",
          example.help ? " " : "",
          ...(example.help ? [el("a", { href: `help.html#${example.help}`, target: "_blank", rel: "noopener" }, "Help")] : []),
        ),
        el("details", { className: "problem-source" }, el("summary", {}, "The entry in the manifest"), el("pre", {}, example.source)),
      ),
    ),
  );
}

async function loadManifest(manifestURL) {
  $("manifest").hidden = false;
  const link = $("manifest-link");
  link.textContent = manifestURL;
  // The page with only the manifest (choosing an example adds its inputs
  // to the URL), to start again from the list of examples
  const home = $("manifest-home");
  home.href = `${location.pathname}?${queryString([["manifestURL", manifestURL]])}`;
  home.title = `Open ${home.href.replace(location.origin, "")} again, without the inputs of an example`;
  const select = $("manifest-examples");
  let manifest;
  let examples;
  let tree;
  try {
    const url = new URL(manifestURL, location.href).href;
    link.href = url;
    manifest = await import("./manifest.js");
    const text = await manifest.defaultFetchText(url);
    // Which rudof is loaded says whether examples can validate endpoints
    await rudofLoaded;
    tree = manifest.parseSections(text, url, { endpoints: rudofEndpoints });
    examples = tree.examples;
  } catch (e) {
    select.options[0].text = "No examples";
    manifestNote([`Could not load the manifest: ${e.message ?? e}`], "error");
    return;
  }
  showProblems(examples);
  const n = Number(params.get("example"));
  const first = Number.isInteger(n) && examples[n - 1] && !examples[n - 1].unsupported ? examples[n - 1] : undefined;
  if (tree.hasSections) {
    // The sections, which open and close, instead of the menu
    select.hidden = true;
    showSections(manifest, tree.tree, first);
  } else {
    const items = manifest.groupExamples(examples).flatMap(({ name, examples }) => {
      const options = examples.map(exampleOption);
      if (!name) return options;
      const group = Object.assign(document.createElement("optgroup"), { label: name });
      group.append(...options);
      return [group];
    });
    select.replaceChildren(new Option(`Choose one of ${count(examples.length, "example")}…`, ""), ...items);
    select.disabled = false;
    select.addEventListener("change", () => {
      if (select.value) chooseExample(manifest, examples[Number(select.value)]);
    });
    if (first) select.value = String(first.index);
  }
  if (first && !hasState(params)) chooseExample(manifest, first);
}

// The examples of a manifest with sections: a tree of sections, which open
// and close with a click on their titles, and of examples, which load with a
// click. The sections are closed, but those of the example of the URL.
function showSections(manifest, tree, chosen) {
  const el = (tag, props = {}, ...children) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children);
    return e;
  };
  const box = $("manifest-sections");
  const examplesIn = (items) => items.reduce((n, item) => n + (item.example ? 1 : examplesIn(item.section.items)), 0);
  const itemOf = (item) => {
    if (item.example) {
      const example = item.example;
      const button = el(
        "button",
        { type: "button", className: "manifest-example", disabled: Boolean(example.unsupported) },
        `${STATUS_MARKS[example.status] ?? ""}${example.label}${example.unsupported ? " (not supported)" : ""}`,
      );
      button.dataset.index = String(example.index);
      button.title = example.unsupported ? `This example ${example.unsupported}. ${example.hint ?? ""}`.trim() : (example.dataLabel ?? "");
      button.addEventListener("click", () => {
        markChosen(example);
        chooseExample(manifest, example);
      });
      return el("li", {}, button);
    }
    const { title, comment, items } = item.section;
    const n = examplesIn(items);
    const details = el(
      "details",
      { className: "manifest-section" },
      el("summary", {}, el("span", { className: "section-title" }, title), el("span", { className: "section-count" }, count(n, "example"))),
    );
    if (comment) details.append(el("p", { className: "section-comment" }, comment));
    details.append(el("ul", {}, ...items.map(itemOf)));
    return el("li", {}, details);
  };
  const list = box.querySelector(".manifest-tree");
  list.replaceChildren(...tree.map(itemOf));
  // The example chosen: marked, and its sections open
  const markChosen = (example) => {
    for (const b of list.querySelectorAll(".manifest-example")) {
      const current = Boolean(example) && b.dataset.index === String(example.index);
      b.classList.toggle("chosen", current);
      if (current) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    }
    const button = example && list.querySelector(`.manifest-example[data-index="${example.index}"]`);
    for (let d = button?.closest("details"); d; d = d.parentElement.closest("details")) d.open = true;
  };
  markChosen(chosen);
  const all = (open) => () => {
    for (const d of list.querySelectorAll("details")) d.open = open;
  };
  $("manifest-expand").onclick = all(true);
  $("manifest-collapse").onclick = all(false);
  box.hidden = false;
}

// Puts the inputs of an example in the editors, and shows its tab.
async function chooseExample(manifest, example) {
  const token = (choosing = {});
  manifestNote([`Loading “${example.label}”…`]);
  let inputs;
  try {
    inputs = await manifest.loadExample(example);
  } catch (e) {
    if (choosing === token) manifestNote([`Could not load “${example.label}”: ${e.message ?? e}`], "error");
    return;
  }
  if (choosing !== token) return; // another example was chosen meanwhile
  // The prefix of the ids of the tab (the Schema tab has a target for each
  // language), and the selects that go before the inputs
  const { tab, validator = example.target, selects = {} } = manifest.TARGETS[example.target];
  for (const [id, value] of Object.entries(selects)) {
    $(id).value = value;
    $(id).dispatchEvent(new Event("change"));
  }
  for (const { textarea, text, formatSelect, format } of inputs) {
    const select = formatSelect && $(formatSelect);
    if (select && [...select.options].some((o) => o.value === format)) {
      select.value = format;
      // The editor highlights the text in its format
      select.dispatchEvent(new Event("change"));
    }
    setInputText(textarea, text);
  }
  showEndpointUse();
  // The result of the inputs before is not the result of these. The result
  // of a conversion stays next to its input, and waits for the button again.
  delete last[validator];
  const box = $(`${validator}-result`);
  if (box.classList.contains("converted")) {
    showResult(validator, { verdict: `Press ${$(`${validator}-validate`).textContent}`, output: "" });
    delete box.dataset.kind;
    updateConvertButtons();
  } else {
    box.hidden = true;
  }
  // The data of the example replaces the RDF data added to the tab
  if (DATA_TABS.includes(validator)) clearExtraData(validator);
  const endpointData = $(`${validator}-endpoint-data`);
  if (endpointData) endpointData.checked = false;
  loadedExample = { example, validator, texts: inputs.map(({ textarea }) => [textarea, $(textarea).value]) };

  const url = new URL(location.href);
  url.searchParams.set("example", String(example.index + 1));
  url.hash = tab;
  history.replaceState(null, "", url);
  selectTabFromHash();
  updatePermalink();

  const parts = [];
  if (example.status) {
    parts.push(Object.assign(document.createElement("span"), { className: "expected", textContent: `Expected: ${example.status}.` }), " ");
  }
  if (example.comment) parts.push(example.comment);
  for (const note of example.notes) parts.push("\n", note);
  manifestNote(parts);
}

// Whether a validation gives the result the manifest expects, while the inputs
// are those of the example: appended to the verdict.
function expectation(prefix, kind) {
  const status = loadedExample?.example.status;
  if (!status || loadedExample.validator !== prefix) return "";
  if (loadedExample.texts.some(([id, text]) => $(id).value !== text)) return "";
  const result = kind === "ok" ? "conformant" : "nonconformant";
  return result === status ? " (as the manifest expects)" : ` (the manifest expects ${status})`;
}

if (params.has("manifestURL")) loadManifest(params.get("manifestURL"));

// ---------------------------------------------------------------------------
// Loading

// The dialog of the settings, once rudof can check them. Saving them gives
// the sessions the new configuration, and the endpoints of the settings to
// the menus.
function setupSettings() {
  settingsDialog = setupSettingsDialog({
    dialog: $("settings"),
    opener: $("settings-open"),
    badge: $("settings-badge"),
    getSettings: () => settings,
    preview: (s) => configWithSettings(BASE_CONFIG, s),
    check: (s) => rudofModule.RudofConfig.fromToml(configWithSettings(BASE_CONFIG, s)),
    onSave: (s) => {
      settings = s;
      settingsStamp += 1;
      saveSettings(localStorageOrNone(), s);
      refreshKnownEndpoints();
    },
  });
  $("settings-open").disabled = false;
  for (const prefix of ENDPOINT_TABS) $(`${prefix}-endpoint-options`).addEventListener("click", () => settingsDialog.open("endpoints"));
}

// A module of rudof, initialized
async function loadRudof(url) {
  const module = await import(/* @vite-ignore */ url);
  await module.default();
  return module;
}

try {
  let url = RUDOF_ENDPOINTS_MODULE;
  if (HAS_JSPI) {
    try {
      rudofModule = await loadRudof(url);
    } catch (e) {
      endpointsError = `${e.name ?? "Error"}: ${e.message ?? e}`;
      console.warn(`rudof with endpoints could not be loaded from ${url}:`, e);
    }
  }
  if (!rudofModule) {
    url = RUDOF_MODULE;
    rudofModule = await loadRudof(url);
  }
  rudofEndpoints = typeof rudofModule.Rudof.prototype.useEndpoint === "function";
  // The requests of rudof to endpoints are logged (endpoint-log.js)
  rudofModule.setFetch?.(pageFetch);
  // The version reported by the loaded module, not the one requested
  const version = new rudofModule.Rudof().getVersion();
  setStatus("ready", `rudof ${version} ready${rudofEndpoints ? ", with endpoints" : ""}`);
  // About says the version of rudof that the page uses
  $("about-rudof-version").textContent = `${version}${rudofEndpoints ? ", with endpoints" : ""}`;
  $("status").title = `@rudof/rudof from ${url}` + (endpointsError ? `\n(rudof with endpoints could not be loaded: ${endpointsError})` : "");
  for (const b of document.querySelectorAll('button[id$="-validate"]')) b.disabled = false;
  setupEndpoints();
  setupSettings();
} catch (e) {
  console.error(e);
  setStatus("error", `Could not load rudof: ${e.message ?? e}`);
} finally {
  markRudofLoaded();
}
