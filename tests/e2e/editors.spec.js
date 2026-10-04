// Step 8: the editors in the built page, with rudof, in a real browser.

import { readFileSync } from "node:fs";
import { test, expect, editor, open, setInput } from "./fixtures.js";

const example = (path) => readFileSync(new URL(`../../examples/${path}`, import.meta.url), "utf8");

const INPUTS = [
  "rdf-data", "pg-data", "shex-data", "shex-schema", "shex-shapemap", "shacl-data", "shacl-shapes",
  "pgschema-data", "pgschema-schema", "pgschema-typemap", "sparql-data", "sparql-query",
];

test.describe("the page", () => {
  test("loads rudof", async ({ page }) => {
    await open(page);
    await expect(page.locator("#status")).toHaveText(/rudof 0\.\d+\.\d+ ready/);
  });

  test("has an editor in place of each input textarea", async ({ page }) => {
    await open(page);
    await expect(page.locator(".cm-editor")).toHaveCount(INPUTS.length);
    for (const id of INPUTS) {
      await expect(page.locator(`#${id}`)).toBeHidden();
      await expect(editor(page, id)).toHaveCount(1);
    }
  });

  test("the editors start with the examples of the textareas", async ({ page }) => {
    await open(page);
    await expect(editor(page, "rdf-data").locator(".cm-content")).toContainText(":alice a foaf:Person");
  });
});

test.describe("editing", () => {
  test("typing changes the input", async ({ page }) => {
    await open(page);
    const content = editor(page, "rdf-data").locator(".cm-content");
    await content.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type("\n:carol a foaf:Person .");
    await expect.poll(() => page.locator("#rdf-data").inputValue()).toMatch(/\n\s*:carol a foaf:Person \.$/);
  });

  test("undo and redo", async ({ page }) => {
    await open(page);
    const before = await page.locator("#shex-shapemap").inputValue();
    await page.goto("./#validate/shex");
    await editor(page, "shex-shapemap").locator(".cm-content").click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type(", :dave@:Person");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator("#shex-shapemap")).toHaveJSProperty("value", before);
  });

  test("closes brackets", async ({ page }) => {
    await open(page, "#query/sparql");
    await setInput(page, "sparql-query", "");
    await editor(page, "sparql-query").locator(".cm-content").click();
    await page.keyboard.type("SELECT * {");
    await expect(page.locator("#sparql-query")).toHaveJSProperty("value", "SELECT * {}");
  });

  test("Ctrl+F opens the search panel", async ({ page }) => {
    await open(page);
    await editor(page, "rdf-data").locator(".cm-content").click();
    await page.keyboard.press("ControlOrMeta+f");
    await expect(editor(page, "rdf-data").locator(".cm-search")).toBeVisible();
  });

  test("has line numbers", async ({ page }) => {
    await open(page);
    await expect(editor(page, "rdf-data").locator(".cm-lineNumbers .cm-gutterElement").filter({ hasText: /^11$/ })).toHaveCount(1);
  });
});

test.describe("languages", () => {
  // The highlighted tokens of an editor: text → class
  const highlighted = (page, id) =>
    editor(page, id).locator(".cm-line span[class]").evaluateAll((spans) => spans.map((s) => s.textContent));

  test("the RDF data is highlighted as Turtle", async ({ page }) => {
    await open(page);
    await expect(editor(page, "rdf-data")).toHaveAttribute("data-format", "turtle");
    await expect.poll(() => highlighted(page, "rdf-data")).toEqual(expect.arrayContaining(["prefix", "foaf:", "Person", '"Alice"']));
  });

  test("the schema is highlighted as ShExC, the query as SPARQL", async ({ page }) => {
    await open(page, "#validate/shex");
    await expect.poll(() => highlighted(page, "shex-schema")).toEqual(expect.arrayContaining(["@:Person", "xsd:"]));
    await page.goto("./#query/sparql");
    await expect.poll(() => highlighted(page, "sparql-query")).toEqual(expect.arrayContaining(["SELECT", "?name"]));
  });

  test("choosing another format loads its language", async ({ page }) => {
    await open(page);
    const loaded = page.waitForRequest(/assets\/.*\.js$/);
    await setInput(page, "rdf-data", example("rdfxml/basic.rdf"));
    await page.locator("#rdf-data-format").selectOption("rdfxml");
    await loaded;
    await expect(editor(page, "rdf-data")).toHaveAttribute("data-format", "rdfxml");
    await expect.poll(() => highlighted(page, "rdf-data")).toEqual(expect.arrayContaining(["rdf:RDF"]));
  });

  test("follows the dark color scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await open(page);
    await expect(editor(page, "rdf-data")).toHaveCSS("background-color", "rgb(29, 33, 38)");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(editor(page, "rdf-data")).toHaveCSS("background-color", "rgb(246, 247, 249)");
  });
});

test.describe("the demo uses the editors", () => {
  const verdict = (page, prefix) => page.locator(`#${prefix}-result .verdict`);

  for (const [path, format] of [
    ["turtle/basic.ttl", "turtle"],
    ["turtle/collections.ttl", "turtle"],
    ["rdfxml/collections.rdf", "rdfxml"],
    ["trig/trig.trig", "trig"],
    ["jsonld/basic.jsonld", "jsonld"],
    ["n3/basic.n3", "n3"],
  ]) {
    test(`converts ${path}`, async ({ page }) => {
      await open(page);
      await page.locator("#rdf-data-format").selectOption(format);
      await setInput(page, "rdf-data", example(path));
      await page.locator("#rdf-validate").click();
      await expect(page.locator("#rdf-result")).toHaveAttribute("data-kind", "ok");
      await expect(verdict(page, "rdf")).toHaveText(/^\d+ triples?, /);
    });
  }

  test("Ctrl+Enter in an editor validates, without a new line", async ({ page }) => {
    await open(page, "#validate/shex");
    const before = await page.locator("#shex-schema").inputValue();
    await editor(page, "shex-schema").locator(".cm-content").click();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(verdict(page, "shex")).toHaveText(/Does not conform: 1 of 3 nodes failed/);
    expect(await page.locator("#shex-schema").inputValue()).toBe(before);
  });

  test("validates what is typed", async ({ page }) => {
    await open(page, "#validate/shex");
    await setInput(page, "shex-schema", example("shexc/basic.shex"));
    await setInput(page, "shex-shapemap", ":alice@:Person");
    await page.locator("#shex-validate").click();
    await expect(verdict(page, "shex")).toHaveText(/^Conforms: 1 node validated/);
  });

  test("the examples of the query menu go into the editor", async ({ page }) => {
    await open(page, "#query/sparql");
    await page.locator("#sparql-example").selectOption("ask");
    await expect(editor(page, "sparql-query").locator(".cm-content")).toContainText("ASK { ?person foaf:age ?age");
    await expect(editor(page, "sparql-query").locator(".cm-content")).toBeFocused();
    await page.locator("#sparql-validate").click();
    await expect(verdict(page, "sparql")).toHaveText("ASK: false");
  });

  test("runs the SPARQL examples", async ({ page }) => {
    await open(page, "#query/sparql");
    await setInput(page, "sparql-data", example("turtle/basic.ttl"));
    for (const [file, expected] of [["select.rq", /^3 results$/], ["aggregates.rq", /^2 results$/], ["ask.rq", "ASK: false"]]) {
      await setInput(page, "sparql-query", example(`sparql/${file}`));
      await page.locator("#sparql-validate").click();
      await expect(verdict(page, "sparql"), file).toHaveText(expected);
    }
    // The verdict counts the lines of the graph, which may have several triples
    await setInput(page, "sparql-query", example("sparql/construct.rq"));
    await page.locator("#sparql-validate").click();
    await expect(page.locator("#sparql-result .output")).toContainText(":isKnownBy");
  });

  test("Use as input puts the converted data in the editor, in its format", async ({ page }) => {
    await open(page);
    await page.locator("#rdf-result-format").selectOption("rdfxml");
    await page.locator("#rdf-validate").click();
    await expect(page.locator("#rdf-result")).toHaveAttribute("data-kind", "ok");
    await page.locator("#rdf-use-as-input").click();
    await expect(editor(page, "rdf-data").locator(".cm-content")).toContainText("<rdf:RDF");
    await expect(editor(page, "rdf-data")).toHaveAttribute("data-format", "rdfxml");
    await page.locator("#rdf-validate").click();
    await expect(page.locator("#rdf-result")).toHaveAttribute("data-kind", "ok");
  });
});
