// The Lezer grammars of property graphs (languages/yars-pg) and of their
// schemas and type maps (languages/pgschema): they parse the examples of the
// page and what rudof writes, and highlight each part with its tag.

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { highlightTree, tagHighlighter, tags as t } from "@lezer/highlight";
import { Rudof } from "@rudof/rudof";
import { yarspgLanguage } from "../../languages/yars-pg/index.js";
import { pgschemaLanguage, typemapLanguage } from "../../languages/pgschema/index.js";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const unescape = (text) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const textarea = (id) => unescape(html.match(new RegExp(`<textarea id="${id}"[^>]*>([\\s\\S]*?)</textarea>`))[1]);

// The parts of a text with a syntax error
function errors(language, text) {
  const found = [];
  language.parser.parse(text).iterate({
    enter: (node) => {
      if (node.type.isError) found.push(`${node.from}: ${JSON.stringify(text.slice(node.from, node.from + 20))}`);
    },
  });
  return found;
}

// The tags of the highlighting, by name. A tag with a modifier is named
// after both (special variableName).
const TAGS = {
  variableName: t.variableName,
  "special variableName": t.special(t.variableName),
  tagName: t.tagName,
  propertyName: t.propertyName,
  string: t.string,
  number: t.number,
  bool: t.bool,
  typeName: t.typeName,
  "definition typeName": t.definition(t.typeName),
  namespace: t.namespace,
  keyword: t.keyword,
  definitionKeyword: t.definitionKeyword,
  operatorKeyword: t.operatorKeyword,
  modifier: t.modifier,
  meta: t.meta,
  lineComment: t.lineComment,
  blockComment: t.blockComment,
  operator: t.operator,
  definitionOperator: t.definitionOperator,
  punctuation: t.punctuation,
};
const highlighter = tagHighlighter(Object.entries(TAGS).map(([name, tag]) => ({ tag, class: name })));

// The highlighted parts of a text, as text → the name of their tag
function highlights(language, text) {
  const result = [];
  highlightTree(language.parser.parse(text), highlighter, (from, to, name) => result.push([text.slice(from, to), name]));
  return result;
}
const classOf = (language, text, token) => highlights(language, text).find(([t]) => t === token)?.[1];

describe("YARS-PG", () => {
  const RUDOF = `(n1 {Person} [name: "Alice", birthdate: DATE "2010-07-22", ok: TRUE])
(n2 {Person, Student} [id: 234, aliases: ["Bob", "Robbie"], "full name": "R"])
(3 {"Quoted label"})
// a comment
/* a block
   comment */
(n1) - (e1 {knows} [since: 2020]) -> (n2)
(n2) - ({other}) -> (n1)`;

  const YARSPG_5 = `# YARS-PG 5
+["author": "Alice"]
$addr = "city": "Oviedo", "zip": "33001"
/G1/ {"Graph"} ["since": "2020"]
(p1 {"Person"} ["name": "Alice" @<"source": "web">, $addr, "tags": {"a", "b"}, "info": {"x": "1", "y": ["2", "3"]}]) /G1, G2/
(p1)-(e1 {"knows"} ["since": "2010"])->(p2) /G1/
(p1)-({"friend"})-(p2)
S(PersonSchema {"Person"} ["name": STRING(40) NULL, "age": INTEGER OPTIONAL, "tags": SET(STRING) MIN 1 MAX 5])
S(PersonSchema)-({"knows"} ["since": DATE])->(PersonSchema)
S/G1/ ["owner": STRING]`;

  it.each([
    ["the property graph of the Data tab", textarea("pg-data")],
    ["the property graph of the PGSchema tab", textarea("pgschema-data")],
    ["the syntax of rudof", RUDOF],
    ["YARS-PG 5", YARSPG_5],
  ])("parses %s with no error", (_, text) => {
    expect(errors(yarspgLanguage, text)).toEqual([]);
  });

  it("parses what rudof writes", () => {
    const rudof = new Rudof();
    rudof.readData(RUDOF, "pg");
    expect(errors(yarspgLanguage, rudof.serializeData("compact"))).toEqual([]);
  });

  it.each([
    ["n1", "variableName"],
    ["e1", "variableName"],
    ["3", "variableName"],
    ["Person", "tagName"],
    ['"Quoted label"', "tagName"],
    ["name", "propertyName"],
    ['"full name"', "propertyName"],
    ['"Alice"', "string"],
    ["DATE", "typeName"],
    ["TRUE", "bool"],
    ["234", "number"],
    ["// a comment", "lineComment"],
    ["->", "operator"],
  ])("in the syntax of rudof, %s is a %s", (token, classes) => {
    expect(classOf(yarspgLanguage, RUDOF, token)).toBe(classes);
  });

  it.each([
    ["# YARS-PG 5", "lineComment"],
    ["G1", "namespace"],
    ["addr", "special variableName"],
    ["@<", "meta"],
    ["S", "keyword"],
    ["STRING", "typeName"],
    ["NULL", "modifier"],
    ["OPTIONAL", "modifier"],
  ])("in YARS-PG 5, %s is a %s", (token, classes) => {
    expect(classOf(yarspgLanguage, YARSPG_5, token)).toBe(classes);
  });

  it("does not take a node called DATE or S for a keyword", () => {
    expect(classOf(yarspgLanguage, "(DATE {S})", "DATE")).toBe("variableName");
    expect(classOf(yarspgLanguage, "(DATE {S})", "S")).toBe("tagName");
  });
});

describe("PGSchemaC", () => {
  const MORE = `// comment
/* block */
CREATE EDGE TYPE (:Person | [Course]) -[ K : Knows { since: INTEGER {1,*} CHECK >= 1900 AND <= 2100 OR NOT = 0, ok: BOOL ?, any: ANY, d: DATE CHECK > DATE "2000-01-01" } ]-> (: (A & B) | C) ;
CREATE NODE TYPE (OnlyLabel : L)`;

  // In pgs.rustemo, but rudof 0.3.25 can't read graph types yet
  const GRAPH_TYPE = "CREATE GRAPH TYPE G STRICT { PersonType, (Other : X) }";

  it.each([
    ["the schema of the PGSchema tab", textarea("pgschema-schema")],
    ["other schemas", MORE],
    ["a graph type", GRAPH_TYPE],
  ])("parses %s with no error", (_, text) => {
    expect(errors(pgschemaLanguage, text)).toEqual([]);
  });

  it("parses the schemas that rudof reads", () => {
    const rudof = new Rudof();
    rudof.readPgschema(textarea("pgschema-schema"));
    rudof.readPgschema(MORE);
  });

  const schema = textarea("pgschema-schema");
  it.each([
    ["CREATE", "definitionKeyword"],
    ["TYPE", "definitionKeyword"],
    ["PersonType", "definition typeName"],
    ["Person", "tagName"],
    ["name", "propertyName"],
    ["STRING", "keyword"],
    ["OPTIONAL", "modifier"],
    ["CHECK", "operatorKeyword"],
    ["REGEX", "operatorKeyword"],
    ["||", "operator"],
    ["&", "operator"],
    ["-[", "operator"],
    ["]->", "operator"],
    ["3", "number"],
  ])("%s is a %s", (token, classes) => {
    expect(classOf(pgschemaLanguage, schema, token)).toBe(classes);
  });

  it("a reference to a type is a type", () => {
    expect(classOf(pgschemaLanguage, "CREATE NODE TYPE (S : @PersonType)", "PersonType")).toBe("typeName");
  });

  it("marks what is not PGSchemaC as an error", () => {
    expect(errors(pgschemaLanguage, "CREATE NODE (Person)")).not.toEqual([]);
  });
});

describe("type maps", () => {
  it("parses the type map of the PGSchema tab, and negations", () => {
    expect(errors(typemapLanguage, textarea("pgschema-typemap"))).toEqual([]);
    expect(errors(typemapLanguage, "n1: !PersonType, 3: T // comment")).toEqual([]);
  });

  it.each([
    ["n1", "variableName"],
    ["PersonType", "typeName"],
    ["!", "operator"],
  ])("%s is a %s", (token, classes) => {
    expect(classOf(typemapLanguage, "n1: !PersonType", token)).toBe(classes);
  });
});
