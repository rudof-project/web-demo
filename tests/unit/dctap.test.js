// DCTAP: the configuration of rudof made from the prefixes of a profile
// (dctap.js), the conversion and validation of the profile of the page with
// it, and the highlighting of profiles (languages/dctap).

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { StringStream } from "@codemirror/language";
import { Rudof, RudofConfig } from "@rudof/rudof";
import { parsePrefixes, dctapConfig, BASIC_PREFIXES } from "../../dctap.js";
import { dctap } from "../../languages/dctap/index.js";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const unescape = (text) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const textarea = (id) => unescape(html.match(new RegExp(`<textarea id="${id}"[^>]*>([\\s\\S]*?)</textarea>`))[1]);

const PROFILE = textarea("dctap-schema");
const PREFIXES = textarea("dctap-prefixes");

function rudofWith(prefixes, options) {
  const rudof = new Rudof();
  rudof.updateConfig(RudofConfig.fromToml(dctapConfig(prefixes, options)));
  return rudof;
}

describe("parsePrefixes", () => {
  it("reads PREFIX and BASE declarations, in the syntaxes of Turtle and SPARQL", () => {
    const { base, prefixes, errors } = parsePrefixes(`BASE <http://example.org/>
PREFIX : <http://example.org/>
prefix foaf: <http://xmlns.com/foaf/0.1/>
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .   # with a comment

# a comment`);
    expect(errors).toEqual([]);
    expect(base).toBe("http://example.org/");
    expect(prefixes).toEqual({ "": "http://example.org/", foaf: "http://xmlns.com/foaf/0.1/", xsd: "http://www.w3.org/2001/XMLSchema#" });
  });

  it("says which lines are not declarations", () => {
    expect(parsePrefixes("PREFIX ex: <http://e/>\nex:a ex:b ex:c .").errors).toEqual(['line 2: "ex:a ex:b ex:c ." is not a PREFIX or BASE declaration']);
    expect(() => dctapConfig("foaf: http://xmlns.com/foaf/0.1/")).toThrow(/can't be read: line 1/);
  });
});

describe("dctapConfig", () => {
  it("is a configuration that rudof reads", () => {
    expect(() => RudofConfig.fromToml(dctapConfig(PREFIXES))).not.toThrow();
  });

  it("has the basic prefixes of rudof, and those of the profile", () => {
    const config = dctapConfig("PREFIX foaf: <http://xmlns.com/foaf/0.1/>\nPREFIX xsd: <http://example.org/my-xsd#>");
    expect(config).toContain('"foaf" = "http://xmlns.com/foaf/0.1/"');
    expect(config).toContain('"rdfs" = "http://www.w3.org/2000/01/rdf-schema#"');
    // The prefixes of the profile win
    expect(config).toContain('"xsd" = "http://example.org/my-xsd#"');
    expect(Object.keys(BASIC_PREFIXES)).toEqual(["rdf", "rdfs", "xsd", "sh", "dc"]);
  });

  it("takes the base of names without prefix from BASE, else from the empty prefix", () => {
    expect(dctapConfig("BASE <http://a/>")).toMatch(/\[tap2shex\]\nbase_iri = "http:\/\/a\/"/);
    expect(dctapConfig("PREFIX : <http://b/>")).toMatch(/\[tap2shex\]\nbase_iri = "http:\/\/b\/"/);
  });

  it("escapes what TOML needs: the TOML is read, and rudof says the IRI is wrong", () => {
    expect(() => RudofConfig.fromToml(dctapConfig('PREFIX q: <http://e/"x\\\\>'))).toThrow(/as IRI/);
  });
});

describe("the profile of the page, in rudof", () => {
  it("converts to ShEx, with the prefixes of the profile", () => {
    const shexc = rudofWith(PREFIXES).convertSchemas(PROFILE, "dctap", "shex", "csv", "shexc");
    expect(shexc).toContain(":Person {");
    expect(shexc).toContain(":knows @:Person *");
  });

  it("validates the data of the page as expected: Bob has two names and no date", () => {
    const rudof = rudofWith(PREFIXES);
    rudof.readShex(rudof.convertSchemas(PROFILE, "dctap", "shex", "csv", "shexj"), "shexj");
    rudof.readData(textarea("dctap-data"), "turtle");
    rudof.readShapemap(textarea("dctap-shapemap"));
    const report = rudof.validateShex();
    expect(Object.fromEntries(report.entries.map((e) => [e.node, e.status]))).toEqual({
      "http://example.org/alice": "conformant",
      "http://example.org/bob": "nonconformant",
      "http://example.org/carol": "conformant",
    });
  });

  it("can't use prefixes the profile does not declare", () => {
    const profile = "shapeID,propertyID\nPerson,foaf:name\n";
    expect(() => rudofWith("BASE <http://example.org/>").convertSchemas(profile, "dctap", "shex", "csv", "shexc")).toThrow(/foaf/);
    expect(rudofWith("PREFIX foaf: <http://xmlns.com/foaf/0.1/>").convertSchemas(profile, "dctap", "shex", "csv", "shexc")).toContain("foaf:name");
  });

  it("separates the values of picklists with spaces, or with |", () => {
    const profile = (values) => `shapeID,propertyID,valueConstraint,valueConstraintType\nS,:status,${values},picklist\n`;
    const prefixes = "PREFIX : <http://example.org/>";
    expect(rudofWith(prefixes).convertSchemas(profile(":a :b"), "dctap", "shex", "csv", "shexc")).toContain("[ :a :b ]");
    expect(rudofWith(prefixes, { picklistSeparator: "|" }).convertSchemas(profile(":a|:b"), "dctap", "shex", "csv", "shexc")).toContain("[ :a :b ]");
  });
});

// The tokens of a text as [text, style] pairs, without spaces.
function tokens(text) {
  const state = dctap.startState();
  const result = [];
  for (const line of text.split("\n")) {
    const stream = new StringStream(line, 2, 2);
    while (!stream.eol()) {
      const style = dctap.token(stream, state);
      if (stream.current().trim()) result.push([stream.current(), style]);
      stream.start = stream.pos;
    }
  }
  return result;
}

describe("the highlighting of DCTAP", () => {
  const PROFILE_TOKENS = tokens(`shapeID,propertyID,mandatory,valueNodeType,valueShape,note
Person,:knows,true,iri,Person,"Who, among the people, they know"
Person,:name,false,literal,,"a ""quoted"" note"`);
  const styleOf = (token) => PROFILE_TOKENS.find(([t]) => t === token)?.[1];

  it.each([
    ["shapeID", "keyword"],
    ["Person", "typeName"],
    [":knows", "propertyName"],
    ["true", "bool"],
    ["iri", "keyword"],
    [",", "punctuation"],
    ['"Who, among the people, they know"', "comment"],
  ])("%s is a %s", (token, style) => {
    expect(styleOf(token)).toBe(style);
  });

  it("keeps the columns after a quoted cell with commas and quotes", () => {
    expect(PROFILE_TOKENS.filter(([, style]) => style === "comment").map(([t]) => t)).toEqual([
      '"Who, among the people, they know"',
      '"a ""quoted"" note"',
    ]);
    expect(PROFILE_TOKENS.at(-4)).toEqual(["literal", "keyword"]);
  });
});
