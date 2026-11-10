// Permalinks: the inputs and options of the tab shown, in the query of the
// URL, e.g. ?schema=…&data=…&shape-map=…#validate/shex. demo.js writes them
// after each operation, and reads them when the page opens.
//
// Servers refuse URLs that are too long (414 URI Too Long), and the inputs
// of a tab can be long (the schemas of Generate). When the query is longer
// than PACK_OVER characters, the inputs go in one parameter, z: their query,
// compressed (deflate) and written in base64url. The kept parameters (the
// manifest and its example) stay as they are.

import { deflateSync, inflateSync, strToU8, strFromU8 } from "fflate";

// The parameters of each tab, and the id of the input or select each one is
// read from and written to. The tab is in the fragment of the URL; a URL
// without one is for the tab its parameters are for (see panelOfParams).
export const PANELS = {
  convert: {
    section: "schema",
    params: {
      "schema-language": "convert-language",
      "schema-format": "convert-format",
      schema: "convert-schema",
      prefixes: "convert-prefixes",
      picklist: "convert-picklist",
      to: "convert-to",
      "to-format": "convert-result-format",
    },
  },
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
      endpoint: "shex-endpoint",
      "endpoint-data": "shex-endpoint-data",
      "schema-format": "shex-schema-format",
      "data-format": "shex-data-format",
      "result-format": "shex-result-format",
      "read-triples": "shex-read-triples",
      "read-triples-format": "shex-read-triples-format",
      "schema-result-format": "shex-schema-result-format",
    },
  },
  shacl: {
    section: "validate",
    params: {
      shapes: "shacl-shapes",
      data: "shacl-data",
      endpoint: "shacl-endpoint",
      "endpoint-data": "shacl-endpoint-data",
      "shapes-format": "shacl-shapes-format",
      targets: "shacl-targets",
      "targets-format": "shacl-targets-format",
      "data-format": "shacl-data-format",
      mode: "shacl-mode",
      recursion: "shacl-recursion",
      errors: "shacl-errors",
      evidences: "shacl-evidences",
      "evidences-shapes": "shacl-evidences-shapes",
      "read-triples": "shacl-read-triples",
      "read-triples-format": "shacl-read-triples-format",
      "result-format": "shacl-result-format",
      "schema-result-format": "shacl-schema-result-format",
    },
  },
  dctap: {
    section: "validate",
    params: {
      dctap: "dctap-schema",
      prefixes: "dctap-prefixes",
      picklist: "dctap-picklist",
      data: "dctap-data",
      endpoint: "dctap-endpoint",
      "endpoint-data": "dctap-endpoint-data",
      "shape-map": "dctap-shapemap",
      "data-format": "dctap-data-format",
      engine: "dctap-engine",
      "result-format": "dctap-result-format",
      "schema-result-format": "dctap-schema-result-format",
    },
  },
  pgschema: {
    section: "validate",
    params: { schema: "pgschema-schema", data: "pgschema-data", "type-map": "pgschema-typemap", "result-format": "pgschema-result-format" },
  },
  gen: {
    section: "generate",
    params: {
      "schema-format": "gen-language",
      schema: "gen-schema",
      config: "gen-config",
      entities: "gen-entities",
      seed: "gen-seed",
      "result-format": "gen-result-format",
    },
  },
  sparql: {
    section: "query",
    params: {
      data: "sparql-data",
      "data-format": "sparql-data-format",
      query: "sparql-query",
      endpoint: "sparql-endpoint",
      "endpoint-data": "sparql-endpoint-data",
      "result-format": "sparql-result-format",
    },
  },
  "compare-data": {
    section: "compare",
    params: {
      kind: "compare-data-kind",
      data: "compare-data-1",
      "data-format": "compare-data-1-format",
      data2: "compare-data-2",
      "data2-format": "compare-data-2-format",
      mode: "compare-data-mode",
      "result-format": "compare-data-result-format",
    },
  },
  "compare-schemas": {
    section: "compare",
    params: {
      "schema-language": "compare-schemas-language",
      schema: "compare-schemas-1",
      "schema-format": "compare-schemas-1-format",
      shape: "compare-schemas-1-label",
      schema2: "compare-schemas-2",
      "schema2-format": "compare-schemas-2-format",
      shape2: "compare-schemas-2-label",
    },
  },
};

// Parameters that are not inputs, kept as they are.
export const KEPT_PARAMS = ["manifestURL", "example"];

const STATE_PARAMS = new Set(Object.values(PANELS).flatMap((p) => Object.keys(p.params)));

// The parameter of an input given by a URL (input-source.js): schema-url…
export const urlParam = (name) => `${name}-url`;
const baseName = (name) => (name.endsWith("-url") && STATE_PARAMS.has(name.slice(0, -4)) ? name.slice(0, -4) : name);

// Whether the parameters have inputs or options of a tab.
export function hasState(params) {
  return params.has(PACKED_PARAM) || [...params.keys()].some((name) => STATE_PARAMS.has(baseName(name)));
}

// Long permalinks: the parameter of the compressed inputs, and the length of
// the query from which they are compressed
export const PACKED_PARAM = "z";
export const PACK_OVER = 2000;

function toBase64url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// A text compressed, in base64url, and back
export const packText = (text) => toBase64url(deflateSync(strToU8(text), { level: 9 }));
export const unpackText = (packed) => strFromU8(inflateSync(fromBase64url(packed)));

// The query of a permalink with these parameters ([name, value]): as it is,
// or with the inputs compressed when it is long
export function permalinkQuery(pairs) {
  const query = queryString(pairs);
  if (query.length <= PACK_OVER) return query;
  const kept = pairs.filter(([name]) => KEPT_PARAMS.includes(name));
  const inputs = pairs.filter(([name]) => !KEPT_PARAMS.includes(name));
  return queryString([[PACKED_PARAM, packText(queryString(inputs))], ...kept]);
}

// The parameters of a permalink, with its compressed inputs expanded.
// Throws when they can't be read (a link cut, or changed).
export function unpackParams(params) {
  if (!params.has(PACKED_PARAM)) return params;
  const expanded = new URLSearchParams(unpackText(params.get(PACKED_PARAM)));
  for (const [name, value] of params) if (name !== PACKED_PARAM) expanded.append(name, value);
  return expanded;
}

// The tab of parameters without a fragment: the first one with a parameter
// only it has, or the RDF converter for data alone. Links of shex.js
// (?schema=…&data=…&shape-map=…) open the ShEx tab.
const DISTINCTIVE = [["data2", "compare-data"], ["schema2", "compare-schemas"], ["to", "convert"], ["dctap", "dctap"], ["shape-map", "shex"], ["shapes", "shacl"], ["type-map", "pgschema"], ["query", "sparql"], ["endpoint", "sparql"], ["schema", "shex"], ["data", "rdf"]];

export function panelOfParams(params) {
  const names = new Set([...params.keys()].map(baseName));
  return DISTINCTIVE.find(([name]) => names.has(name))?.[1];
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
