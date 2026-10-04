// Step 1: the examples used to try the editors with every input format.
// Each example must exist, be non-empty, and be accepted by rudof itself (the
// same version the demo loads), so that the examples are known to be valid.

import { readFileSync, existsSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { Rudof } from "@rudof/rudof";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

// The examples asked for, and the rudof format each one is read with.
const RDF = {
  "examples/rdfxml/basic.rdf": "rdfxml",
  "examples/rdfxml/namespaces.rdf": "rdfxml",
  "examples/rdfxml/blank-nodes.rdf": "rdfxml",
  "examples/rdfxml/collections.rdf": "rdfxml",
  "examples/rdfxml/literals.rdf": "rdfxml",
  "examples/turtle/basic.ttl": "turtle",
  "examples/turtle/prefixes.ttl": "turtle",
  "examples/turtle/blank-nodes.ttl": "turtle",
  "examples/turtle/collections.ttl": "turtle",
  "examples/turtle/literals.ttl": "turtle",
  "examples/trig/trig.trig": "trig",
  // Other formats of the demo
  "examples/ntriples/basic.nt": "ntriples",
  "examples/nquads/basic.nq": "nquads",
  "examples/n3/basic.n3": "n3",
  "examples/jsonld/basic.jsonld": "jsonld",
};

const SPARQL_QUERIES = [
  "examples/sparql/select.rq",
  "examples/sparql/construct.rq",
  "examples/sparql/ask.rq",
  "examples/sparql/paths.rq",
  "examples/sparql/aggregates.rq",
];
const SPARQL_UPDATES = ["examples/sparql/update.ru"];

const SHEX = {
  "examples/shexc/basic.shex": "shexc",
  "examples/shexc/shapes.shex": "shexc",
  "examples/shexc/constraints.shex": "shexc",
  "examples/shexj/basic.shexj": "shexj",
};

const ALL = [...Object.keys(RDF), ...SPARQL_QUERIES, ...SPARQL_UPDATES, ...Object.keys(SHEX)];

describe("examples folder", () => {
  it.each(ALL)("%s exists and is not empty", (path) => {
    expect(existsSync(new URL(path, root)), `${path} is missing`).toBe(true);
    expect(read(path).trim().length).toBeGreaterThan(0);
  });
});

describe("RDF examples are valid", () => {
  it.each(Object.entries(RDF))("%s is read as %s", (path, format) => {
    const rudof = new Rudof();
    rudof.readData(read(path), format);
    const triples = rudof.serializeData("nquads").split("\n").filter((l) => l.trim());
    expect(triples.length).toBeGreaterThan(0);
  });

  it("the TriG example has named graphs", () => {
    // rudof reads them into a single graph, so the syntax is checked
    const trig = read("examples/trig/trig.trig");
    expect(trig).toMatch(/^:\w+\s*\{/m);
    expect(trig).toMatch(/^GRAPH\s+:\w+\s*\{/m);
  });
});

describe("SPARQL examples are valid", () => {
  const data = () => {
    const rudof = new Rudof();
    rudof.readData(read("examples/turtle/basic.ttl"), "turtle");
    return rudof;
  };

  it.each(SPARQL_QUERIES)("%s is parsed and runs", (path) => {
    const rudof = data();
    rudof.readQuery(read(path));
    expect(() => rudof.runQuery()).not.toThrow();
  });

  it("each query form has an example", () => {
    expect(read("examples/sparql/select.rq")).toMatch(/\bSELECT\b/i);
    expect(read("examples/sparql/construct.rq")).toMatch(/\bCONSTRUCT\b/i);
    expect(read("examples/sparql/ask.rq")).toMatch(/\bASK\b/i);
    expect(read("examples/sparql/paths.rq")).toMatch(/[/|*+^]\s*\w*:/);
    expect(read("examples/sparql/aggregates.rq")).toMatch(/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i);
  });

  it.each(SPARQL_UPDATES)("%s is a SPARQL Update", (path) => {
    expect(read(path)).toMatch(/\b(INSERT|DELETE)\b/i);
  });
});

describe("ShEx examples are valid", () => {
  it.each(Object.entries(SHEX))("%s is read as %s", (path, format) => {
    const rudof = new Rudof();
    expect(() => rudof.readShex(read(path), format)).not.toThrow();
    expect(rudof.serializeCurrentShex("shexc").trim().length).toBeGreaterThan(0);
  });
});

describe("node project", () => {
  it("tests rudof with the version the demo loads", () => {
    const pkg = JSON.parse(read("package.json"));
    const demo = read("demo.js").match(/const RUDOF_VERSION = "([^"]+)"/)[1];
    expect(pkg.devDependencies["@rudof/rudof"]).toBe(demo);
  });
});
