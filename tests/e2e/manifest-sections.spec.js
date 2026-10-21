// Manifests with sections: the examples are a tree of sections, which open
// and close with a click on their titles. Manifests without sections keep
// the menu of examples.

import { readFileSync } from "node:fs";
import { test, expect, open } from "./fixtures.js";

const MANIFEST = "https://manifests.example/m.yaml";
const SECTIONS = readFileSync(new URL("../unit/fixtures/sections.yaml", import.meta.url), "utf8");
const TURTLE = '<http://example.org/tim> <http://example.org/name> "Tim" .';

// The manifest, and the files of its examples
async function serve(page, yaml = SECTIONS) {
  await page.route("https://manifests.example/**", (route) =>
    route.fulfill({ headers: { "access-control-allow-origin": "*" }, body: route.request().url() === MANIFEST ? yaml : TURTLE }),
  );
}

const section = (page, title) => page.locator(".manifest-section", { has: page.locator(`:scope > summary > .section-title:text-is("${title}")`) });
const example = (page, label) => page.locator(".manifest-example", { hasText: label });
const visibleTitles = (page) => page.locator(".manifest-tree").evaluate((tree) =>
  [...tree.querySelectorAll(".section-title, .manifest-example")].filter((e) => e.checkVisibility()).map((e) => e.textContent),
);

test("a manifest with sections shows them, closed, and the examples out of them", async ({ page }) => {
  await serve(page);
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST)}`);
  await expect(page.locator("#manifest-sections")).toBeVisible();
  await expect(page.locator("#manifest-examples")).toBeHidden();
  expect(await visibleTitles(page)).toEqual(["Knowledge Graphs", "Validating RDF 1.2", "✓ Example outside of sections"]);
  await expect(section(page, "Knowledge Graphs").locator(":scope > summary .section-count")).toHaveText("4 examples");
});

test("a click on a section opens it, with its comment, and another click closes it", async ({ page }) => {
  await serve(page);
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST)}`);
  const kg = section(page, "Knowledge Graphs");
  await kg.locator(":scope > summary").click();
  await expect(kg).toHaveAttribute("open", "");
  await expect(kg.locator(":scope > .section-comment")).toHaveText("Examples about Knowledge Graphs");
  expect(await visibleTitles(page)).toEqual([
    "Knowledge Graphs",
    "Tim Berners-Lee in RDF (Turtle)",
    "Wikidata & Wikibase",
    "RDF 1.2",
    "Validating RDF 1.2",
    "✓ Example outside of sections",
  ]);
  // The sections in it open too
  await section(page, "RDF 1.2").locator(":scope > summary").click();
  await expect(example(page, "RDF 1.2 (reifies)")).toBeVisible();
  await kg.locator(":scope > summary").click();
  await expect(kg).not.toHaveAttribute("open", "");
  await expect(example(page, "Tim Berners-Lee in RDF (Turtle)")).toBeHidden();
  // All of them
  await page.locator("#manifest-expand").click();
  await expect(example(page, "Wikidata SPARQL query")).toBeVisible();
  await expect(example(page, "SHACL 1.2")).toBeVisible();
  await page.locator("#manifest-collapse").click();
  expect(await visibleTitles(page)).toEqual(["Knowledge Graphs", "Validating RDF 1.2", "✓ Example outside of sections"]);
});

test("a click on an example of a section loads it, and the permalink opens its sections", async ({ page }) => {
  await serve(page);
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST)}`);
  await section(page, "Knowledge Graphs").locator(":scope > summary").click();
  await section(page, "RDF 1.2").locator(":scope > summary").click();
  await example(page, "RDF 1.2 (reifies)").click();
  await expect(page.locator("#rdf-data")).toHaveJSProperty("value", TURTLE);
  await expect(example(page, "RDF 1.2 (reifies)")).toHaveAttribute("aria-current", "true");
  // The fourth example of the manifest
  expect(new URL(page.url()).searchParams.get("example")).toBe("4");
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST)}&example=4`);
  await expect(example(page, "RDF 1.2 (reifies)")).toBeVisible();
  await expect(example(page, "RDF 1.2 (reifies)")).toHaveAttribute("aria-current", "true");
  await expect(section(page, "Validating RDF 1.2")).not.toHaveAttribute("open", "");
  await expect(page.locator("#rdf-data")).toHaveJSProperty("value", TURTLE);
});

test("a manifest without sections keeps the menu of examples", async ({ page }) => {
  await serve(page, "- comment: Tim\n  dataURL: tim.ttl\n  action: data\n");
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST)}`);
  await expect(page.locator("#manifest-examples")).toBeVisible();
  await expect(page.locator("#manifest-sections")).toBeHidden();
  await page.locator("#manifest-examples").selectOption({ label: "Tim" });
  await expect(page.locator("#rdf-data")).toHaveJSProperty("value", TURTLE);
});
