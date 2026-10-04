// Step 5: index.html loads codemirror-setup.js and marks the textareas that
// become editors, with the format of their text.

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const { document } = new JSDOM(html).window;
const textareas = [...document.querySelectorAll("textarea")];

describe("index.html", () => {
  it("loads codemirror-setup.js as a module, before demo.js", () => {
    const scripts = [...document.querySelectorAll('script[type="module"]')].map((s) => s.getAttribute("src"));
    const setup = scripts.findIndex((src) => /(^|\/)codemirror-setup\.js$/.test(src ?? ""));
    const demo = scripts.findIndex((src) => /(^|\/)demo\.js$/.test(src ?? ""));
    expect(setup).toBeGreaterThanOrEqual(0);
    expect(setup).toBeLessThan(demo);
  });

  it("has input textareas", () => {
    expect(textareas.length).toBe(12);
  });

  it("gives every textarea a unique id", () => {
    const ids = textareas.map((t) => t.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(textareas.map((t) => t.id))("#%s becomes an editor", (id) => {
    expect(document.getElementById(id).hasAttribute("data-editor")).toBe(true);
  });

  it.each(textareas.map((t) => t.id))("#%s says the format of its text", (id) => {
    const area = document.getElementById(id);
    const select = area.dataset.formatSelect;
    const language = area.dataset.language;
    // Either a select of the page chooses the format, or it is fixed.
    expect(Boolean(select) !== Boolean(language), "data-format-select or data-language, not both").toBe(true);
    if (select) {
      expect(document.getElementById(select)?.tagName).toBe("SELECT");
      // The select is in the same field as the textarea
      expect(area.closest(".field").contains(document.getElementById(select))).toBe(true);
    }
  });

  it("uses the format selects of the RDF data, schemas and shapes", () => {
    const formats = Object.fromEntries(textareas.map((t) => [t.id, t.dataset.formatSelect ?? t.dataset.language]));
    expect(formats).toEqual({
      "rdf-data": "rdf-data-format",
      "pg-data": "yarspg",
      "shex-data": "shex-data-format",
      "shex-schema": "shex-schema-format",
      "shex-shapemap": "shapemap",
      "shacl-data": "shacl-data-format",
      "shacl-shapes": "shacl-shapes-format",
      "pgschema-data": "yarspg",
      "pgschema-schema": "pgschema",
      "pgschema-typemap": "typemap",
      "sparql-data": "sparql-data-format",
      "sparql-query": "sparql",
    });
  });
});
