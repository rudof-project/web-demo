// The page on a phone: the section tabs are visible, nothing goes past the
// right edge of the screen, and the fields have text of 16 px (iOS zooms in
// on a field with smaller text when it gets the focus).

import { devices } from "@playwright/test";
import { test, expect, open } from "./fixtures.js";

const { defaultBrowserType, ...phone } = devices["iPhone 13"];
test.use(phone);

const SECTIONS = ["Data", "Schema", "Validate", "Query", "Compare", "Generate"];

test("the section tabs are visible, and the Layout menu is not", async ({ page }) => {
  await open(page, "#validate/shex");
  for (const name of SECTIONS) {
    const tab = page.getByRole("tab", { name, exact: true }).first();
    await expect(tab).toBeVisible();
    const box = await tab.boundingBox();
    expect(box.x + box.width, `${name} is inside the screen`).toBeLessThanOrEqual(phone.viewport.width);
  }
  await expect(page.locator("#layout")).toBeHidden();
  await page.getByRole("tab", { name: "Generate", exact: true }).click();
  await expect(page.locator("#panel-generate")).toBeVisible();
});

for (const fragment of ["data/rdf", "schema/convert", "validate/shex", "validate/shacl", "query/sparql", "compare/compare-data", "generate/gen-shacl"]) {
  test(`#${fragment}: no horizontal scroll, and fields of 16 px`, async ({ page }) => {
    await open(page, `#${fragment}`);
    const { overflow, small } = await page.evaluate(() => {
      const visible = (e) => e.getBoundingClientRect().width > 0 && !e.closest("[hidden]");
      const fields = [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]), select, .cm-editor[data-editor-for] .cm-content")].filter(visible);
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        small: fields.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.id || e.className),
      };
    });
    expect(overflow).toBe(0);
    expect(small).toEqual([]);
  });
}
