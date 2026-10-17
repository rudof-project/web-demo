// Prefixes: those of the endpoints that rudof knows, under the Endpoint
// field, and their completion in the editors, which adds their declarations.

import { test, expect, open, editor } from "./fixtures.js";

const WIKIDATA = "https://query.wikidata.org/sparql";

// Types in an editor, at the end of its text, and waits for the completions
async function typeAtEnd(page, id, text) {
  await editor(page, id).locator(".cm-content").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(text);
  await expect(page.locator(".cm-tooltip-autocomplete")).toBeVisible();
  // CodeMirror takes keys a moment after it shows the completions
  await page.waitForTimeout(150);
}

test("the prefixes of an endpoint that rudof knows are under its field", async ({ page }) => {
  await open(page, "#query/sparql");
  const box = page.locator("#sparql-endpoint-prefixes");
  await expect(box).toBeHidden();
  await page.locator("#sparql-endpoint-choice").selectOption(WIKIDATA);
  await expect(box.locator("summary")).toHaveText(/^Prefixes of Wikidata \(\d+\)$/);
  await box.locator("summary").click();
  await expect(box.locator("pre")).toContainText("PREFIX wd: <http://www.wikidata.org/entity/>");
  // None: no endpoint, no prefixes
  await page.locator("#sparql-endpoint-choice").selectOption("");
  await expect(box).toBeHidden();
});

test("an endpoint that rudof doesn't know has no prefixes", async ({ page }) => {
  await open(page, "#query/sparql");
  await page.locator("#sparql-endpoint").fill("https://unknown.example/sparql");
  await expect(page.locator("#sparql-endpoint-prefixes")).toBeHidden();
});

test("the editors complete the prefixes of the endpoint, and declare them", async ({ page }) => {
  await open(page, "#query/sparql");
  await page.locator("#sparql-endpoint-choice").selectOption(WIKIDATA);
  await expect(page.locator("#sparql-endpoint-prefixes")).toBeVisible();
  await typeAtEnd(page, "sparql-query", "\nwdt");
  await expect(page.locator(".cm-tooltip-autocomplete li").first()).toContainText("wdt:");
  await page.keyboard.press("Enter");
  const query = await page.locator("#sparql-query").inputValue();
  expect(query).toMatch(/^PREFIX foaf: <http:\/\/xmlns\.com\/foaf\/0\.1\/>\nPREFIX wdt: <http:\/\/www\.wikidata\.org\/prop\/direct\/>\n/);
  expect(query.endsWith("\nwdt:")).toBe(true);
});

test("after @prefix, Turtle completes the declaration, with its dot", async ({ page }) => {
  await open(page, "#data/rdf");
  await typeAtEnd(page, "rdf-data", "\n@prefix sk");
  await expect(page.locator(".cm-tooltip-autocomplete li").first()).toContainText("skos:");
  await page.keyboard.press("Enter");
  const data = await page.locator("#rdf-data").inputValue();
  // (indented as the line before)
  expect(data).toMatch(/\n\s*@prefix skos: <http:\/\/www\.w3\.org\/2004\/02\/skos\/core#> \.$/);
});

test("ShExC completes the common prefixes", async ({ page }) => {
  await open(page, "#validate/shex");
  await typeAtEnd(page, "shex-schema", "\n:Q { dct");
  await expect(page.locator(".cm-tooltip-autocomplete li").first()).toContainText("dct:");
  await page.keyboard.press("Enter");
  const schema = await page.locator("#shex-schema").inputValue();
  expect(schema).toContain("prefix dct: <http://purl.org/dc/terms/>");
  // The editor closed the brace
  expect(schema.endsWith(":Q { dct:}")).toBe(true);
});
