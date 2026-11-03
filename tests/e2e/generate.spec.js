// The Generate tab: synthetic data from a SHACL, ShEx or PGSchema schema (a
// tab each), validated with it right away, then with the schema of the
// example in the other languages, here or in the tabs of Validate.

import { test, expect, open, editor, setInput } from "./fixtures.js";

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

test("writes the generated data in the box next to the schema", async ({ page }) => {
  await open(page, "#generate/gen-shacl");
  await expect(page.locator("#gen-data")).toHaveValue("");
  await generate(page);
  // RDF data from SHACL and ShEx, in Turtle
  await expect(page.locator("#gen-data-view")).toHaveValue("turtle");
  await expect(editor(page, "gen-data")).toHaveAttribute("data-format", "turtle");
  await expect(editor(page, "gen-data")).toContainText("rudof.example/pg/");
  // The property graph of the example too
  await page.locator("#gen-data-view").selectOption("yarspg");
  await expect(editor(page, "gen-data")).toHaveAttribute("data-format", "yarspg");
  await expect(editor(page, "gen-data")).toContainText(")->");
  // A property graph from a PGSchema
  await generate(page, { language: "pgschema" });
  await expect(page.locator("#gen-data-view")).toHaveValue("yarspg");
  await expect(editor(page, "gen-data")).toContainText(")->");
});

test("shows a summary, the report and the validation", async ({ page }) => {
  await open(page, "#generate/gen-shacl");
  await generate(page, { scenario: "errors" });
  await expect(page.locator("#gen-result-format")).toHaveValue("summary");
  await expect(page.locator("#gen-result-format option")).toHaveText(["Summary", "Type map", "ShapeMap", "Error report", "Validation"]);
  await expect(page.locator("#gen-result .table-output")).toContainText("Nodes generated");
  await expect(page.locator("#gen-result .table-output")).toContainText("PersonType");
  await page.locator("#gen-result-format").selectOption("report");
  await expect(page.locator("#gen-result .table-output table")).toBeVisible();
  await expect(page.locator("#gen-result .table-output")).toContainText("direct");
  await page.locator("#gen-result-format").selectOption("validation");
  await expect(page.locator("#gen-result .table-output")).toContainText("fails");
});

test("downloads the view shown, or the generated data of its box", async ({ page }) => {
  await open(page, "#generate/gen-shacl");
  await generate(page);
  const downloaded = async () => {
    const download = page.waitForEvent("download");
    await page.locator("#gen-download").click();
    return (await download).suggestedFilename();
  };
  // With the summary: the data of the box
  expect(await downloaded()).toBe("data.ttl");
  await page.locator("#gen-data-view").selectOption("yarspg");
  expect(await downloaded()).toBe("data.pg");
  await page.locator("#gen-result-format").selectOption("shapemap");
  expect(await downloaded()).toBe("shapemap.txt");
});

test("the generated data can be edited, and Open in takes the text of its box", async ({ page }) => {
  await open(page, "#generate/gen-shacl");
  await generate(page, { language: "shexc" });
  const text = await page.locator("#gen-data").inputValue();
  await setInput(page, "gen-data", `${text}\n# edited here`);
  // The other view keeps the edit
  await page.locator("#gen-data-view").selectOption("yarspg");
  await page.locator("#gen-data-view").selectOption("turtle");
  await expect(page.locator("#gen-data")).toHaveValue(/# edited here$/);
  await page.locator("#gen-to-shex").click();
  await expect(page.locator("#shex-data")).toHaveValue(/# edited here$/);
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

test("a schema of your own has no other language, nor a property graph", async ({ page }) => {
  await open(page, "#generate/gen-shacl");
  await page.locator("#tab-gen-shex").click();
  await page.locator("#gen-example").selectOption("custom");
  await expect(editor(page, "gen-schema")).toContainText(":Person {");
  // The template, edited
  await setInput(page, "gen-schema", (await page.locator("#gen-schema").inputValue()).replace(":label xsd:string", ":label xsd:string ;\n  :size xsd:integer ?"));
  await page.locator("#gen-validate").click();
  await expect(page.locator("#gen-result")).toHaveAttribute("data-kind", "ok");
  await expect(page.locator("#gen-to-shex")).toBeEnabled();
  await expect(page.locator("#gen-check-shex")).toBeEnabled();
  await expect(page.locator("#gen-check-shacl")).toBeDisabled();
  await expect(page.locator("#gen-to-pgschema")).toBeDisabled();
  await expect(page.locator("#gen-check-pgschema")).toBeDisabled();
  // The box of the generated data has only RDF data
  await expect(page.locator('#gen-data-view option[value="yarspg"]')).toHaveJSProperty("disabled", true);
  await expect(page.locator("#gen-data-view")).toHaveValue("turtle");
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

test.describe("the examples, from the manifest of Generate", () => {
  test("are the sections of the manifest, and the kinds of data its entries", async ({ page }) => {
    await open(page, "#generate/gen-shacl");
    await expect(page.locator("#gen-example option")).toHaveText([
      "Persons, organisations and cities (references)",
      "Keys and values (required, optional, lists, dates)",
      "Value facets (pattern, ranges)",
      "Several labels (Person & Employee)",
      "LUBM university (12 node types, 35 edge types)",
      "LDBC Social Network (11 node types, cycles)",
      "Your own schema (a template)",
    ]);
    await expect(page.locator("#gen-scenario option")).toHaveText([
      "Valid data",
      "Dense: every optional property, maximal cardinality",
      "Sparse: optional properties on 10% of the nodes",
      "Coherence 0.85 (searched over the fill)",
      "With errors (20%) and their report",
    ]);
    // Another kind of data: its configuration, and the schema stays
    await setInput(page, "gen-schema", "# my schema");
    await page.locator("#gen-scenario").selectOption("dense");
    await expect(editor(page, "gen-config")).toContainText('cardinality = "max"');
    await expect(page.locator("#gen-schema")).toHaveValue("# my schema");
  });

  test("Examples opens the manifest, whose examples go to the Generate tab", async ({ page }) => {
    await open(page);
    await page.locator("header details.menu summary", { hasText: "Examples" }).click();
    await page.getByRole("link", { name: "Generate examples" }).click();
    await expect(page.locator("#manifest-sections")).toBeVisible();
    await expect(page.locator(".manifest-tree > li > details > summary .section-title")).toHaveCount(7);
    await expect(page.locator("#tab-gen-shacl")).toHaveAttribute("aria-selected", "true");
    const keys = page.locator(".manifest-tree > li > details").nth(1);
    await keys.locator("summary").click();
    await keys.getByRole("button", { name: "With errors (20%) and their report" }).click();
    await expect(page.locator("#gen-example")).toHaveValue("keys");
    await expect(page.locator("#gen-scenario")).toHaveValue("errors");
    await expect(editor(page, "gen-config")).toContainText("[violations]");
    await expect(editor(page, "gen-schema")).toContainText("sh:NodeShape");
    await expect(page).toHaveURL(/example=10.*#generate\/gen-shacl$/);
    await page.locator("#gen-validate").click();
    await expect(verdict(page)).toContainText("SHACL rejects exactly the");
  });

  test("an example of another manifest goes to the Generate tab too", async ({ page }) => {
    await page.route("https://manifests.example/generate.yml", (route) =>
      route.fulfill({
        headers: { "access-control-allow-origin": "*" },
        body: `- comment: A person
  action: generate
  schemaLanguage: shex
  schema: |
    prefix : <http://example.org/>
    :Person { :name . }
  entities: 5
  seed: 3
`,
      }),
    );
    await page.goto("./?manifestURL=https%3A%2F%2Fmanifests.example%2Fgenerate.yml");
    await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 30_000 });
    await page.locator("#manifest-examples").selectOption({ label: "A person" });
    await expect(page.locator("#tab-gen-shex")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#gen-example")).toHaveValue("manifest");
    await expect(page.locator("#gen-example option:checked")).toHaveText("From the manifest: A person");
    await expect(page.locator("#gen-schema")).toHaveValue(/:Person \{ :name \. \}/);
    await expect(page.locator("#gen-config")).toHaveValue("version = 2\n");
    await expect(page.locator("#gen-entities")).toHaveValue("5");
    await expect(page.locator("#gen-seed")).toHaveValue("3");
    await page.locator("#gen-validate").click();
    await expect(page.locator("#gen-result")).toHaveAttribute("data-kind", "ok");
    // It has no other language
    await expect(page.locator("#gen-check-shacl")).toBeDisabled();
    // An example of the tab again
    await page.locator("#gen-example").selectOption("references");
    await expect(page.locator('#gen-example option[value="manifest"]')).toHaveCount(0);
  });
});
