// The Generate tab: synthetic data from a SHACL, ShEx or PGSchema schema (a
// tab each), validated with it right away, then with the schema of the
// example in the other languages, here or in the tabs of Validate.

import { test, expect, open, editor } from "./fixtures.js";

const verdict = (page) => page.locator("#gen-result .verdict");
const TABS = { turtle: "shacl", shexc: "shex", pgschema: "pgschema" };

async function generate(page, { example = "references", language = "turtle", scenario = "valid" } = {}) {
  await page.locator(`#tab-gen-${TABS[language]}`).click();
  await page.locator("#gen-example").selectOption(example);
  await page.locator("#gen-scenario").selectOption(scenario);
  await expect(editor(page, "gen-schema")).toHaveAttribute("data-format", language);
  await page.locator("#gen-validate").click();
  await expect(page.locator("#gen-result")).not.toHaveAttribute("data-kind", "running");
}

test("has a tab for each schema language, which loads the example in it", async ({ page }) => {
  await open(page, "#generate/gen-shacl");
  await expect(page.locator("#panel-generate .subtabs > [role=tab]")).toHaveText(["SHACL", "ShEx", "PGSchema"]);
  await expect(page.locator("#gen-example")).toHaveValue("references");
  await expect(editor(page, "gen-schema")).toContainText("sh:NodeShape");
  await expect(editor(page, "gen-config")).toContainText("version = 2");
  await page.locator("#tab-gen-pgschema").click();
  await expect(page).toHaveURL(/#generate\/gen-pgschema$/);
  await expect(editor(page, "gen-schema")).toContainText("CREATE NODE TYPE");
  await page.locator("#tab-gen-shex").click();
  await expect(editor(page, "gen-schema")).toHaveAttribute("data-format", "shexc");
});

test("a link to a tab opens it with its language", async ({ page }) => {
  await open(page, "#generate/gen-shex");
  await expect(page.locator("#panel-gen")).toBeVisible();
  await expect(page.locator("#tab-gen-shex")).toHaveAttribute("aria-selected", "true");
  await expect(editor(page, "gen-schema")).toHaveAttribute("data-format", "shexc");
});

for (const [language, validator] of [["turtle", "SHACL"], ["shexc", "ShEx"], ["pgschema", "PGSchema"]]) {
  test(`valid data from ${validator} conforms to it`, async ({ page }) => {
    await open(page, "#generate/gen-shacl");
    await generate(page, { language });
    await expect(page.locator("#gen-result")).toHaveAttribute("data-kind", "ok");
    await expect(verdict(page)).toContainText(`valid, every`);
  });

  test(`data with errors from ${validator} fails exactly where the report says`, async ({ page }) => {
    await open(page, "#generate/gen-shacl");
    await generate(page, { language, scenario: "errors" });
    await expect(editor(page, "gen-config")).toContainText("[violations]");
    await expect(page.locator("#gen-result")).toHaveAttribute("data-kind", "ok");
    await expect(verdict(page)).toContainText(`${validator} rejects exactly the`);
  });
}

test("shows a summary, the property graph, the report and the validation", async ({ page }) => {
  await open(page, "#generate/gen-shacl");
  await generate(page, { scenario: "errors" });
  await expect(page.locator("#gen-result-format")).toHaveValue("summary");
  await expect(page.locator("#gen-result .table-output")).toContainText("Nodes generated");
  await expect(page.locator("#gen-result .table-output")).toContainText("PersonType");
  await page.locator("#gen-result-format").selectOption("yarspg");
  await expect(page.locator('.cm-viewer[data-viewer-for="gen-output"]')).toHaveAttribute("data-format", "yarspg");
  await page.locator("#gen-result-format").selectOption("report");
  await expect(page.locator("#gen-result .table-output table")).toBeVisible();
  await expect(page.locator("#gen-result .table-output")).toContainText("direct");
  await page.locator("#gen-result-format").selectOption("validation");
  await expect(page.locator("#gen-result .table-output")).toContainText("fails");
});

test("downloads the view shown", async ({ page }) => {
  await open(page, "#generate/gen-shacl");
  await generate(page);
  await page.locator("#gen-result-format").selectOption("yarspg");
  const download = page.waitForEvent("download");
  await page.locator("#gen-download").click();
  expect((await download).suggestedFilename()).toBe("data.pg");
});

for (const [target, validator] of [["shacl", "SHACL"], ["shex", "ShEx"], ["pgschema", "PGSchema"]]) {
  test(`validates data with errors from ShEx here with ${validator}`, async ({ page }) => {
    await open(page, "#generate/gen-shacl");
    await generate(page, { language: "shexc", scenario: "errors" });
    await page.locator(`#gen-check-${target}`).click();
    await expect(page.locator("#gen-result-format")).toHaveValue("validation");
    await expect(page.locator("#gen-result")).toHaveAttribute("data-kind", "ok");
    await expect(verdict(page)).toContainText(`${validator} rejects exactly the`);
  });

  test(`opens the data in ${validator}, where it validates`, async ({ page }) => {
    await open(page, "#generate/gen-shacl");
    await generate(page, { language: "shexc" });
    await page.locator(`#gen-to-${target}`).click();
    await expect(page.locator(`#panel-${target}`)).toBeVisible();
    await page.locator(`#${target}-validate`).click();
    await expect(page.locator(`#${target}-result`)).toHaveAttribute("data-kind", "ok");
  });
}

test("a custom schema has no other language, nor a property graph", async ({ page }) => {
  await open(page, "#generate/gen-shacl");
  await generate(page, { example: "custom", language: "shexc" });
  await expect(page.locator("#gen-result")).toHaveAttribute("data-kind", "ok");
  await expect(page.locator("#gen-to-shex")).toBeEnabled();
  await expect(page.locator("#gen-check-shex")).toBeEnabled();
  await expect(page.locator("#gen-check-shacl")).toBeDisabled();
  await expect(page.locator("#gen-to-pgschema")).toBeDisabled();
  await expect(page.locator("#gen-check-pgschema")).toBeDisabled();
});

test("a permalink keeps the language, the example and the kind of data", async ({ page }) => {
  await open(page, "#generate/gen-shacl");
  // Written after each run, as in the other tabs
  await generate(page, { example: "keys", language: "shexc", scenario: "errors" });
  const url = page.url();
  expect(url).toContain("gen-example=keys");
  expect(url).toContain("#generate/gen-shex");
  await page.goto("about:blank");
  await page.goto(url);
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 30_000 });
  await expect(page.locator("#tab-gen-shex")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#gen-example")).toHaveValue("keys");
  await expect(editor(page, "gen-config")).toContainText("[violations]");
  await expect(editor(page, "gen-schema")).toHaveAttribute("data-format", "shexc");
});
