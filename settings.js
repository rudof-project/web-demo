// The settings of rudof that the user changes (the gear of the header): the
// configuration of rudof (rudof.toml, see the configuration reference of
// rudof) that applies to every operation of the page.
//
// SETTINGS lists the settings that change what rudof does in the page, by
// sections. Any other setting can be written as TOML (`toml`), such as
// endpoints of [rdf.endpoints.<name>], with their prefixes. The browser keeps
// the settings (only those that differ from the defaults).
//
// The configuration of each operation is its own (the base IRI of the page,
// the prefixes of a DCTAP profile, the options of SHACL…) with the settings
// over it (configWithSettings).

import { parse, stringify } from "smol-toml";
import { COMMON_PREFIXES } from "./prefixes.js";

const COLORS = ["black", "white", "gray", "red", "green", "blue", "yellow", "cyan", "light_blue", "light_green", "light_coral"];
const colorOptions = COLORS.map((c) => [c, c.replace("_", " ")]);

// Tables that rudof reads whole: a setting of one of them writes all of it,
// with rudof's defaults for the others (those of rudof 0.3.27)
export const GROUPS = {
  "shex2uml.class_skin": { background_color: "light_blue", border_color: "black", arrow_color: "black" },
  "rdf.visualization.uri_style": { line_color: "blue", line_thickness: 1, background_color: "white", round_corner: 25 },
  "rdf.visualization.bnode_style": { line_color: "blue", line_thickness: 1, background_color: "gray", round_corner: 25 },
  "rdf.visualization.literal_style": { line_color: "black", line_thickness: 1, background_color: "cyan", round_corner: 0 },
};

// A color of a table of GROUPS
const groupColor = (group, key, label) => ({
  key: `${group}.${key}`,
  label,
  type: "select",
  default: GROUPS[group][key],
  options: colorOptions,
  group,
});

// Each setting: its key in the configuration (a path of keys), its label,
// its type (boolean, number, text, iri, char, select), its default, and help.
// A number can have a minimum (min). The settings with `page` are not in the
// configuration of rudof: the page uses them (pageSetting).
export const SETTINGS = [
  {
    title: "General",
    settings: [
      { key: "base_iri", label: "Base IRI", type: "iri", default: "", help: "The base of relative IRIs in data and schemas (http://base/ when empty)." },
      { key: "rdf.pretty_json", label: "Indent JSON and JSON-LD results", type: "boolean", default: true },
    ],
  },
  {
    title: "Endpoints",
    id: "endpoints",
    settings: [
      {
        key: "rdf.min_request_interval_ms",
        label: "Milliseconds between two requests",
        type: "number",
        default: "",
        placeholder: "1100",
        help: "The least time between two requests to an endpoint (0: no wait). Empty: 1100 ms, and 0 for localhost. rudof waits longer when an endpoint answers 429 Too Many Requests. Public endpoints such as Wikidata keep their own limit.",
      },
      {
        key: "rdf.max_concurrent_requests",
        label: "Requests at the same time",
        type: "number",
        min: 1,
        default: "",
        placeholder: "1",
        help: "When rudof gets the nodes of a shape map before it validates them. Empty: 1.",
      },
      {
        key: "rdf.max_nodes_per_query",
        label: "Nodes in one query",
        type: "number",
        min: 1,
        default: "",
        placeholder: "20",
        help: "The nodes of a shape map that one query gets (VALUES). 1: a query for each node. Empty: 20.",
      },
      {
        key: "endpoint_strategy",
        page: true,
        label: "How validations get the data of the nodes",
        type: "select",
        default: "sparql",
        options: [["sparql", "SPARQL queries to the endpoint"], ["dereference", "The RDF of the IRIs of the nodes (dereference)"]],
        help: "Dereference gets each IRI as Turtle: its server must allow other sites to read it (CORS), and this https page can't read http: IRIs. SPARQL queries always use the endpoint.",
      },
      {
        key: "shacl.fetch_strategy",
        label: "How SHACL gets the data of an endpoint",
        type: "select",
        default: "on-demand",
        options: [["on-demand", "Node by node, when the validation needs it"], ["by-shape", "Shape by shape, before the validation"]],
        help: "By shape gets the data of many focus nodes in one query: far fewer requests when there are many focus nodes.",
      },
      {
        key: "shacl.prefetch_batch_size",
        label: "SHACL by shape: nodes in one query",
        type: "number",
        min: 1,
        default: "",
        placeholder: "50",
        help: "Empty: 50.",
      },
      {
        key: "shacl.prefetch_max_rounds",
        label: "SHACL by shape: depth of the data fetched before",
        type: "number",
        default: "",
        placeholder: "16",
        help: "How many shape references deep, from the shapes with targets, the data is fetched before the validation. Deeper data is fetched when the validation needs it. Empty: 16.",
      },
    ],
  },
  {
    title: "ShEx validation",
    settings: [
      { key: "shex_validator.max_steps", label: "Maximum number of steps", type: "number", default: "", help: "Validation stops after these steps (no limit when empty)." },
      { key: "shex_validator.check_negation", label: "Check the negation requirement", type: "boolean", default: true },
    ],
  },
  {
    title: "UML diagrams (from ShEx)",
    settings: [
      { key: "shex2uml.direction", label: "Direction", type: "select", default: "top_to_bottom", options: [["top_to_bottom", "Top to bottom"], ["left_to_right", "Left to right"]] },
      { key: "shex2uml.line_type", label: "Lines", type: "select", default: "default", options: [["default", "Default"], ["orthogonal", "Orthogonal"], ["polyline", "Polyline"]] },
      { key: "shex2uml.shadowing", label: "Shadows", type: "boolean", default: true },
      { key: "shex2uml.replace_iri", label: "Replace IRIs by their labels", type: "boolean", default: false },
      {
        key: "shex2uml.annotation_label",
        label: "Properties of the labels",
        type: "iris",
        default: [],
        help: "The annotations of shapes and properties that are their labels: IRIs or prefixed names (rdfs:label when empty).",
      },
      groupColor("shex2uml.class_skin", "background_color", "Background of shapes"),
      groupColor("shex2uml.class_skin", "border_color", "Border of shapes"),
      groupColor("shex2uml.class_skin", "arrow_color", "Arrows"),
    ],
  },
  {
    title: "RDF diagrams",
    settings: [
      groupColor("rdf.visualization.uri_style", "background_color", "Background of IRIs"),
      groupColor("rdf.visualization.uri_style", "line_color", "Border of IRIs"),
      groupColor("rdf.visualization.bnode_style", "background_color", "Background of blank nodes"),
      groupColor("rdf.visualization.bnode_style", "line_color", "Border of blank nodes"),
      groupColor("rdf.visualization.literal_style", "background_color", "Background of literals"),
      groupColor("rdf.visualization.literal_style", "line_color", "Border of literals"),
    ],
  },
  {
    title: "SPARQL queries (from ShEx)",
    settings: [{ key: "shex2sparql.this_variable_name", label: "Variable of the focus node", type: "text", default: "this" }],
  },
  {
    title: "SHACL to ShEx",
    settings: [
      { key: "shacl2shex.add_target_class", label: "Add the target classes as rdf:type", type: "boolean", default: false },
      { key: "shacl2shex.embed_bnodes", label: "Embed the shapes that are blank nodes", type: "boolean", default: false },
    ],
  },
  {
    title: "DCTAP",
    settings: [
      { key: "tap.delimiter", label: "Delimiter of columns", type: "char", default: "," },
      { key: "tap.quote", label: "Quote", type: "char", default: '"' },
      { key: "tap.flexible", label: "Rows can have fewer or more cells", type: "boolean", default: true },
      { key: "tap.value_shape_delimiter", label: "Delimiter of value shapes", type: "char", default: " ", help: "A space by default." },
      { key: "tap2shex.datatype_base_iri", label: "Base of datatypes", type: "iri", default: "", help: "The base of the datatypes of valueDataType that are not prefixed names." },
    ],
  },
];

export const ALL_SETTINGS = SETTINGS.flatMap((section) => section.settings);
const byKey = new Map(ALL_SETTINGS.map((s) => [s.key, s]));

// The sections of rudof that read IRIs, which take the base IRI: rudof only
// gives them the top-level base_iri when they have none
const BASE_SECTIONS = ["rdf", "shex", "service"];

export const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

// `over` over `under`, table by table: a new object
export function mergeConfig(under, over) {
  const merged = { ...under };
  for (const [key, value] of Object.entries(over)) {
    merged[key] = isObject(value) && isObject(merged[key]) ? mergeConfig(merged[key], value) : value;
  }
  return merged;
}

function setPath(object, path, value) {
  const keys = path.split(".");
  let table = object;
  for (const key of keys.slice(0, -1)) table = table[key] ??= {};
  table[keys.at(-1)] = value;
}

// A value of a setting, as written in the form (text), in its type; or
// an error
export function settingValue(setting, text) {
  if (setting.type === "boolean") return Boolean(text);
  const value = String(text ?? "");
  if (setting.type === "number") {
    if (value.trim() === "") return "";
    const n = Number(value);
    const min = setting.min ?? 0;
    if (!Number.isInteger(n) || n < min) throw new Error(`${setting.label}: write a whole number${min ? ` from ${min}` : ""}, or leave it empty`);
    return n;
  }
  if (setting.type === "char" && [...value].length !== 1) throw new Error(`${setting.label}: write one character`);
  if (setting.type === "iris") return iris(setting, value);
  if (setting.type === "iri" && value.trim()) {
    try {
      new URL(value.trim());
    } catch {
      throw new Error(`${setting.label}: "${value}" is not an IRI`);
    }
    return value.trim();
  }
  return value;
}

// IRIs, or prefixed names of the common prefixes, separated by spaces or
// commas: their IRIs
const PREFIXES = new Map(COMMON_PREFIXES);

function iris(setting, text) {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((name) => {
      const wrong = () => new Error(`${setting.label}: "${name}" is not an IRI, nor a prefixed name of a common prefix`);
      const prefixed = name.match(/^([A-Za-z][\w.-]*):(.*)$/);
      let iri = name.replace(/^<(.*)>$/, "$1");
      if (iri === name && prefixed && PREFIXES.has(prefixed[1])) iri = PREFIXES.get(prefixed[1]) + prefixed[2];
      else if (iri === name && !/^(https?:\/\/|urn:)/i.test(name)) throw wrong();
      try {
        new URL(iri);
      } catch {
        throw wrong();
      }
      return iri;
    });
}

// The settings that differ from their defaults: { values: { key: value }, toml }
export const emptySettings = () => ({ values: {}, toml: "" });

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function changedValues(values) {
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => byKey.has(key) && !same(value, byKey.get(key).default)));
}

// The configuration of the settings, as an object of TOML tables: the
// settings of the form, then the TOML, over them
export function settingsConfig({ values = {}, toml = "" } = {}) {
  const config = {};
  const changed = changedValues(values);
  for (const [key, value] of Object.entries(changed)) {
    if (key === "base_iri") {
      for (const section of BASE_SECTIONS) setPath(config, `${section}.base_iri`, value);
      continue;
    }
    if (value === "") continue; // empty: rudof's default
    if (byKey.get(key).page) continue; // not for rudof
    setPath(config, key, value);
  }
  // The tables that rudof reads whole
  for (const [group, defaults] of Object.entries(GROUPS)) {
    const members = ALL_SETTINGS.filter((s) => s.group === group);
    if (!members.some((s) => s.key in changed)) continue;
    const table = { ...defaults };
    for (const s of members) table[s.key.slice(group.length + 1)] = changed[s.key] ?? s.default;
    setPath(config, group, table);
  }
  return toml.trim() ? mergeConfig(config, parse(toml)) : config;
}

// The configuration of an operation (TOML) with the settings over it (TOML)
export function configWithSettings(toml, settings) {
  return stringify(mergeConfig(parse(toml), settingsConfig(settings)));
}

// A setting of the page (`page`): its value, or its default
export function pageSetting(settings, key) {
  return changedValues(settings?.values ?? {})[key] ?? byKey.get(key).default;
}

// The limits of the requests to an endpoint, in its description
// ([rdf.endpoints.<name>] of a configuration, or the TOML file of an endpoint
// that rudof knows): { min_request_interval_ms, … }, the numbers only
export const LIMIT_KEYS = ["min_request_interval_ms", "max_concurrent_requests", "max_nodes_per_query"];

export function limitsOf(description) {
  return Object.fromEntries(LIMIT_KEYS.filter((key) => Number.isInteger(description?.[key]) && description[key] >= 0).map((key) => [key, description[key]]));
}

// The endpoints of the settings ([rdf.endpoints.<name>] of the TOML):
// [name, url, prefixes as [alias, iri], limits]
export function settingsEndpoints(settings) {
  const endpoints = settingsConfig(settings).rdf?.endpoints ?? {};
  return Object.entries(endpoints)
    .filter(([, e]) => isObject(e) && typeof e.query_url === "string")
    .map(([key, e]) => [
      String(e.name ?? key),
      e.query_url,
      Object.entries(isObject(e.prefixmap) ? e.prefixmap : {}).filter(([, iri]) => typeof iri === "string"),
      limitsOf(e),
    ]);
}

// The settings kept in the browser
export const SETTINGS_KEY = "rudof-demo-settings";

export function loadSettings(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? "null");
    if (saved && typeof saved === "object") return { values: changedValues(saved.values ?? {}), toml: String(saved.toml ?? "") };
  } catch {
    // not kept, or not readable
  }
  return emptySettings();
}

export function saveSettings(storage, settings) {
  const kept = { values: changedValues(settings.values), toml: settings.toml };
  try {
    if (!Object.keys(kept.values).length && !kept.toml.trim()) storage?.removeItem(SETTINGS_KEY);
    else storage?.setItem(SETTINGS_KEY, JSON.stringify(kept));
  } catch {
    // not kept
  }
}

// How many settings differ from the defaults
export function changedCount(settings) {
  return Object.keys(changedValues(settings.values)).length + (settings.toml.trim() ? 1 : 0);
}
