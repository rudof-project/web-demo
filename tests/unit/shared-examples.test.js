// The examples of the page are the same in all the tabs: the files of
// examples/person/ (data-example, inputs.js), which rudof validates as the
// tabs say (Bob has two names and a birth date that is not a date).

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { Rudof } from "@rudof/rudof";
import { expandInputs, exampleText } from "../../inputs.js";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const { document } = new JSDOM(html).window;
expandInputs(document);
const exampleOf = (id) => document.getElementById(id).dataset.example;

describe("the examples of the tabs", () => {
  it("are the same RDF data, schemas, shape map, property graph and query", () => {
    for (const id of ["rdf-data", "shex-data", "shacl-data", "dctap-data", "sparql-data", "compare-data-1"]) expect(exampleOf(id), id).toBe("person/data.ttl");
    for (const id of ["convert-schema", "shex-schema", "compare-schemas-1"]) expect(exampleOf(id), id).toBe("person/schema.shex");
    for (const id of ["shex-shapemap", "dctap-shapemap"]) expect(exampleOf(id), id).toBe("person/shapemap.txt");
    for (const id of ["pg-data", "pgschema-data"]) expect(exampleOf(id), id).toBe("person/data.pg");
    expect([exampleOf("shacl-shapes"), exampleOf("dctap-schema"), exampleOf("pgschema-schema"), exampleOf("pgschema-typemap"), exampleOf("sparql-query")]).toEqual([
      "person/shapes.ttl", "person/profile.csv", "person/schema.pgs", "person/typemap.txt", "person/query.rq",
    ]);
  });

  it("are in the textareas of the page, as the editors read them", () => {
    expect(document.getElementById("shex-data").value).toBe(exampleText("person/data.ttl"));
    expect(document.getElementById("shex-schema").textContent).toContain(":Person {");
    expect(exampleText("person/data.ttl")).not.toMatch(/\n$/);
    expect(exampleText("person/missing.ttl")).toBeUndefined();
  });

  it("say the same in ShEx, SHACL and PGSchema: Alice and Carol conform, Bob doesn't", () => {
    const shex = new Rudof();
    shex.readData(exampleText("person/data.ttl"), "turtle");
    shex.readShex(exampleText("person/schema.shex"), "shexc");
    shex.readShapemap(exampleText("person/shapemap.txt"));
    shex.validateShex();
    expect(shex.serializeShexValidationResults("compact").replace(/[│╭╮╰╯├┤─┬┴┼]/g, " ")).toMatch(/:alice\s+:Person\s+OK[\s\S]*:bob\s+:Person\s+FAIL[\s\S]*:carol\s+:Person\s+OK/);

    const shacl = new Rudof();
    shacl.readData(exampleText("person/data.ttl"), "turtle");
    shacl.readShacl(exampleText("person/shapes.ttl"), "turtle");
    shacl.validateShacl();
    const report = shacl.serializeShaclValidationResults("compact");
    expect(report).toContain(":bob");
    expect(report).not.toMatch(/:alice|:carol/);

    const pg = new Rudof();
    pg.readData(exampleText("person/data.pg"), "pg");
    pg.readPgschema(exampleText("person/schema.pgs"));
    pg.readTypemap(exampleText("person/typemap.txt"));
    const entries = pg.validatePgschema().entries.filter((e) => ["alice", "bob", "carol"].includes(e.nodeId));
    expect(entries.map((e) => [e.nodeId, e.conforms])).toEqual([["alice", true], ["bob", false], ["carol", true]]);
  });
});
