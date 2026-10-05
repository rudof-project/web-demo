// Permalinks: the inputs and options of the tab shown, in the query of the URL.

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { PANELS, KEPT_PARAMS, hasState, panelOfParams, stateParams, queryString, inputsOfParams } from "../../permalink.js";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const { document } = new JSDOM(html).window;

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
      expect(["TEXTAREA", "SELECT"]).toContain(element.tagName);
      expect(document.getElementById(`panel-${panel}`).contains(element), id).toBe(true);
    }
  });

  it("has every input of the page", () => {
    const ids = Object.values(PANELS).flatMap((p) => Object.values(p.params));
    for (const textarea of document.querySelectorAll("textarea")) expect(ids).toContain(textarea.id);
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
