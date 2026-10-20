// The target declarations of SHACL: RDF triples under the shapes graph,
// merged with it before the validation, and given by manifests with targets,
// targetsURL and targetsFormat.

import { test, expect, open, setInput } from "./fixtures.js";

const DATA = `prefix : <http://example.org/>
:alice :name "Alice" .
:carol :age 30 .`;

// Shapes without targets: alone, they validate no node
const SHAPES = `prefix : <http://example.org/>
prefix sh: <http://www.w3.org/ns/shacl#>
:PersonShape a sh:NodeShape ;
  sh:property [ sh:path :name ; sh:minCount 1 ] .`;

const TARGETS = `<http://example.org/PersonShape> <http://www.w3.org/ns/shacl#targetNode> <http://example.org/alice> .
<http://example.org/PersonShape> <http://www.w3.org/ns/shacl#targetNode> <http://example.org/carol> .`;

const verdict = (page) => page.locator("#shacl-result .verdict");

async function validate(page) {
  await page.locator("#shacl-validate").click();
  await expect(page.locator("#shacl-result")).not.toHaveAttribute("data-kind", "running");
}

test.beforeEach(async ({ page }) => {
  await open(page, "#validate/shacl");
  await setInput(page, "shacl-data", DATA);
  await setInput(page, "shacl-shapes", SHAPES);
});

test("the target declarations are optional, under the shapes graph", async ({ page }) => {
  await expect(page.locator("label[for=shacl-targets]")).toHaveText("Target declarations");
  await expect(page.locator("#shacl-targets")).toHaveJSProperty("value", "");
  await expect(page.locator("#shacl-targets-used")).toBeHidden();
  await validate(page);
  await expect(verdict(page)).toHaveText("Conforms");
});

test("the target declarations are merged with the shapes graph", async ({ page }) => {
  await setInput(page, "shacl-targets", TARGETS);
  await page.locator("#shacl-targets-format").selectOption("ntriples");
  await expect(page.locator("#shacl-targets-used")).toHaveText("Merged with the shapes graph");
  await validate(page);
  await expect(verdict(page)).toHaveText("Does not conform: 1 violation (with the target declarations)");
  await expect(page.locator("#shacl-result table.report tbody")).toContainText("carol");

  // The permalink keeps them
  const params = new URL(page.url()).searchParams;
  expect([params.get("targets"), params.get("targets-format")]).toEqual([TARGETS, "ntriples"]);
  await open(page, `?${params}#validate/shacl`);
  await expect(page.locator("#shacl-targets-format")).toHaveValue("ntriples");
  await validate(page);
  await expect(verdict(page)).toHaveText("Does not conform: 1 violation (with the target declarations)");
});

test("without a shapes graph, they are merged with the shapes of the RDF data", async ({ page }) => {
  await setInput(page, "shacl-data", `${SHAPES}\n${DATA}`);
  await setInput(page, "shacl-shapes", "");
  await setInput(page, "shacl-targets", "prefix : <http://example.org/>\nprefix sh: <http://www.w3.org/ns/shacl#>\n:PersonShape sh:targetNode :carol .");
  await expect(page.locator("#shacl-targets-used")).toHaveText("Merged with the shapes of the RDF data");
  await validate(page);
  await expect(verdict(page)).toHaveText("Does not conform: 1 violation (with the shapes of the RDF data and the target declarations)");
});

test("target declarations that are not RDF are an error that says so", async ({ page }) => {
  await setInput(page, "shacl-targets", "this is not turtle");
  await validate(page);
  await expect(page.locator("#shacl-result")).toHaveAttribute("data-kind", "error");
  await expect(page.locator("#shacl-output")).toContainText("The target declarations can't be read");
});

test("manifests give the target declarations with targets and targetsFormat", async ({ page }) => {
  await page.route("https://manifests.example/m.yaml", (route) =>
    route.fulfill({
      headers: { "access-control-allow-origin": "*" },
      body: `
- comment: Carol has no name
  validationEngine: shacl
  schema: |
${SHAPES.replace(/^/gm, "    ")}
  targets: |
${TARGETS.replace(/^/gm, "    ")}
  targetsFormat: ntriples
  data: |
${DATA.replace(/^/gm, "    ")}
  status: nonconformant
`,
    }),
  );
  await open(page, `?manifestURL=${encodeURIComponent("https://manifests.example/m.yaml")}&example=1`);
  await expect(page.locator("#shacl-targets")).toHaveJSProperty("value", `${TARGETS}\n`);
  await expect(page.locator("#shacl-targets-format")).toHaveValue("ntriples");
  await validate(page);
  await expect(verdict(page)).toHaveText(/^Does not conform: 1 violation \(with the target declarations\)/);
});
