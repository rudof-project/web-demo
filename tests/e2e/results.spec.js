// The results of validations and queries: in viewers, highlighted in their
// format, and CSV results as text or as a table.

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test, expect, open, setInput } from "./fixtures.js";

const viewer = (page, prefix) => page.locator(`.cm-viewer[data-viewer-for="${prefix}-output"]`);

test("validation results are in a viewer, in their format", async ({ page }) => {
  await open(page, "#validate/shex");
  await page.locator("#shex-result-format").selectOption("compact");
  await page.locator("#shex-validate").click();
  await expect(viewer(page, "shex")).toBeVisible();
  await expect(viewer(page, "shex")).toHaveAttribute("data-format", "compact");
  await expect(viewer(page, "shex").locator(".cm-content")).toContainText(":bob");
  await page.locator("#shex-result-format").selectOption("json");
  await expect(viewer(page, "shex")).toHaveAttribute("data-format", "json");
  await expect(viewer(page, "shex").locator(".cm-line span[class]").first()).toBeVisible();
});

test("tables drawn with characters keep their lines together", async ({ page }) => {
  await open(page, "#validate/shex");
  await page.locator("#shex-result-format").selectOption("compact");
  await page.locator("#shex-validate").click();
  const lineHeight = await viewer(page, "shex").locator(".cm-scroller").evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
  expect(lineHeight).toBeLessThan(13 * 1.3);
});

test("SHACL results in Turtle are highlighted", async ({ page }) => {
  await open(page, "#validate/shacl");
  await page.locator("#shacl-result-format").selectOption("turtle");
  await page.locator("#shacl-validate").click();
  await expect(viewer(page, "shacl")).toHaveAttribute("data-format", "turtle");
  await expect(viewer(page, "shacl").locator(".cm-content")).toContainText("sh:ValidationReport");
});

test("errors are plain text", async ({ page }) => {
  await open(page, "#validate/shex");
  await page.locator("#shex-schema").evaluate((t) => (t.value = "not ShEx {"));
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result")).toHaveAttribute("data-kind", "error");
  await expect(viewer(page, "shex")).toHaveAttribute("data-format", "text");
});

test("the table of SPARQL solutions is not in a viewer", async ({ page }) => {
  await open(page, "#query/sparql");
  await page.locator("#sparql-validate").click();
  await expect(page.locator("#sparql-result table.solutions")).toBeVisible();
  await expect(viewer(page, "sparql")).toBeHidden();
});

test.describe("CSV results", () => {
  const toggle = (page, prefix) => page.locator(`#${prefix}-result .csv-switch`);

  test("have a CSV | Table switch, for CSV only", async ({ page }) => {
    await open(page, "#query/sparql");
    await page.locator("#sparql-validate").click();
    await expect(toggle(page, "sparql")).toBeHidden();
    await page.locator("#sparql-result-format").selectOption("csv");
    await expect(toggle(page, "sparql")).toBeVisible();
    await expect(viewer(page, "sparql")).toHaveAttribute("data-format", "csv");
    // rudof writes the terms of the solutions in Turtle, in the cells
    await expect(viewer(page, "sparql").locator(".cm-content")).toContainText("?name,?age");
  });

  test("can be shown as a table, for every result, and the choice is remembered", async ({ page }) => {
    await open(page, "#query/sparql");
    await page.locator("#sparql-validate").click();
    await page.locator("#sparql-result-format").selectOption("csv");
    await toggle(page, "sparql").getByRole("button", { name: "Table" }).click();
    const table = page.locator("#sparql-result .csv-output table");
    await expect(table.locator("th .th-label")).toHaveText(["?name", "?age"]);
    await expect(table.locator("tbody tr").first().locator("td").first()).toHaveText('"Alice"');
    await expect(table.locator("tbody tr")).toHaveCount(3);
    await expect(viewer(page, "sparql")).toBeHidden();

    // The validation results in CSV are a table too
    await page.locator("#tab-validate").click();
    await page.locator("#tab-shex").click();
    await page.locator("#shex-result-format").selectOption("csv");
    await page.locator("#shex-validate").click();
    await expect(page.locator("#shex-result .csv-output table tbody tr")).toHaveCount(3);

    // Other formats are not tables
    await page.locator("#shex-result-format").selectOption("json");
    await expect(page.locator("#shex-result .csv-output")).toBeHidden();
    await expect(viewer(page, "shex")).toBeVisible();

    // Remembered
    await open(page, "#validate/pgschema");
    await page.locator("#pgschema-result-format").selectOption("csv");
    await page.locator("#pgschema-validate").click();
    await expect(page.locator("#pgschema-result .csv-output table")).toBeVisible();
    await toggle(page, "pgschema").getByRole("button", { name: "CSV" }).click();
    await expect(viewer(page, "pgschema")).toBeVisible();
  });
});

// rudof crashes: a panic, or a stack overflow, after which its WebAssembly
// instance can't be used again (rudof 0.3.33 ran out of stack with a cycle of
// shape references, such as :A @:A AND { :p . }). The test makes the
// validations of rudof throw a RangeError while crashRudof is true: the page
// says it, and loads rudof again, so that the tabs can run again.
test("rudof is loaded again after it runs out of stack", async ({ page }) => {
  const rudofPackage = dirname(createRequire(import.meta.url).resolve("@rudof/rudof/package.json"));
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/@rudof\/rudof@[^/]+\/(endpoints\/)?web\/rudof_wasm\.js$/, async (route) => {
    const build = route.request().url().includes("/endpoints/") ? "endpoints/web" : "web";
    const code = await readFile(join(rudofPackage, build, "rudof_wasm.js"), "utf8");
    const crash = `
for (const name of ["validateShex", "validateShexAsync"]) {
  const validate = Rudof.prototype[name];
  if (!validate) continue;
  Rudof.prototype[name] = function (...args) {
    if (globalThis.crashRudof) throw new RangeError("Maximum call stack size exceeded");
    return validate.apply(this, args);
  };
}`;
    await route.fulfill({ body: code + crash, contentType: "text/javascript" });
  });
  await open(page, "#validate/shex");
  await page.evaluate(() => (globalThis.crashRudof = true));
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result")).toHaveAttribute("data-kind", "error");
  await expect(page.locator("#shex-result")).toContainText("rudof ran out of stack (Maximum call stack size exceeded)");
  await expect(page.locator("#status")).toHaveText(/ready.*\(loaded again after an error\)/);
  // The same validation says it again, and not "recursive use of an object"
  await page.locator("#shex-validate").click();
  await expect(page.locator("#status")).toHaveText(/ready/);
  await expect(page.locator("#shex-result")).toContainText("rudof ran out of stack");
  // The validation of the example runs again: some nodes conform, and others don't
  await page.evaluate(() => (globalThis.crashRudof = false));
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result")).toHaveAttribute("data-kind", "fail");
  await expect(page.locator("#shex-result .verdict")).toHaveText("Does not conform: 1 of 3 nodes failed");
});

// rudof 0.3.33 ran out of stack with a cycle of shape references (with no
// triple constraint between them) and two nodes or more; 0.3.35 validates it
test("a cycle of shape references doesn't crash rudof (rudof 0.3.35)", async ({ page }) => {
  await open(page, "#validate/shex");
  await setInput(page, "shex-schema", "prefix : <http://example.org/>\nprefix xsd: <http://www.w3.org/2001/XMLSchema#>\n:User @:Person AND { :name xsd:string ; :knows . + }\n:Person @:User AND { :knows @:Person * }");
  await setInput(page, "shex-data", 'prefix : <http://example.org/>\n:a :name "Alice" ; :knows :c .\n:b :name "Bob" ; :knows :c .\n:c :name "Carol" ; :knows :a .');
  await setInput(page, "shex-shapemap", ":a@:User, :b@:User, :c@:User");
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result .verdict")).toHaveText(/^Conforms: 3 nodes validated/);
  await expect(page.locator("#status")).not.toHaveText(/loaded again/);
});
