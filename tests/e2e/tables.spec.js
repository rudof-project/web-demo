// Tables of results: validations as tables (the default format of ShEx,
// SHACL and DCTAP), sorted by clicking their headers and filtered by the
// values of their columns.

import { test, expect, open, setInput } from "./fixtures.js";

const column = (table, i) => table.locator(`tbody tr td:nth-child(${i})`);

test("ShEx results are a table, with a row of each node and shape", async ({ page }) => {
  await open(page, "#validate/shex");
  await expect(page.locator("#shex-result-format")).toHaveValue("table");
  await page.locator("#shex-validate").click();
  const table = page.locator("#shex-result table.report");
  await expect(table.locator("th")).toHaveText([/^Node/, /^Shape/, /^Status/, /^Details/]);
  await expect(table.locator("tr.fail td.verdict-cell")).toHaveText(["FAIL"]);
  await expect(table.locator("tr.fail")).toContainText(":bob");
  // The other formats are as rudof writes them
  await page.locator("#shex-result-format").selectOption("compact");
  await expect(page.locator("#shex-result .output")).toContainText("╭");
});

test("clicking a header sorts the rows, and again in the other order", async ({ page }) => {
  await open(page, "#validate/shex");
  await page.locator("#shex-validate").click();
  const table = page.locator("#shex-result table.report");
  const nodes = column(table, 1);
  const before = await nodes.allTextContents();
  const sorted = [...before].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  const header = table.locator("th").first();
  await header.locator(".th-label").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await expect(nodes).toHaveText(sorted);
  await header.locator(".th-label").click();
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(nodes).toHaveText([...sorted].reverse());
  await header.locator(".th-label").click();
  await expect(header).toHaveAttribute("aria-sort", "none");
  await expect(nodes).toHaveText(before);
});

test("the solutions of SPARQL queries are sorted too", async ({ page }) => {
  await open(page, "#query/sparql");
  await page.locator("#sparql-validate").click();
  const table = page.locator("#sparql-result table.solutions");
  await expect(table).toBeVisible();
  const first = column(table, 1);
  const before = await first.allTextContents();
  await table.locator("th .th-label").first().press("Enter");
  await expect(first).toHaveText([...before].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));
});

test("the tables of CSV results are sorted too", async ({ page }) => {
  await open(page, "#validate/shex");
  await page.locator("#shex-result-format").selectOption("csv");
  await page.locator("#shex-validate").click();
  await page.locator("#shex-result .csv-switch button[data-view=table]").click();
  await expect(page.locator("#shex-result .csv-output th.sortable").first()).toBeVisible();
});

test("a column is filtered by its values, as in a spreadsheet", async ({ page }) => {
  await open(page, "#validate/shex");
  await page.locator("#shex-validate").click();
  const table = page.locator("#shex-result table.report");
  const rows = table.locator("tbody tr:visible");
  const total = await rows.count();
  // The filter of the Status column
  const status = table.locator("th").nth(2);
  await status.locator(".filter-button").click();
  const menu = page.locator(".filter-menu");
  await expect(menu).toBeVisible();
  await expect(menu.locator(".filter-values .filter-text")).toHaveText(["FAIL", "OK"]);
  await menu.getByRole("checkbox", { name: /^OK/ }).uncheck();
  await expect(rows.locator("td.verdict-cell")).toHaveText(["FAIL"]);
  await expect(table.locator("caption")).toHaveText(`Showing 1 of ${total} rows`);
  await expect(status).toHaveClass(/filtered/);
  // Escape closes the menu, and the filter stays
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(rows).toHaveCount(1);
  // Clear filter shows all the rows again
  await status.locator(".filter-button").click();
  await menu.getByRole("button", { name: "Clear filter" }).click();
  await expect(rows).toHaveCount(total);
  await expect(table.locator("caption")).toBeHidden();
});

test("the details in the table keep their lines, as in the Details format", async ({ page }) => {
  await open(page, "#validate/shex");
  await setInput(page, "shex-schema", "prefix : <http://example.org/>\n:R [:a] OR { :p @:R + ; :p . * }");
  await setInput(page, "shex-data", "prefix : <http://example.org/>\n:a :p :d .\n:b :p :a .");
  await setInput(page, "shex-shapemap", ":a@:R");
  await page.locator("#shex-validate").click();
  const details = page.locator("#shex-result table.report tbody td .details").first();
  expect(await details.evaluate((d) => d.textContent)).toBe("OR passed (:a@[:a])\n└── Reference to [:a] passes node :a");
  // Two lines on the page
  const lineHeight = await details.evaluate((d) => parseFloat(getComputedStyle(d).lineHeight));
  expect((await details.boundingBox()).height).toBeGreaterThan(1.5 * lineHeight);
});
