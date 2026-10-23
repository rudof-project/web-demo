// Inputs as diagrams: Visualize, next to the RDF data and the ShEx schema,
// shows the diagram of the input in place of its editor, and Edit shows the
// editor again. PlantUML is not served in the tests: they read the PlantUML
// source that rudof writes, and not the diagram.

import { test, expect, open, setInput, editor } from "./fixtures.js";

test("Visualize shows the RDF data as a diagram, and Edit goes back to the editor", async ({ page }) => {
  await open(page);
  const button = page.locator("#rdf-data-visualize");
  const box = page.locator("#rdf-data-visual");
  await expect(button).toHaveText("Visualize");
  await expect(box).toBeHidden();
  await button.click();
  await expect(button).toHaveText("Edit");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(editor(page, "rdf-data")).toBeHidden();
  await expect(box).toBeVisible();
  // The source of the diagram, hidden until it is asked for
  const source = box.locator(".visual-source");
  await expect(source).toBeHidden();
  await box.getByRole("button", { name: "Show PlantUML source" }).click();
  await expect(source).toBeVisible();
  await expect(source).toContainText("@startuml");
  await expect(source).toContainText("alice");
  await expect(box.locator(".diagram-image")).toContainText(/Loading PlantUML|Drawing the diagram|Could not draw the diagram/);
  await box.getByRole("button", { name: "Hide PlantUML source" }).click();
  await expect(source).toBeHidden();
  // Edit
  await button.click();
  await expect(button).toHaveText("Visualize");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(box).toBeHidden();
  await expect(editor(page, "rdf-data")).toBeVisible();
});

test("Visualize shows the ShEx schema as a diagram", async ({ page }) => {
  await open(page, "#validate/shex");
  await page.locator("#shex-schema-visualize").click();
  await expect(editor(page, "shex-schema")).toBeHidden();
  const source = page.locator("#shex-schema-visual .visual-source");
  await expect(source).toContainText("@startuml");
  await expect(source).toContainText(":Person");
  // The RDF data of the tab, as well
  await page.locator("#shex-data-visualize").click();
  await expect(page.locator("#shex-data-visual .visual-source")).toContainText("alice");
  await expect(editor(page, "shex-data")).toBeHidden();
});

test("Visualize says why an input can't be drawn", async ({ page }) => {
  await open(page, "#validate/shex");
  await setInput(page, "shex-schema", "<S> { :p . ");
  await page.locator("#shex-schema-visualize").click();
  await expect(page.locator("#shex-schema-visual .diagram-status.error")).toContainText("Could not visualize it");
});

test("an input that the page changes goes back to its editor", async ({ page }) => {
  await open(page);
  await page.locator("#rdf-result-format").selectOption("ntriples");
  await page.locator("#rdf-validate").click();
  await expect(page.locator("#rdf-result")).toHaveAttribute("data-kind", "ok");
  await page.locator("#rdf-data-visualize").click();
  await expect(editor(page, "rdf-data")).toBeHidden();
  await page.locator("#rdf-use-as-input").click();
  await expect(page.locator("#rdf-data-visualize")).toHaveText("Visualize");
  await expect(page.locator("#rdf-data-visual")).toBeHidden();
  await expect(editor(page, "rdf-data")).toBeVisible();
});
