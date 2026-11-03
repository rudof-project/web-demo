// Permalinks: the inputs and options of the tab shown, in the query of the URL.

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { expandInputs } from "../../inputs.js";
import { PANELS, KEPT_PARAMS, hasState, panelOfParams, stateParams, queryString, inputsOfParams, permalinkQuery, unpackParams, packText, unpackText, PACKED_PARAM, PACK_OVER } from "../../permalink.js";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const { document } = new JSDOM(html).window;
// The fields of the inputs, as inputs.js makes them when the page loads
expandInputs(document);

describe("PANELS", () => {
  it("has a tab of the page for each panel, in its section", () => {
    for (const [panel, { section }] of Object.entries(PANELS)) {
      expect(document.getElementById(`panel-${section}`).contains(document.getElementById(`panel-${panel}`)), panel).toBe(true);
    }
  });

  it.each(Object.entries(PANELS))("%s: each parameter is an input or a select of its tab", (panel, { params }) => {
    for (const id of Object.values(params)) {
      const element = document.getElementById(id);
      expect(element, id).not.toBeNull();
      expect(["TEXTAREA", "SELECT", "INPUT"]).toContain(element.tagName);
      expect(document.getElementById(`panel-${panel}`).contains(element), id).toBe(true);
    }
  });

  it("has every input of the tabs", () => {
    const ids = Object.values(PANELS).flatMap((p) => Object.values(p.params));
    // Not the settings, which the browser keeps, and not what the page writes
    // (the generated data)
    for (const textarea of document.querySelectorAll("main textarea:not([data-output])")) expect(ids).toContain(textarea.id);
  });

  it("uses the names of shex.js for ShEx", () => {
    expect(Object.keys(PANELS.shex.params)).toEqual(expect.arrayContaining(["schema", "data", "shape-map"]));
  });
});

describe("stateParams", () => {
  const read = (id) => `value of ${id}`;

  it("reads every parameter of the tab", () => {
    expect(stateParams("shex", read).slice(0, 3)).toEqual([
      ["schema", "value of shex-schema"],
      ["data", "value of shex-data"],
      ["shape-map", "value of shex-shapemap"],
    ]);
    expect(stateParams("shex", read).map(([name]) => name)).toEqual(Object.keys(PANELS.shex.params));
  });

  it("keeps the manifest and the example, and nothing else", () => {
    const current = new URLSearchParams("query=old&manifestURL=https://example.org/m.yaml&example=2&interface=human");
    const names = stateParams("rdf", read, current).map(([name]) => name);
    expect(names).toEqual([...Object.keys(PANELS.rdf.params), ...KEPT_PARAMS]);
  });
});

describe("queryString", () => {
  it("encodes every value, with %20 for spaces", () => {
    expect(queryString([["shape-map", "<Obs1>@START\n"], ["data", "a + b & c=d #e"]])).toBe(
      "shape-map=%3CObs1%3E%40START%0A&data=a%20%2B%20b%20%26%20c%3Dd%20%23e",
    );
  });

  it("is read back as it was written", () => {
    const pairs = [["schema", "PREFIX : <http://hl7.org/fhir/>\nstart = @<S> # ¿ñ? 🙂"], ["data", "+ %20 &"]];
    expect([...new URLSearchParams(queryString(pairs))]).toEqual(pairs);
  });
});

describe("reading a URL", () => {
  it("knows when a URL has inputs", () => {
    expect(hasState(new URLSearchParams("manifestURL=x&example=1"))).toBe(false);
    expect(hasState(new URLSearchParams("data=x"))).toBe(true);
  });

  it.each([
    ["schema=s&data=d&shape-map=m&interface=human", "shex"],
    ["shapes=s&data=d", "shacl"],
    ["schema=s&data=d&type-map=t", "pgschema"],
    ["data=d&query=q", "sparql"],
    ["data=d", "rdf"],
    ["manifestURL=x", undefined],
  ])("?%s is for the tab %s", (query, panel) => {
    expect(panelOfParams(new URLSearchParams(query))).toBe(panel);
  });

  it("gives the inputs of the tab that the URL has", () => {
    expect(inputsOfParams("shex", new URLSearchParams("data=d&shape-map=m&query=q"))).toEqual([
      ["shex-data", "d"],
      ["shex-shapemap", "m"],
    ]);
  });
});

describe("inputs given by URLs", () => {
  it("are inputs of a tab, by their parameters with -url", () => {
    expect(hasState(new URLSearchParams("schema-url=es:E371"))).toBe(true);
    expect(hasState(new URLSearchParams("manifestURL=x"))).toBe(false);
    expect(panelOfParams(new URLSearchParams("query-url=https://e/q.rq"))).toBe("sparql");
    expect(panelOfParams(new URLSearchParams("schema-url=es:E371&shape-map=wd:Q42@START"))).toBe("shex");
  });
});

describe("long permalinks", () => {
  const LUBM = readFileSync(new URL("../../examples/generate/lubm.ttl", import.meta.url), "utf8");

  it("compress a text, and give it back", () => {
    for (const text of ["", "a b", "prefix : <http://example.org/> # é ✓ 漢字", LUBM]) expect(unpackText(packText(text))).toBe(text);
    expect(packText(LUBM)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(packText(LUBM).length).toBeLessThan(LUBM.length / 5);
  });

  it("are as they are when they are short", () => {
    const pairs = [["schema", ":S { :p . }"], ["manifestURL", "m.yml"]];
    expect(permalinkQuery(pairs)).toBe(queryString(pairs));
  });

  it("have their inputs compressed when they are long, and the manifest and its example as they are", () => {
    const pairs = [["schema", LUBM], ["schema-format", "turtle"], ["config", "version = 2\n"], ["manifestURL", "examples/generate/manifest.yml"], ["example", "21"]];
    expect(queryString(pairs).length).toBeGreaterThan(PACK_OVER);
    const query = permalinkQuery(pairs);
    expect(query.length).toBeLessThan(PACK_OVER);
    const params = new URLSearchParams(query);
    expect([...params.keys()]).toEqual([PACKED_PARAM, "manifestURL", "example"]);
    expect(hasState(params)).toBe(true);
    // Read back: the same parameters
    const read = unpackParams(params);
    expect([...read]).toEqual(pairs);
    expect(hasState(read)).toBe(true);
    expect(inputsOfParams("gen", read)).toEqual(expect.arrayContaining([["gen-schema", LUBM], ["gen-language", "turtle"]]));
  });

  it("can't be read when the compressed inputs are cut", () => {
    const query = permalinkQuery([["schema", LUBM]]);
    const cut = new URLSearchParams(query.slice(0, query.length / 2));
    expect(() => unpackParams(cut)).toThrow();
    // Without them, the parameters are as they are
    const plain = new URLSearchParams("schema=x");
    expect(unpackParams(plain)).toBe(plain);
  });
});
