// @vitest-environment jsdom
// Step 7: the language of an editor follows the format of its text, and is
// loaded when it is first needed.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { language, StringStream } from "@codemirror/language";
import { FORMATS, languageOf, loadLanguage } from "../../languages/index.js";
import { turtle } from "../../languages/turtle.js";
import { shexc, shapemap } from "../../languages/shexc.js";
import { setupEditors, editorFor, setFormat } from "../../codemirror-setup.js";

// The tokens of a text as [text, style] pairs, without spaces.
function tokens(parser, text) {
  const state = parser.startState(2);
  const result = [];
  for (const line of text.split("\n")) {
    const stream = new StringStream(line, 2, 2);
    if (!line) parser.blankLine?.(state, 2);
    while (!stream.eol()) {
      const style = parser.token(stream, state);
      const token = stream.current();
      if (token.trim()) result.push([token, style]);
      stream.start = stream.pos;
    }
  }
  return result;
}
const styleOf = (parser, text, token) => tokens(parser, text).find(([t]) => t === token)?.[1];

describe("formats and languages", () => {
  it("has a language for every format of the page", () => {
    const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../index.html"), "utf8");
    const values = [...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
    const fixed = [...html.matchAll(/data-language="([^"]+)"/g)].map((m) => m[1]);
    // The selects of the input formats, and the examples of the SPARQL query
    const outputs = ["plantuml", "compact", "details", "json", "csv", "minimal", "table", "native", "sparql", "select", "count", "ask", "construct", "describe", "text"];
    for (const format of [...new Set([...values, ...fixed])].filter((f) => !outputs.includes(f))) {
      expect(FORMATS, format).toHaveProperty(format);
    }
  });

  it.each([
    ["turtle", "turtle"],
    ["ntriples", "turtle"],
    ["nquads", "turtle"],
    ["trig", "turtle"],
    ["n3", "turtle"],
    ["rdfxml", "xml"],
    ["jsonld", "json"],
    ["shexj", "json"],
    ["shexc", "shexc"],
    ["shapemap", "shapemap"],
    ["sparql", "sparql"],
  ])("%s is written in %s", (format, name) => {
    expect(languageOf(format)).toBe(name);
  });

  it.each(["yarspg", "pgschema", "typemap", "unknown"])("%s is plain text", (format) => {
    expect(languageOf(format)).toBeNull();
  });
});

describe("loadLanguage", () => {
  it.each(["turtle", "rdfxml", "jsonld", "shexc", "shapemap", "sparql"])("loads the language of %s", async (format) => {
    const support = await loadLanguage(format);
    expect(support.language.name).toBe(languageOf(format));
  });

  it("gives no extension for plain text", async () => {
    expect(await loadLanguage("yarspg")).toEqual([]);
    expect(await loadLanguage("not a format")).toEqual([]);
  });

  it("loads each language once", async () => {
    expect(await loadLanguage("turtle")).toBe(await loadLanguage("trig"));
  });
});

describe("Turtle, TriG, N-Triples, N-Quads and N3", () => {
  const text = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
PREFIX : <http://example.org/>
# a comment
:alice a foaf:Person ; foaf:age 23 ; :ok true ;
  foaf:name "Alice"@en, """long""", "1"^^xsd:int ; :p _:b1 .
GRAPH :g { :s :p ?x }`;

  it.each([
    ["@prefix", "keyword"],
    ["PREFIX", "keyword"],
    ["GRAPH", "keyword"],
    ["a", "keyword"],
    ["<http://xmlns.com/foaf/0.1/>", "url"],
    ["# a comment", "comment"],
    ["foaf:", "namespace"],
    ["Person", "propertyName"],
    [":", "namespace"],
    ["alice", "propertyName"],
    ["23", "number"],
    ["true", "bool"],
    ['"Alice"', "string"],
    ['"""long"""', "string"],
    ["@en", "meta"],
    ["^^", "operator"],
    ["_:b1", "variableName"],
    ["?x", "variableName"],
  ])("%s is a %s", (token, style) => {
    expect(styleOf(turtle, text, token)).toBe(style);
  });

  it("keeps a long string open across lines", () => {
    const result = tokens(turtle, ':s :p """one\ntwo""" .');
    expect(result.filter(([, style]) => style === "string").map(([t]) => t)).toEqual(['"""one', 'two"""']);
  });
});

describe("ShExC and shape maps", () => {
  const text = `PREFIX : <http://example.org/>
start = @:Person
:Person CLOSED EXTRA a {
  :name xsd:string MAXLENGTH 50 ;
  :email LITERAL /^[^@]+$/i ;
  :lang [ @en @es ] {0,3} ;
  :knows @:Person * // :comment "x"
} AND NOT @<Other>`;

  it.each([
    ["PREFIX", "keyword"],
    ["start", "keyword"],
    ["CLOSED", "keyword"],
    ["EXTRA", "keyword"],
    ["MAXLENGTH", "keyword"],
    ["LITERAL", "keyword"],
    ["AND", "keyword"],
    ["NOT", "keyword"],
    ["@:Person", "typeName"],
    ["@<Other>", "typeName"],
    ["/^[^@]+$/i", "regexp"],
    ["@en", "meta"],
    ["50", "number"],
    ["*", "operator"],
    ["//", "operator"],
  ])("%s is a %s", (token, style) => {
    expect(styleOf(shexc, text, token)).toBe(style);
  });

  it("shape maps have FOCUS, START and shape references", () => {
    const map = ":alice@:Person, {FOCUS :name _}@START";
    expect(styleOf(shapemap, map, "FOCUS")).toBe("keyword");
    expect(styleOf(shapemap, map, "_")).toBe("keyword");
    expect(styleOf(shapemap, map, "@:Person")).toBe("typeName");
    expect(styleOf(shapemap, map, "@START")).toBe("typeName");
  });
});

describe("the examples", () => {
  const examples = join(dirname(fileURLToPath(import.meta.url)), "../../examples");
  const files = readdirSync(examples, { recursive: true }).filter((f) => /\.(ttl|trig|nt|nq|n3|shex)$/.test(f));

  it.each(files)("%s is tokenized with no string or comment left open", (file) => {
    const parser = file.endsWith(".shex") ? shexc : turtle;
    const state = parser.startState(2);
    for (const line of readFileSync(join(examples, file), "utf8").split("\n")) {
      const stream = new StringStream(line, 2, 2);
      while (!stream.eol()) {
        parser.token(stream, state);
        stream.start = stream.pos;
      }
    }
    expect(state).toMatchObject({ string: null, comment: false, code: false });
  });
});

describe("editors follow the format of their text", () => {
  const RDF = `
    <div class="field">
      <select id="data-format"><option value="turtle">Turtle</option><option value="rdfxml">RDF/XML</option><option value="jsonld">JSON-LD</option></select>
      <textarea id="data" data-editor data-format-select="data-format">:a :b :c .</textarea>
    </div>
    <div class="field"><textarea id="query" data-editor data-language="sparql">SELECT * {}</textarea></div>
    <div class="field"><textarea id="pg" data-editor data-language="yarspg">(n1)</textarea></div>`;
  const languageName = (id) => editorFor(id).state.facet(language)?.name ?? null;
  const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

  afterEach(() => {
    for (const id of ["data", "query", "pg"]) editorFor(id)?.destroy();
    document.body.replaceChildren();
  });

  it("setFormat changes the language of an editor", async () => {
    document.body.innerHTML = RDF;
    setupEditors();
    await setFormat(editorFor("data"), "rdfxml");
    expect(languageName("data")).toBe("xml");
    expect(editorFor("data").dom.dataset.format).toBe("rdfxml");
    await setFormat(editorFor("data"), "yarspg");
    expect(languageName("data")).toBeNull();
  });

  it("the language of an editor is the one of its fixed format", async () => {
    document.body.innerHTML = RDF;
    setupEditors();
    await settled();
    expect(languageName("query")).toBe("sparql");
    expect(languageName("pg")).toBeNull();
  });

  it("the language of an editor is the one chosen in its select", async () => {
    document.body.innerHTML = RDF;
    setupEditors();
    await settled();
    expect(languageName("data")).toBe("turtle");
    const select = document.getElementById("data-format");
    select.value = "jsonld";
    select.dispatchEvent(new Event("change"));
    await settled();
    expect(languageName("data")).toBe("json");
  });

  it("the last format chosen wins, whichever language loads first", async () => {
    document.body.innerHTML = RDF;
    setupEditors();
    await loadLanguage("turtle");
    const view = editorFor("data");
    // RDF/XML may still be loading when Turtle, already loaded, is chosen
    const xml = setFormat(view, "rdfxml");
    const ttl = setFormat(view, "turtle");
    await Promise.all([xml, ttl]);
    expect(languageName("data")).toBe("turtle");
    expect(view.dom.dataset.format).toBe("turtle");
  });

  it("keeps the text, and its history, when the language changes", async () => {
    document.body.innerHTML = RDF;
    setupEditors();
    const view = editorFor("data");
    view.dispatch({ changes: { from: 0, insert: "# x\n" } });
    await setFormat(view, "rdfxml");
    expect(view.state.doc.toString()).toBe("# x\n:a :b :c .");
    const { undoDepth } = await import("@codemirror/commands");
    expect(undoDepth(view.state)).toBe(1);
  });
});
