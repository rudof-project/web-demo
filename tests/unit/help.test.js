// The help page (help.html): it is linked from the demo, its examples of
// manifests are right (they parse, and the validations give their status in
// rudof), and it documents every key that manifest.js reads.

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { Rudof, RudofConfig } from "@rudof/rudof";
import { parseManifest, loadExample } from "../../manifest.js";
import { dctapConfig } from "../../dctap.js";
import { readSchema } from "../../schema-convert.js";

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
const help = new JSDOM(read("help.html")).window.document;
const demo = new JSDOM(read("index.html")).window.document;

const MANIFEST_URL = "https://example.org/manifest.yaml";
// The examples, with the id of the heading they are under
const examples = [...help.querySelectorAll("pre.manifest-example")].map((pre) => ({
  heading: [...help.querySelectorAll("h3")].filter((h) => h.compareDocumentPosition(pre) & 4).at(-1).id,
  entries: parseManifest(pre.textContent, MANIFEST_URL, { endpoints: true }),
}));

// Validates the inputs of an example with rudof: whether they conform.
function conforms(example, inputs) {
  const by = Object.fromEntries(inputs.map((i) => [i.name, i]));
  const rudof = new Rudof();
  if (example.target === "shex") {
    rudof.readData(by.data.text, by.data.format);
    rudof.readShex(by.schema.text, by.schema.format);
    rudof.readShapemap(by.queryMap.text);
    return rudof.validateShex().conforms;
  }
  if (example.target === "dctap") {
    rudof.updateConfig(RudofConfig.fromToml(dctapConfig(by.prefixes.text, { picklistSeparator: by.picklistSeparator.text })));
    rudof.readData(by.data.text, by.data.format);
    rudof.readShex(rudof.convertSchemas(by.schema.text, "dctap", "shex", "csv", "shexj"), "shexj");
    rudof.readShapemap(by.queryMap.text);
    return rudof.validateShex().conforms;
  }
  if (example.target === "shacl") {
    rudof.readData(by.data.text, by.data.format);
    rudof.readShacl(by.schema.text, by.schema.format);
    return rudof.validateShacl("native").conforms;
  }
  rudof.readData(by.data.text, "pg");
  rudof.readPgschema(by.schema.text);
  rudof.readTypemap(by.typeMap.text);
  return rudof.validatePgschema().conforms;
}

describe("the help page", () => {
  it("is linked from the header of the demo", () => {
    expect(demo.querySelector('header .links a[href="help.html"]').textContent).toBe("Help");
  });

  it("links back to the demo", () => {
    expect(help.querySelector('header .brand a.subtitle[href="./"]')).not.toBeNull();
  });

  it("has the header of the demo: Examples, Help and About", () => {
    const items = (doc) => [...doc.querySelectorAll("header .links > a, header .links > details:not(.menu-icon) > summary")].map((e) => e.textContent.trim());
    expect(items(demo)).toEqual(["Examples", "Help", "About"]);
    expect(items(help)).toEqual(["Examples", "Help", "About"]);
    // The same menus in both pages, even when an editor wraps their lines
    // in other places
    const menus = (doc) => doc.querySelector("header .links details").innerHTML.replace(/\s+/g, " ").replace(/> </g, "><").replace(/\s+(?=[/]?>)/g, "");
    expect(menus(help)).toBe(menus(demo));
  });

  it("links only to parts of it that exist", () => {
    for (const a of help.querySelectorAll('a[href^="#"]')) {
      expect(help.getElementById(a.getAttribute("href").slice(1)), a.getAttribute("href")).not.toBeNull();
    }
  });

  it("documents every key of manifests", () => {
    const documented = new Set([...help.querySelectorAll("code")].map((c) => c.textContent));
    const keys = [
      "action", "validationEngine", "queryEngine", "status", "comment", "dataLabel", "schemaLabel",
      "data", "dataURL", "schema", "schemaURL", "shapes", "shapesURL", "queryMap", "queryMapURL",
      "typeMap", "typeMapURL", "query", "queryURL", "endpoint", "dataFormat", "schemaFormat", "queryFormat",
      "schemaLanguage", "schemaEngine", "prefixes", "prefixesURL", "picklistSeparator",
    ];
    expect(keys.filter((key) => !documented.has(key))).toEqual([]);
  });
});

describe("the examples of the help page", () => {
  const entries = examples.flatMap((e) => e.entries.map((entry) => [e.heading, entry]));

  it("has an example for each action and validation engine", () => {
    expect(new Set(entries.map(([, e]) => e.target))).toEqual(new Set(["shex", "shacl", "pgschema", "dctap", "rdf", "pg", "sparql", "convert-shex", "convert-dctap"]));
  });

  it.each(entries)("%s: %o can be loaded", async (_, example) => {
    expect(example.unsupported).toBeUndefined();
    // The files of the examples are not here: they are empty
    await loadExample(example, async () => "");
  });

  // The validations with their inputs in the manifest (not on endpoints,
  // which the tests don't reach)
  const inline = ([, e]) => !e.inputs.endpoint && Object.values(e.inputs).every((input) => input.text != null);
  it.each(entries.filter(([, e]) => e.action === "validate" && e.status).filter(inline))("%s: the validation gives its status", async (_, example) => {
    const inputs = await loadExample(example);
    expect(conforms(example, inputs)).toBe(example.status === "conformant");
  });

  // The schemas of the Schema tab, read by rudof in their language
  it.each(entries.filter(([, e]) => e.action === "schema"))("%s: rudof reads the schema", async (_, example) => {
    const by = Object.fromEntries((await loadExample(example)).map((i) => [i.name, i]));
    const language = example.target.replace("convert-", "");
    const config = language === "dctap" ? RudofConfig.fromToml(dctapConfig(by.prefixes.text, { picklistSeparator: by.picklistSeparator.text })) : undefined;
    expect(() => readSchema(new Rudof(), { language, format: by.schema.format, text: by.schema.text, config })).not.toThrow();
  });
});
