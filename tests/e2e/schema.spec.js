// The Schema tab: a schema of ShEx, SHACL, DCTAP or PGSchema, converted to
// other formats and languages. What rudof can't do yet can't be chosen.

import { test, expect, editor, open, setInput } from "./fixtures.js";

const viewer = (page) => page.locator('.cm-viewer[data-viewer-for="convert-output"]');
const verdict = (page) => page.locator("#convert-result .verdict");

test("is a section between Data and Validate", async ({ page }) => {
  await open(page, "#schema/convert");
  await expect(page.locator(".tabs:not(.subtabs) > [role=tab]")).toHaveText(["Data", "Schema", "Validate", "Query"]);
  await expect(page.locator("#panel-convert")).toBeVisible();
  await expect(editor(page, "convert-schema")).toHaveAttribute("data-format", "shexc");
});

test("converts ShExC to ShExR", async ({ page }) => {
  await open(page, "#schema/convert");
  await expect(page.locator("#convert-to")).toHaveValue("shex");
  await expect(page.locator("#convert-result-format")).toHaveValue("turtle");
  await page.locator("#convert-validate").click();
  await expect(verdict(page)).toHaveText("ShEx (ShExC) → ShEx (ShExR (Turtle))");
  await expect(viewer(page).locator(".cm-content")).toContainText("sx:ShapeDecl");
  await page.locator("#convert-result-format").selectOption("rdfxml");
  await expect(viewer(page).locator(".cm-content")).toContainText("<rdf:RDF");
  await expect(verdict(page)).toHaveText("ShEx (ShExC) → ShEx (ShExR (RDF/XML))");
});

test("ShEx to SHACL is in the menu, but can't be chosen yet", async ({ page }) => {
  await open(page, "#schema/convert");
  const shacl = page.locator('#convert-to option[value="shacl"]');
  await expect(shacl).toHaveJSProperty("disabled", true);
  await expect(shacl).toHaveText("SHACL (not in rudof yet)");
  await expect(page.locator('#convert-to option[value="sparql"]')).toHaveJSProperty("disabled", false);
});

test("converts SHACL to ShEx, and the SHACL example comes with the language", async ({ page }) => {
  await open(page, "#schema/convert");
  await page.locator("#convert-language").selectOption("shacl");
  await expect(page.locator("#convert-format")).toHaveValue("turtle");
  await expect.poll(() => page.locator("#convert-schema").inputValue()).toContain("sh:NodeShape");
  await expect(page.locator("#convert-to")).toHaveValue("shex");
  await expect(page.locator('#convert-to option[value="shacl"]')).toHaveJSProperty("disabled", false);
  await page.locator("#convert-result-format").selectOption("shexc");
  await page.locator("#convert-validate").click();
  await expect(viewer(page).locator(".cm-content")).toContainText("PersonShape");
});

test("converts a DCTAP profile, with its prefixes and its table view", async ({ page }) => {
  await open(page, "#schema/convert");
  await expect(page.locator("#convert-dctap-options")).toBeHidden();
  await page.locator("#convert-language").selectOption("dctap");
  await expect(page.locator("#convert-dctap-options")).toBeVisible();
  await expect(page.locator("#convert-view")).toBeVisible();
  await page.locator("#convert-result-format").selectOption("shexc");
  await page.locator("#convert-validate").click();
  await expect(viewer(page).locator(".cm-content")).toContainText(":Person {");
  await page.locator('#convert-view button[data-view="table"]').click();
  await expect(page.locator("#convert-table tbody tr")).toHaveCount(3);
  // Other languages have no table
  await page.locator("#convert-language").selectOption("shex");
  await expect(page.locator("#convert-view")).toBeHidden();
  await expect(editor(page, "convert-schema")).toBeVisible();
});

test("draws UML diagrams of the schemas", async ({ page }) => {
  await open(page, "#schema/convert");
  await page.locator("#convert-to").selectOption("uml");
  await page.locator("#convert-validate").click();
  await expect(page.locator("#convert-result .diagram")).toBeVisible();
  await expect(verdict(page)).toHaveText("ShEx (ShExC) → UML diagram");
});

test("PGSchema is only written as rudof reads it", async ({ page }) => {
  await open(page, "#schema/convert");
  await page.locator("#convert-language").selectOption("pgschema");
  await expect(page.locator("#convert-to")).toHaveValue("pgschema");
  await expect(page.locator('#convert-result-format option[value="pgschemac"]')).toHaveJSProperty("disabled", true);
  await expect(page.locator('#convert-to option[value="shex"]')).toHaveJSProperty("disabled", true);
  await page.locator("#convert-validate").click();
  await expect(viewer(page).locator(".cm-content")).toContainText("Node Types");
});

test("Use as input reads the result as the schema", async ({ page }) => {
  await open(page, "#schema/convert");
  await page.locator("#convert-validate").click();
  await expect(page.locator("#convert-use-as-input")).toBeEnabled();
  await page.locator("#convert-use-as-input").click();
  await expect(page.locator("#convert-format")).toHaveValue("turtle");
  await expect.poll(() => page.locator("#convert-schema").inputValue()).toContain("sx:ShapeDecl");
  await page.locator("#convert-result-format").selectOption("shexc").catch(() => {});
  await page.locator("#convert-to").selectOption("shex");
  await page.locator("#convert-result-format").selectOption("shexc");
  await page.locator("#convert-validate").click();
  await expect(viewer(page).locator(".cm-content")).toContainText(":Person");
  // A diagram is not a schema
  await page.locator("#convert-to").selectOption("uml");
  await expect(page.locator("#convert-use-as-input")).toBeDisabled();
});

test("says why a schema can't be read", async ({ page }) => {
  await open(page, "#schema/convert");
  await setInput(page, "convert-schema", "not ShEx {");
  await page.locator("#convert-validate").click();
  await expect(page.locator("#convert-result")).toHaveAttribute("data-kind", "error");
});

test("the schema and the conversion are in the permalink", async ({ page }) => {
  await open(page, "#schema/convert");
  await page.locator("#convert-language").selectOption("shacl");
  await page.locator("#convert-result-format").selectOption("shexj");
  await page.locator("#convert-validate").click();
  await expect(verdict(page)).toHaveText("SHACL (Turtle) → ShEx (ShExJ)");
  const url = new URL(page.url());
  expect(url.searchParams.get("schema-language")).toBe("shacl");
  expect(url.searchParams.get("to-format")).toBe("shexj");
  await open(page, url.search + url.hash);
  await expect(page.locator("#convert-language")).toHaveValue("shacl");
  await expect(page.locator("#convert-format")).toHaveValue("turtle");
  await expect(page.locator("#convert-result-format")).toHaveValue("shexj");
  await expect.poll(() => page.locator("#convert-schema").inputValue()).toContain("sh:NodeShape");
});
