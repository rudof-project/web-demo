// The DCTAP tab: a profile in CSV, with its prefixes, validated by converting
// it to ShEx, and converted to ShEx and other formats.

import { test, expect, editor, open, setInput } from "./fixtures.js";

const verdict = (page, prefix) => page.locator(`#${prefix}-result .verdict`);
const viewer = (page) => page.locator('.cm-viewer[data-viewer-for="dctap-schema-output"]');

test("is a tab of Validate, between SHACL and PGSchema", async ({ page }) => {
  await open(page, "#validate/dctap");
  await expect(page.locator("#panel-validate .subtabs [role=tab]")).toHaveText(["ShEx", "SHACL", "DCTAP", "PGSchema"]);
  await expect(page.locator("#panel-dctap")).toBeVisible();
  await expect(editor(page, "dctap-schema")).toHaveAttribute("data-format", "dctap");
});

test("validates the data with the profile, converted to ShEx", async ({ page }) => {
  await open(page, "#validate/dctap");
  await page.locator("#dctap-validate").click();
  await expect(verdict(page, "dctap")).toHaveText("Does not conform: 1 of 3 nodes failed");
  await expect(page.locator("#dctap-result .output")).toContainText(":bob");
  await page.locator("#dctap-result-format").selectOption("json");
  await expect(page.locator("#dctap-result .output")).toContainText("nonconformant");
});

test("SHACL is not an engine yet", async ({ page }) => {
  await open(page, "#validate/dctap");
  await expect(page.locator('#dctap-engine option[value="shacl"]')).toHaveJSProperty("disabled", true);
  await expect(page.locator('#dctap-schema-result-format option[value="shacl"]')).toHaveJSProperty("disabled", true);
});

test("converts the profile to ShEx, SPARQL and DCTAP", async ({ page }) => {
  await open(page, "#validate/dctap");
  await page.locator("#dctap-schema-validate").click();
  await expect(verdict(page, "dctap-schema")).toHaveText("DCTAP → ShEx (ShExC)");
  await expect(viewer(page).locator(".cm-content")).toContainText(":Person {");
  await expect(viewer(page)).toHaveAttribute("data-format", "shexc");

  await page.locator("#dctap-schema-result-format").selectOption("shexj");
  await expect(viewer(page).locator(".cm-content")).toContainText('"type"');
  await page.locator("#dctap-schema-result-format").selectOption("sparql");
  await expect(viewer(page).locator(".cm-content")).toContainText("SELECT");
  await page.locator("#dctap-schema-result-format").selectOption("internal");
  await expect(viewer(page).locator(".cm-content")).toContainText("Shape(Person)");
  await page.locator("#dctap-schema-result-format").selectOption("dctap-json");
  await expect(viewer(page).locator(".cm-content")).toContainText('"shapeID"');
  await expect(verdict(page, "dctap-schema")).toHaveText("DCTAP → DCTAP (JSON)");
});

test("uses the prefixes of the profile, and says when one is missing", async ({ page }) => {
  await open(page, "#validate/dctap");
  await setInput(page, "dctap-schema", "shapeID,propertyID,valueDataType\nPerson,foaf:name,xsd:string");
  await page.locator("#dctap-schema-validate").click();
  await expect(page.locator("#dctap-schema-result")).toHaveAttribute("data-kind", "error");
  await expect(page.locator("#dctap-schema-result .output")).toContainText("foaf");

  await setInput(page, "dctap-prefixes", "BASE <http://example.org/>\nPREFIX foaf: <http://xmlns.com/foaf/0.1/>");
  await page.locator("#dctap-schema-validate").click();
  await expect(viewer(page).locator(".cm-content")).toContainText("foaf:name xsd:string");
});

test("says which lines of the prefixes are wrong", async ({ page }) => {
  await open(page, "#validate/dctap");
  await setInput(page, "dctap-prefixes", "foaf: http://xmlns.com/foaf/0.1/");
  await page.locator("#dctap-validate").click();
  await expect(page.locator("#dctap-result .output")).toContainText("line 1");
});

test("the profile and its prefixes are in the permalink", async ({ page }) => {
  await open(page, "#validate/dctap");
  await page.locator("#dctap-validate").click();
  await expect(verdict(page, "dctap")).toContainText("Does not conform");
  const url = new URL(page.url());
  expect(url.hash).toBe("#validate/dctap");
  expect(url.searchParams.get("dctap")).toContain("shapeID");
  expect(url.searchParams.get("prefixes")).toContain("BASE <http://example.org/>");

  // Without a fragment, the dctap parameter opens the DCTAP tab
  url.hash = "";
  await open(page, url.search);
  await expect(page.locator("#panel-dctap")).toBeVisible();
});

test.describe("the table view of the profile", () => {
  const table = (page) => page.locator("#dctap-table");

  test("switches between the CSV and a table", async ({ page }) => {
    await open(page, "#validate/dctap");
    await expect(editor(page, "dctap-schema")).toBeVisible();
    await page.locator('#dctap-view button[data-view="table"]').click();
    await expect(editor(page, "dctap-schema")).toBeHidden();
    await expect(table(page).locator("thead input").first()).toHaveValue("shapeID");
    await expect(table(page).locator("tbody tr")).toHaveCount(3);
    await page.locator('#dctap-view button[data-view="csv"]').click();
    await expect(editor(page, "dctap-schema")).toBeVisible();
    await expect(table(page)).toBeHidden();
  });

  test("edits in the table change the profile that is validated", async ({ page }) => {
    await open(page, "#validate/dctap");
    await page.locator('#dctap-view button[data-view="table"]').click();
    // name is not mandatory any more: Bob, with two names, still fails for his date
    const mandatory = table(page).locator("tbody tr").first().locator("input").nth(4);
    await expect(mandatory).toHaveValue("true");
    await mandatory.fill("false");
    await expect.poll(() => page.locator("#dctap-schema").evaluate((t) => t.value)).toContain("Person,Person,:name,Name,false,false");
    // A new row: Enter in the last row adds one
    await table(page).locator("tbody tr").last().locator("input").first().press("Enter");
    await expect(table(page).locator("tbody tr")).toHaveCount(4);
    await table(page).locator("tbody tr").last().locator("input").first().fill("Person");
    await table(page).locator("tbody tr").last().locator("input").nth(2).fill(":email");
    await page.locator("#dctap-schema-validate").click();
    await expect(viewer(page).locator(".cm-content")).toContainText(":email");
    // Ctrl+Enter in a cell validates
    await table(page).locator("tbody input").first().press("Control+Enter");
    await expect(verdict(page, "dctap")).toContainText("conform");
  });

  test("follows a profile loaded from a permalink, and is remembered", async ({ page }) => {
    await open(page, "#validate/dctap");
    await page.locator('#dctap-view button[data-view="table"]').click();
    await open(page, `?dctap=${encodeURIComponent("shapeID,propertyID\nBook,:title")}#validate/dctap`);
    await expect(table(page)).toBeVisible();
    await expect(table(page).locator("tbody input").first()).toHaveValue("Book");
  });
});
