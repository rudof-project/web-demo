// SPARQL queries on endpoints (endpoint.js): the requests, and the results in
// the form of the results of rudof.

import { describe, it, expect, vi } from "vitest";
import { ACCEPT, endpointURL, queryRequest, termOf, resultsOfJson, solutionsCsv, queryPrefixes, queryEndpoint } from "../../endpoint.js";

const ENDPOINT = "https://query.wikidata.org/sparql";
const XSD = "http://www.w3.org/2001/XMLSchema#";

const SELECT_JSON = {
  head: { vars: ["item", "label", "n"] },
  results: {
    bindings: [
      {
        item: { type: "uri", value: "http://www.wikidata.org/entity/Q42" },
        label: { type: "literal", value: "Douglas Adams", "xml:lang": "en" },
        n: { type: "literal", value: "42", datatype: `${XSD}integer` },
      },
      { item: { type: "bnode", value: "b0" }, label: { type: "literal", value: 'say "hi",\nbye' } },
    ],
  },
};

function response(body, type, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": type } });
}

describe("requests", () => {
  it("sends short queries with GET, asking for JSON results or RDF", () => {
    const { url, init } = queryRequest(ENDPOINT, "ASK {}");
    expect(url).toBe(`${ENDPOINT}?query=ASK+%7B%7D`);
    expect(init).toEqual({ method: "GET", headers: { Accept: ACCEPT } });
    expect(ACCEPT).toMatch(/^application\/sparql-results\+json/);
  });

  it("keeps the parameters of the endpoint URL", () => {
    expect(queryRequest("https://example.org/sparql?default-graph-uri=g", "ASK {}").url).toBe("https://example.org/sparql?default-graph-uri=g&query=ASK+%7B%7D");
  });

  it("sends long queries with POST, in a form", () => {
    const query = `SELECT * WHERE { ?s ?p "${"x".repeat(3000)}" }`;
    const { url, init } = queryRequest(ENDPOINT, query);
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(new URLSearchParams(init.body).get("query")).toBe(query);
  });

  it("refuses what is not an http or https URL", () => {
    expect(() => endpointURL("wikidata")).toThrow(/not the URL/);
    expect(() => endpointURL("ftp://example.org/sparql")).toThrow(/http or https/);
  });
});

describe("results", () => {
  it("writes the terms as rudof does", () => {
    expect(termOf({ type: "uri", value: "http://e/a" })).toBe("<http://e/a>");
    expect(termOf({ type: "bnode", value: "b1" })).toBe("_:b1");
    expect(termOf({ type: "literal", value: "Alice", "xml:lang": "en" })).toBe('"Alice"@en');
    expect(termOf({ type: "literal", value: "23", datatype: `${XSD}integer` })).toBe(`"23"^^<${XSD}integer>`);
    expect(termOf({ type: "typed-literal", value: "x", datatype: `${XSD}string` })).toBe('"x"');
    expect(termOf({ type: "literal", value: 'a "b"\\\n' })).toBe('"a \\"b\\"\\\\\\n"');
    expect(termOf(undefined)).toBeNull();
  });

  it("reads the solutions of SELECT, with unbound values as null", () => {
    const results = resultsOfJson(SELECT_JSON);
    expect(results.kind).toBe("select");
    expect(results.variables).toEqual(["?item", "?label", "?n"]);
    expect(results.rows).toEqual([
      ["<http://www.wikidata.org/entity/Q42>", '"Douglas Adams"@en', `"42"^^<${XSD}integer>`],
      ["_:b0", '"say \\"hi\\",\\nbye"', null],
    ]);
    expect(results.json).toBe(SELECT_JSON);
  });

  it("reads the answer of ASK", () => {
    expect(resultsOfJson({ head: {}, boolean: false })).toMatchObject({ kind: "ask", boolean: false });
  });

  it("refuses JSON that is not SPARQL results", () => {
    expect(() => resultsOfJson({ error: "x" })).toThrow(/SPARQL results/);
  });

  it("writes the solutions as CSV", () => {
    expect(solutionsCsv(SELECT_JSON)).toBe('item,label,n\r\nhttp://www.wikidata.org/entity/Q42,Douglas Adams,42\r\n_:b0,"say ""hi"",\nbye",\r\n');
  });

  it("takes the prefixes of a query", () => {
    expect(queryPrefixes("PREFIX wd: <http://www.wikidata.org/entity/>\nprefix rdfs:<http://www.w3.org/2000/01/rdf-schema#>\nSELECT * {}")).toEqual([
      ["wd", "http://www.wikidata.org/entity/"],
      ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
    ]);
  });
});

describe("queryEndpoint", () => {
  it("gives the results of SELECT", async () => {
    const fetch = vi.fn(async () => response(SELECT_JSON, "application/sparql-results+json; charset=utf-8"));
    const results = await queryEndpoint(ENDPOINT, "SELECT * {}", fetch);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("query=SELECT"), expect.objectContaining({ method: "GET" }));
    expect(results.rows).toHaveLength(2);
  });

  it("gives the graph of CONSTRUCT, in its format", async () => {
    const fetch = async () => response("<a> <b> <c> .", "text/turtle");
    expect(await queryEndpoint(ENDPOINT, "CONSTRUCT {} {}", fetch)).toEqual({ kind: "graph", text: "<a> <b> <c> .", format: "turtle" });
    const xml = async () => response("<rdf:RDF/>", "application/rdf+xml");
    expect((await queryEndpoint(ENDPOINT, "DESCRIBE <a>", xml)).format).toBe("rdfxml");
  });

  it("says what the endpoint answered when the query fails", async () => {
    const fetch = async () => response("Parse error: line 1", "text/plain", 400);
    await expect(queryEndpoint(ENDPOINT, "SELEC", fetch)).rejects.toThrow(/query\.wikidata\.org answered 400.*\nParse error: line 1/s);
  });

  it("says when the endpoint can't be reached, maybe because of CORS", async () => {
    const fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(queryEndpoint(ENDPOINT, "ASK {}", fetch)).rejects.toThrow(/Could not reach query\.wikidata\.org.*CORS/);
  });
});
