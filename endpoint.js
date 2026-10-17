// SPARQL queries on remote endpoints, with the SPARQL 1.1 protocol, for the
// browsers where rudof can't reach endpoints: rudof built with endpoints needs
// JSPI, which only some browsers have (see RUDOF_ENDPOINTS_MODULE in demo.js).
// There, the page sends the query itself, and gives the results in the form
// of the results of rudof:
//
//   { kind: "select", variables: ["?x", …], rows: [["<iri>" | "\"v\"@en" | …]] }
//   { kind: "ask", boolean }
//   { kind: "graph", text, format }   (CONSTRUCT and DESCRIBE)
//
// Select and ask results also keep the SPARQL JSON results of the endpoint
// (json). The endpoint must allow other sites to query it (CORS), as
// Wikidata does.

// The name of the endpoint that the page describes to rudof (endpointConfig)
export const PAGE_ENDPOINT = "page";

// The configuration of rudof (TOML) that describes an endpoint with its
// prefixes, so that the shape maps of validations on the endpoint can use the
// prefixes of the schema (the data of an endpoint has no prefixes). Appended
// to a configuration with its [rdf] section, such as BASE_CONFIG of dctap.js.
export function endpointConfig(endpoint, prefixes = {}) {
  const url = endpointURL(endpoint).href;
  const toml = JSON.stringify;
  return [
    `[rdf.endpoints.${PAGE_ENDPOINT}]`,
    `name = ${toml(PAGE_ENDPOINT)}`,
    `query_url = ${toml(url)}`,
    "",
    `[rdf.endpoints.${PAGE_ENDPOINT}.prefixmap]`,
    ...Object.entries(prefixes).map(([alias, iri]) => `${toml(alias)} = ${toml(iri)}`),
    "",
  ].join("\n");
}

export const KNOWN_ENDPOINTS = [
  ["Wikidata", "https://query.wikidata.org/sparql"],
  ["DBpedia", "https://dbpedia.org/sparql"],
  ["UniProt", "https://sparql.uniprot.org/sparql"],
];

// Results of SELECT and ASK in JSON, and graphs in Turtle or N-Triples.
export const ACCEPT = [
  "application/sparql-results+json",
  "text/turtle;q=0.9",
  "application/n-triples;q=0.8",
  "application/rdf+xml;q=0.5",
  "application/ld+json;q=0.5",
].join(", ");

// The RDF formats of rudof, by the media types of the graphs.
const GRAPH_TYPES = {
  "text/turtle": "turtle",
  "application/x-turtle": "turtle",
  "application/n-triples": "ntriples",
  "text/plain": "ntriples",
  "application/rdf+xml": "rdfxml",
  "application/ld+json": "jsonld",
  "application/n-quads": "nquads",
  "application/trig": "trig",
};

// Longer queries are sent with POST: servers limit the length of URLs.
const MAX_GET_URL = 2000;

// The URL of an endpoint, or an error that says what is wrong with it.
export function endpointURL(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error(`"${endpoint}" is not the URL of an endpoint`);
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`"${endpoint}" is not an http or https URL`);
  return url;
}

// The request of a query: GET, or POST with the query in a form (neither
// needs a CORS preflight request).
export function queryRequest(endpoint, query) {
  const url = endpointURL(endpoint);
  url.searchParams.append("query", query);
  const headers = { Accept: ACCEPT };
  if (url.href.length <= MAX_GET_URL) return { url: url.href, init: { method: "GET", headers } };
  return {
    url: endpointURL(endpoint).href,
    init: {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ query }).toString(),
    },
  };
}

const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
const RDF_LANG_STRING = "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString";

const escapeLiteral = (value) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");

// An RDF term of SPARQL JSON results, written as rudof writes it.
export function termOf(binding) {
  if (binding == null) return null;
  const { type, value } = binding;
  if (type === "uri") return `<${value}>`;
  if (type === "bnode") return `_:${value}`;
  // "literal", and "typed-literal" of SPARQL 1.0 endpoints
  const lang = binding["xml:lang"];
  if (lang) return `"${escapeLiteral(value)}"@${lang}`;
  const datatype = binding.datatype;
  if (datatype && datatype !== XSD_STRING && datatype !== RDF_LANG_STRING) return `"${escapeLiteral(value)}"^^<${datatype}>`;
  return `"${escapeLiteral(value)}"`;
}

// The results of SELECT and ASK, from their SPARQL JSON results.
export function resultsOfJson(json) {
  if (typeof json?.boolean === "boolean") return { kind: "ask", boolean: json.boolean, json };
  const vars = json?.head?.vars;
  const bindings = json?.results?.bindings;
  if (!Array.isArray(vars) || !Array.isArray(bindings)) throw new Error("the endpoint did not answer with SPARQL results");
  return {
    kind: "select",
    variables: vars.map((v) => `?${v}`),
    rows: bindings.map((solution) => vars.map((v) => termOf(solution[v]))),
    json,
  };
}

// Solutions as CSV, as in SPARQL 1.1 Query Results CSV: IRIs and literals
// by their value, blank nodes as _:id.
export function solutionsCsv(json) {
  const vars = json.head.vars;
  const cell = (binding) => {
    if (binding == null) return "";
    const value = binding.type === "bnode" ? `_:${binding.value}` : binding.value;
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  const lines = [vars.join(","), ...json.results.bindings.map((s) => vars.map((v) => cell(s[v])).join(","))];
  return `${lines.join("\r\n")}\r\n`;
}

// The prefixes declared in a query, as [alias, IRI] pairs.
export function queryPrefixes(query) {
  return [...query.matchAll(/^\s*PREFIX\s+([\w-]*):\s*<([^>]*)>/gim)].map((m) => [m[1], m[2]]);
}

const unreachable = (host) =>
  `Could not reach ${host}. Is the endpoint online, and does it allow other sites to query it (CORS)? ` +
  "A page served with https can't query an http endpoint.";

const answered = (host, status, detail) => `${host} answered ${status}`.trim() + (detail ? `:\n${detail}` : "");

// An error of rudof with an endpoint, said as queryEndpoint says it: rudof
// says "HTTP request failed: TypeError: Failed to fetch" for any network
// error, and gives the whole URL of the request when the endpoint answers
// with an error.
export function endpointError(endpoint, error) {
  const message = String(error?.message ?? error);
  let host = endpoint;
  try {
    host = new URL(endpoint).host;
  } catch {
    // a name of an endpoint that rudof knows
  }
  if (/Failed to fetch|NetworkError|Load failed/.test(message)) return new Error(unreachable(host), { cause: error });
  const status = message.match(/failed with status (\d+)(?:: ([\s\S]*))?$/);
  if (status) return new Error(answered(host, status[1], (status[2] ?? "").trim().slice(0, 2000)), { cause: error });
  return error;
}

const mediaType = (response) => (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

// Runs a query on an endpoint.
export async function queryEndpoint(endpoint, query, fetchFn = fetch) {
  const { url, init } = queryRequest(endpoint, query);
  const host = new URL(url).host;
  let response;
  try {
    response = await fetchFn(url, init);
  } catch (e) {
    // fetch says only "Failed to fetch", whatever the reason
    throw new Error(unreachable(host), { cause: e });
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim().slice(0, 2000);
    throw new Error(answered(host, `${response.status} ${response.statusText}`, detail));
  }
  const type = mediaType(response);
  if (type.includes("json") && type !== "application/ld+json") return resultsOfJson(await response.json());
  const format = GRAPH_TYPES[type];
  if (format) return { kind: "graph", text: await response.text(), format };
  // Some endpoints don't say the type of their answer
  const text = await response.text();
  if (/^\s*\{/.test(text)) return resultsOfJson(JSON.parse(text));
  return { kind: "graph", text, format: "turtle" };
}
