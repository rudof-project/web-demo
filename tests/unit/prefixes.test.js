// @vitest-environment jsdom
// Prefixes (prefixes.js) and their completion in the editors
// (prefix-completion.js).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { CompletionContext } from "@codemirror/autocomplete";
import {
  COMMON_PREFIXES,
  endpointFileURL,
  prefixesOfEndpointToml,
  endpointToml,
  declaredPrefixes,
  declaration,
  declarationPosition,
} from "../../prefixes.js";
import { prefixCompletions, setPrefixSource } from "../../prefix-completion.js";

const WIKIDATA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../e2e/rudof-endpoints/wikidata.toml"), "utf8");

describe("prefixes", () => {
  it("of the endpoints are in the files of rudof, by version and name", () => {
    expect(endpointFileURL("0.3.27", "Wikidata_qlever")).toBe(
      "https://cdn.jsdelivr.net/gh/rudof-project/rudof@0.3.27/rudof_rdf/endpoints/wikidata_qlever.toml",
    );
    const prefixes = prefixesOfEndpointToml(WIKIDATA);
    expect(prefixes).toContainEqual(["wd", "http://www.wikidata.org/entity/"]);
    expect(prefixes).toContainEqual(["wdt", "http://www.wikidata.org/prop/direct/"]);
    expect(prefixesOfEndpointToml('name = "x"\nquery_url = "https://x/"\n')).toEqual([]);
  });

  it("of the endpoints come with the other keys of their files, such as the limits of their requests", () => {
    const { prefixes, description } = endpointToml(WIKIDATA);
    expect(prefixes).toEqual(prefixesOfEndpointToml(WIKIDATA));
    expect(description.min_request_interval_ms).toBe(1100);
  });

  it("declared in a text are read in any style", () => {
    const text = "PREFIX : <http://example.org/>\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\nprefix wd: <http://www.wikidata.org/entity/>\n:a :b :c .";
    expect(declaredPrefixes(text)).toEqual([
      ["", "http://example.org/"],
      ["xsd", "http://www.w3.org/2001/XMLSchema#"],
      ["wd", "http://www.wikidata.org/entity/"],
    ]);
  });

  it("are declared in the style of the text", () => {
    expect(declaration("PREFIX : <x>", "wd", "http://w/")).toBe("PREFIX wd: <http://w/>");
    expect(declaration("prefix : <x>", "wd", "http://w/")).toBe("prefix wd: <http://w/>");
    expect(declaration("@prefix : <x> .", "wd", "http://w/", { turtle: true })).toBe("@prefix wd: <http://w/> .");
    // SPARQL and ShExC have no @prefix
    expect(declaration("@prefix : <x> .", "wd", "http://w/")).toBe("PREFIX wd: <http://w/>");
  });

  it("are declared after the others, or at the start", () => {
    expect(declarationPosition("PREFIX a: <x>\n# a comment\nPREFIX b: <y>\n\nSELECT * {}")).toEqual({ at: 39, newlineBefore: true });
    expect(declarationPosition("SELECT * {}")).toEqual({ at: 0, newlineBefore: false });
  });

  it("that are common include those of RDF, XML Schema and SHACL", () => {
    const aliases = COMMON_PREFIXES.map(([alias]) => alias);
    expect(aliases).toEqual(expect.arrayContaining(["rdf", "rdfs", "xsd", "sh"]));
    expect(new Set(aliases).size).toBe(aliases.length);
  });
});

describe("prefix completion", () => {
  setPrefixSource(() => [
    ["wdt", "http://www.wikidata.org/prop/direct/", "endpoint"],
    ["xsd", "http://www.w3.org/2001/XMLSchema#", "common"],
  ]);

  function editor(doc, format) {
    const view = new EditorView({ state: EditorState.create({ doc }) });
    view.dom.dataset.format = format;
    return view;
  }
  const complete = (view, pos = view.state.doc.length, explicit = false) => prefixCompletions(new CompletionContext(view.state, pos, explicit, view));

  it("completes an alias, and adds its declaration", () => {
    const view = editor("PREFIX : <http://example.org/>\n\nSELECT * WHERE { ?s wd", "sparql");
    const result = complete(view);
    const option = result.options.find((o) => o.label === "wdt:");
    expect(option.detail).toBe("http://www.wikidata.org/prop/direct/");
    option.apply(view, option, result.from, view.state.doc.length);
    expect(view.state.doc.toString()).toBe("PREFIX : <http://example.org/>\nPREFIX wdt: <http://www.wikidata.org/prop/direct/>\n\nSELECT * WHERE { ?s wdt:");
    // The cursor is after the alias
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
  });

  it("completes the aliases of the text without declaring them again", () => {
    const view = editor("prefix ex: <http://example.org/>\n:a :b e", "shexc");
    const result = complete(view);
    const option = result.options.find((o) => o.label === "ex:");
    option.apply(view, option, result.from, view.state.doc.length);
    expect(view.state.doc.toString()).toBe("prefix ex: <http://example.org/>\n:a :b ex:");
  });

  it("completes declarations after PREFIX, in Turtle with @prefix and its dot", () => {
    const view = editor("@prefix xs", "turtle");
    const result = complete(view);
    expect(result.from).toBe("@prefix ".length);
    expect(result.options.find((o) => o.label === "xsd:").apply).toBe("xsd: <http://www.w3.org/2001/XMLSchema#> .");
    // Not those declared already
    const declared = complete(editor("PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\nPREFIX ", "sparql"));
    expect(declared.options.map((o) => o.label)).not.toContain("xsd:");
  });

  it("does nothing in IRIs, strings, local names, variables and other formats", () => {
    expect(complete(editor('<http://example.org/wd', "turtle"))).toBeNull();
    expect(complete(editor('"wd', "turtle"))).toBeNull();
    expect(complete(editor(":a :wd", "turtle"))).toBeNull();
    expect(complete(editor("SELECT ?wd", "sparql"))).toBeNull();
    expect(complete(editor("wd", "json"))).toBeNull();
    expect(complete(editor("wd", "rdfxml"))).toBeNull();
  });
});
