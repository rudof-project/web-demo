// Permalinks: the inputs and options of the tab shown, in the query of the
// URL, e.g. ?schema=…&data=…&shape-map=…#validate/shex. demo.js writes them
// after each operation, and reads them when the page opens.

// The parameters of each tab, and the id of the input or select each one is
// read from and written to. The tab is in the fragment of the URL; a URL
// without one is for the tab its parameters are for (see panelOfParams).
export const PANELS = {
  rdf: {
    section: "data",
    params: { data: "rdf-data", "data-format": "rdf-data-format", "result-format": "rdf-result-format" },
  },
  pg: {
    section: "data",
    params: { data: "pg-data", "result-format": "pg-result-format" },
  },
  shex: {
    section: "validate",
    params: {
      schema: "shex-schema",
      data: "shex-data",
      "shape-map": "shex-shapemap",
      "schema-format": "shex-schema-format",
      "data-format": "shex-data-format",
      "result-format": "shex-result-format",
      "schema-result-format": "shex-schema-result-format",
    },
  },
  shacl: {
    section: "validate",
    params: {
      shapes: "shacl-shapes",
      data: "shacl-data",
      "shapes-format": "shacl-shapes-format",
      "data-format": "shacl-data-format",
      mode: "shacl-mode",
      "result-format": "shacl-result-format",
      "schema-result-format": "shacl-schema-result-format",
    },
  },
  pgschema: {
    section: "validate",
    params: { schema: "pgschema-schema", data: "pgschema-data", "type-map": "pgschema-typemap", "result-format": "pgschema-result-format" },
  },
  sparql: {
    section: "query",
    params: { data: "sparql-data", "data-format": "sparql-data-format", query: "sparql-query", "result-format": "sparql-result-format" },
  },
};

// Parameters that are not inputs, kept as they are.
export const KEPT_PARAMS = ["manifestURL", "example"];

const STATE_PARAMS = new Set(Object.values(PANELS).flatMap((p) => Object.keys(p.params)));

// Whether the parameters have inputs or options of a tab.
export function hasState(params) {
  return [...params.keys()].some((name) => STATE_PARAMS.has(name));
}

// The tab of parameters without a fragment: the first one with a parameter
// only it has, or the RDF converter for data alone. Links of shex.js
// (?schema=…&data=…&shape-map=…) open the ShEx tab.
const DISTINCTIVE = [["shape-map", "shex"], ["shapes", "shacl"], ["type-map", "pgschema"], ["query", "sparql"], ["schema", "shex"], ["data", "rdf"]];

export function panelOfParams(params) {
  return DISTINCTIVE.find(([name]) => params.has(name))?.[1];
}

// The parameters of a tab, as [name, value] pairs, with the values read by
// `read(id)`, followed by the kept parameters of `current`.
export function stateParams(panel, read, current = new URLSearchParams()) {
  const pairs = Object.entries(PANELS[panel].params).map(([name, id]) => [name, read(id)]);
  for (const name of KEPT_PARAMS) if (current.has(name)) pairs.push([name, current.get(name)]);
  return pairs;
}

// The query of a URL with these parameters. Spaces are written %20 and not
// +, as encodeURIComponent writes them, which reads better in a URL.
export function queryString(pairs) {
  return pairs.map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join("&");
}

// The parameters of a tab given in `params`, as [id, value] pairs.
export function inputsOfParams(panel, params) {
  return Object.entries(PANELS[panel].params).filter(([name]) => params.has(name)).map(([name, id]) => [id, params.get(name)]);
}
