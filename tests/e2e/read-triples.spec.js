// Read triples: the triples that a ShEx or SHACL validation reads, counted in
// its verdict, and the subgraph they make, below its result.

import { test, expect, open, setInput } from "./fixtures.js";

const DATA = `prefix : <http://example.org/>
:alice :name "Alice" ; :knows :bob .
:bob :name "Bob" .
:carol :age 3 .`;

const SCHEMA = `prefix : <http://example.org/>
:Person { :name . ; :knows @:Person * }`;

const SHAPES = `prefix : <http://example.org/>
prefix sh: <http://www.w3.org/ns/shacl#>
:PersonShape a sh:NodeShape ; sh:targetNode :alice ;
  sh:property [ sh:path :name ; sh:minCount 1 ] .`;

const block = (page, tab) => page.locator(`#${tab}-result .read-triples`);
const subgraph = (page, tab) => page.locator(`.cm-editor[data-viewer-for="${tab}-read-triples-output"]`);

async function validate(page, tab) {
  await page.locator(`#${tab}-validate`).click();
  await expect(page.locator(`#${tab}-result`)).not.toHaveAttribute("data-kind", "running");
}

test.describe("ShEx", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "#validate/shex");
    await setInput(page, "shex-data", DATA);
    await setInput(page, "shex-schema", SCHEMA);
    await setInput(page, "shex-shapemap", ":alice@:Person");
  });

  test("without the option, nothing is read", async ({ page }) => {
    await expect(page.locator("#shex-read-triples")).not.toBeChecked();
    await validate(page, "shex");
    await expect(page.locator("#shex-result .verdict")).toHaveText("Conforms: 1 node validated");
    await expect(block(page, "shex")).toBeHidden();
  });

  test("with the option, the verdict counts the triples and the subgraph is shown", async ({ page }) => {
    await page.locator("#shex-read-triples").check();
    await validate(page, "shex");
    await expect(page.locator("#shex-result .verdict")).toHaveText(/^Conforms: 1 node validated · \d+ triples read \(3 distinct\)$/);
    await expect(block(page, "shex")).toBeVisible();
    await expect(block(page, "shex").locator("summary")).toContainText("Subgraph read: 3 distinct triples");
    await block(page, "shex").locator("summary").click();
    await expect(subgraph(page, "shex")).toContainText('"Alice"');
    await expect(subgraph(page, "shex")).toContainText('"Bob"');
    await expect(subgraph(page, "shex")).not.toContainText("carol");
  });

  test("the subgraph is written in the format chosen, without validating again", async ({ page }) => {
    await page.locator("#shex-read-triples").check();
    await validate(page, "shex");
    await block(page, "shex").locator("summary").click();
    await expect(page.locator("#shex-read-triples-format")).toHaveValue("turtle");
    const timing = await page.locator("#shex-result .timing").textContent();
    await page.locator("#shex-read-triples-format").selectOption("ntriples");
    await expect(subgraph(page, "shex")).toContainText('<http://example.org/alice> <http://example.org/name> "Alice" .');
    await page.locator("#shex-read-triples-format").selectOption("rdfxml");
    await expect(subgraph(page, "shex")).toContainText("rdf:RDF");
    await expect(page.locator("#shex-result .timing")).toHaveText(timing);
  });

  // PlantUML is not served in the tests: they read the PlantUML source that
  // rudof writes, and not the diagram
  test("Visualize shows the subgraph as a diagram, and Text goes back to the viewer", async ({ page }) => {
    await page.locator("#shex-read-triples").check();
    await validate(page, "shex");
    await block(page, "shex").locator("summary").click();
    const button = page.locator("#shex-read-triples-visualize");
    const box = page.locator("#shex-read-triples-visual");
    await expect(button).toHaveText("Visualize");
    await expect(box).toBeHidden();
    await button.click();
    await expect(button).toHaveText("Text");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(subgraph(page, "shex")).toBeHidden();
    await expect(page.locator("#shex-read-triples-format")).toBeHidden();
    await expect(box).toBeVisible();
    const source = box.locator(".visual-source");
    await expect(source).toBeHidden();
    await box.getByRole("button", { name: "Show PlantUML source" }).click();
    await expect(source).toContainText("@startuml");
    await expect(source).toContainText("Alice");
    await expect(source).not.toContainText("carol");
    // A new validation draws its subgraph
    await setInput(page, "shex-shapemap", ":bob@:Person");
    await validate(page, "shex");
    await expect(source).not.toContainText("Alice");
    await expect(source).toContainText("Bob");
    await button.click();
    await expect(button).toHaveText("Visualize");
    await expect(box).toBeHidden();
    await expect(subgraph(page, "shex")).toBeVisible();
  });

  test("an error hides the subgraph", async ({ page }) => {
    await page.locator("#shex-read-triples").check();
    await validate(page, "shex");
    await expect(block(page, "shex")).toBeVisible();
    await setInput(page, "shex-schema", "this is not ShEx");
    await validate(page, "shex");
    await expect(page.locator("#shex-result")).toHaveAttribute("data-kind", "error");
    await expect(block(page, "shex")).toBeHidden();
  });
});

test("a permalink keeps the option and the format of the subgraph", async ({ page }) => {
  await open(page, "#validate/shex");
  await page.locator("#shex-read-triples").check();
  await validate(page, "shex");
  await block(page, "shex").locator("summary").click();
  await page.locator("#shex-read-triples-format").selectOption("ntriples");
  await expect(page).toHaveURL(/read-triples=true/);
  await expect(page).toHaveURL(/read-triples-format=ntriples/);
  await page.reload();
  await expect(page.locator("#shex-read-triples")).toBeChecked();
  await expect(page.locator("#shex-read-triples-format")).toHaveValue("ntriples");
});

test.describe("SHACL", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "#validate/shacl");
    await setInput(page, "shacl-data", DATA);
    await setInput(page, "shacl-shapes", SHAPES);
  });

  test("with the native engine, the subgraph is shown", async ({ page }) => {
    await page.locator("#shacl-read-triples").check();
    await validate(page, "shacl");
    await expect(page.locator("#shacl-result .verdict")).toHaveText(/^Conforms · 1 triple read \(1 distinct\)$/);
    await block(page, "shacl").locator("summary").click();
    await expect(subgraph(page, "shacl")).toContainText('"Alice"');
    await expect(subgraph(page, "shacl")).not.toContainText("Bob");
  });

  test("the SPARQL engine can't read triples, and validates without them", async ({ page }) => {
    await page.locator("#shacl-read-triples").check();
    await page.locator("#shacl-mode").selectOption("sparql");
    await expect(page.locator("#shacl-read-triples")).toBeDisabled();
    await validate(page, "shacl");
    await expect(page.locator("#shacl-result .verdict")).toHaveText("Conforms");
    await expect(block(page, "shacl")).toBeHidden();
    await page.locator("#shacl-mode").selectOption("native");
    await expect(page.locator("#shacl-read-triples")).toBeEnabled();
  });
});
