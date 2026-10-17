// The tables that rudof writes as text, read back (box-table.js).

import { describe, it, expect } from "vitest";
import { Rudof, RudofConfig } from "@rudof/rudof";
import { parseBoxTable } from "../../box-table.js";
import { BASE_CONFIG } from "../../dctap.js";

describe("parseBoxTable", () => {
  it("reads the header and the rows", () => {
    const text = `╭────────┬───────╮
│ Node   │ Shape │
├────────┼───────┤
│ :alice │ :P    │
├────────┼───────┤
│ :bob   │       │
╰────────┴───────╯`;
    expect(parseBoxTable(text)).toEqual({ header: ["Node", "Shape"], rows: [[":alice", ":P"], [":bob", ""]] });
  });

  it("joins the lines of a cell: without a space when a word was cut", () => {
    const text = `╭──────────────╮
│ Details      │
├──────────────┤
│ found xsd:in │
│ teger, not   │
│ a string     │
╰──────────────╯`;
    expect(parseBoxTable(text).rows).toEqual([["found xsd:integer, not a string"]]);
  });

  it("is undefined for text without a table", () => {
    expect(parseBoxTable("Does not conform, 0 violations")).toBeUndefined();
  });

  it("reads the results of rudof, with the evidences of SHACL", () => {
    const rudof = new Rudof(RudofConfig.fromToml(`${BASE_CONFIG}\n[shacl]\nstore_evidences = true\nevidence_shapes_only = true\n`));
    rudof.readData("prefix : <http://example.org/>\n:alice a :Person ; :name \"Alice\" .\n:carol a :Person .", "turtle");
    rudof.readShacl(
      "prefix : <http://example.org/>\nprefix sh: <http://www.w3.org/ns/shacl#>\n:PersonShape a sh:NodeShape ; sh:targetClass :Person ; sh:property [ sh:path :name ; sh:minCount 1 ] .",
      "turtle",
    );
    rudof.validateShacl("native");
    const { header, rows } = parseBoxTable(rudof.serializeShaclValidationResults("details"));
    expect(header).toEqual(["Severity", "Node", "Component", "Path", "Value", "Source shape", "Details"]);
    expect(rows.map((r) => [r[0], r[1]])).toEqual([["sh:Violation", ":carol"], ["Conforms", ":alice"]]);
    expect(rows[1][6]).toBe("- :PersonShape satisfied");
  });

  it("reads the details of ShEx, which rudof cuts in words", () => {
    const rudof = new Rudof();
    rudof.readData('prefix : <http://example.org/>\n:bob :name 23 .', "turtle");
    rudof.readShex("prefix : <http://example.org/>\nprefix xsd: <http://www.w3.org/2001/XMLSchema#>\n:P { :name xsd:string }");
    rudof.readShapemap(":bob@:P");
    rudof.validateShex();
    const { rows } = parseBoxTable(rudof.serializeShexValidationResults("details"));
    expect(rows[0].slice(0, 3)).toEqual([":bob", ":P", "FAIL"]);
    expect(rows[0][3]).toContain("expected xsd:string");
  });
});
