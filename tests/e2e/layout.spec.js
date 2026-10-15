// The layout of the boxes in the page: layouts, splitters and full screen.

import { test, expect, editor, open } from "./fixtures.js";

const box = (page, selector) => page.locator(selector).evaluate((e) => e.getBoundingClientRect().toJSON());

test("the boxes of a row are side by side, with a splitter between them", async ({ page }) => {
  await open(page);
  const input = await box(page, ".field:has(#rdf-data)");
  const output = await box(page, ".field:has(#rdf-result)");
  expect(output.left).toBeGreaterThan(input.right);
  await expect(page.locator("#panel-rdf .splitter")).toBeVisible();
});

test("dragging the splitter changes the widths", async ({ page }) => {
  await open(page);
  const before = await box(page, ".field:has(#rdf-data)");
  const splitter = await box(page, "#panel-rdf .splitter");
  await page.mouse.move(splitter.x + splitter.width / 2, splitter.y + 40);
  await page.mouse.down();
  await page.mouse.move(splitter.x - 200, splitter.y + 40, { steps: 5 });
  await page.mouse.up();
  const after = await box(page, ".field:has(#rdf-data)");
  expect(after.width).toBeLessThan(before.width - 150);
});

test("the layout menu puts the boxes one above the other, swapped, in all the tabs", async ({ page }) => {
  await open(page);
  await page.locator("#layout").selectOption("stacked-swapped");
  await expect(page.locator("#panel-rdf .splitter")).toBeHidden();
  const input = await box(page, ".field:has(#rdf-data)");
  const output = await box(page, ".field:has(#rdf-result)");
  expect(input.top).toBeGreaterThan(output.bottom);
  expect(input.width).toBeCloseTo(output.width, 0);

  // Another tab, after the page is opened again
  await open(page, "#query/sparql");
  await expect(page.locator("#layout")).toHaveValue("stacked-swapped");
  const data = await box(page, ".field:has(#sparql-data)");
  const query = await box(page, ".field:has(#sparql-query)");
  expect(data.top).toBeGreaterThan(query.bottom);
});

test("an editor can be shown on the whole window, and back", async ({ page }) => {
  await open(page, "#validate/shex");
  const field = page.locator(".field:has(#shex-schema)");
  await field.locator(".maximize").click();
  await expect(field).toHaveClass(/maximized/);
  const size = page.viewportSize();
  const rect = await box(page, '.cm-editor[data-editor-for="shex-schema"]');
  expect(rect.height).toBeGreaterThan(size.height * 0.8);
  expect(rect.width).toBeGreaterThan(size.width * 0.9);
  await expect(editor(page, "shex-schema").locator(".cm-content")).toBeFocused();

  // Ctrl+Enter still validates
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#shex-result")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(field).not.toHaveClass(/maximized/);
});

test("a result can be shown on the whole window, and back", async ({ page }) => {
  await open(page, "#query/sparql");
  await page.locator("#sparql-validate").click();
  const result = page.locator("#sparql-result");
  await result.locator(".maximize").click();
  await expect(result).toHaveClass(/maximized/);
  const rect = await box(page, "#sparql-result");
  expect(rect.height).toBeGreaterThan(page.viewportSize().height * 0.9);
  await result.locator(".maximize").click();
  await expect(result).not.toHaveClass(/maximized/);
});

test("the converted data can be shown on the whole window", async ({ page }) => {
  await open(page);
  await page.locator("#rdf-validate").click();
  const field = page.locator(".field:has(#rdf-result)");
  await field.locator(".maximize").click();
  const rect = await box(page, '.cm-viewer[data-viewer-for="rdf-output"]');
  expect(rect.height).toBeGreaterThan(page.viewportSize().height * 0.7);
});

test("the results can be made taller", async ({ page }) => {
  await open(page, "#query/sparql");
  await page.locator("#sparql-validate").click();
  await expect(page.locator("#sparql-result")).toHaveCSS("resize", "vertical");
  await expect(page.locator("#rdf-result")).toHaveCSS("resize", "vertical");
});
