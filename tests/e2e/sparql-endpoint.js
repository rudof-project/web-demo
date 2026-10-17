// A SPARQL endpoint for the browser tests: it answers the queries of the page
// (or of rudof in the page) on some RDF data, with the SPARQL 1.1 protocol.
// rudof, in Node.js, runs the queries; their results are given as SPARQL JSON
// results (SELECT, ASK) or Turtle (CONSTRUCT, DESCRIBE).

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Rudof } = require("@rudof/rudof");

const unescape = (s) => s.replace(/\\(["\\nrt])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t" })[c] ?? c);

// A term, as rudof writes it, in SPARQL JSON results
export function bindingOf(term) {
  const iri = term.match(/^<(.*)>$/s);
  if (iri) return { type: "uri", value: iri[1] };
  if (term.startsWith("_:")) return { type: "bnode", value: term.slice(2) };
  const literal = term.match(/^"(.*)"(?:@([\w-]+)|\^\^<(.*)>)?$/s);
  if (!literal) throw new Error(`not a term: ${term}`);
  const [, value, lang, datatype] = literal;
  return { type: "literal", value: unescape(value), ...(lang && { "xml:lang": lang }), ...(datatype && { datatype }) };
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

// Answers the requests to `url` with the data. Returns the queries it got.
export async function sparqlEndpoint(page, url, data) {
  const rudof = new Rudof();
  rudof.readData(data, "turtle");
  const queries = [];
  await page.route(`${url}**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const query = new URL(request.url()).searchParams.get("query") ?? new URLSearchParams(request.postData() ?? "").get("query");
    queries.push(query);
    let results;
    try {
      rudof.readQuery(query);
      results = rudof.runQuery();
    } catch (e) {
      return route.fulfill({ status: 400, body: String(e.message ?? e), headers: { ...CORS, "content-type": "text/plain" } });
    }
    if (results.kind === "graph") return route.fulfill({ body: results.graph, headers: { ...CORS, "content-type": "text/turtle" } });
    const json =
      results.kind === "ask"
        ? { head: {}, boolean: results.boolean }
        : {
            head: { vars: results.variables.map((v) => v.replace(/^\?/, "")) },
            results: {
              bindings: results.rows.map((row) =>
                Object.fromEntries(row.flatMap((term, i) => (term == null ? [] : [[results.variables[i].replace(/^\?/, ""), bindingOf(term)]]))),
              ),
            },
          };
    return route.fulfill({ json, headers: { ...CORS, "content-type": "application/sparql-results+json" } });
  });
  return queries;
}
