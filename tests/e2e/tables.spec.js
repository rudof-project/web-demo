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

test("the border of a column changes its width, as in a spreadsheet", async ({ page }) => {
  await open(page, "#validate/shacl");
  await page.locator("#shacl-validate").click();
  const table = page.locator("#shacl-result table.report");
  await expect(table).toBeVisible();
  await table.scrollIntoViewIfNeeded();
  const th = (i) => table.locator("th").nth(i);
  const width = async (i) => (await th(i).boundingBox()).width;
  const before = [await width(0), await width(1), await width(2)];
  // Drag the border of the third column 100 px to the left
  const handle = await th(2).locator(".col-resizer").boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 100, handle.y + handle.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(Math.abs((await width(2)) - (before[2] - 100))).toBeLessThanOrEqual(2);
  // The other columns keep their widths, and their names
  expect(Math.abs((await width(0)) - before[0])).toBeLessThanOrEqual(1);
  expect(Math.abs((await width(1)) - before[1])).toBeLessThanOrEqual(1);
  expect(await th(0).locator(".th-label").evaluate((l) => l.scrollWidth <= l.clientWidth)).toBe(true);
  await expect(th(2).locator(".filter-button")).toBeVisible();
  // Sorting is still a click on the name
  await th(1).locator(".th-label").click();
  await expect(th(1)).toHaveAttribute("aria-sort", "ascending");
  // The widths stay when the tab runs again
  await page.locator("#shacl-validate").click();
  await expect(table).toHaveClass(/resized/);
  expect(Math.abs((await width(2)) - (before[2] - 100))).toBeLessThanOrEqual(2);
  // A double click gives the table its widths again
  await th(2).locator(".col-resizer").dblclick();
  await expect(table).not.toHaveClass(/resized/);
  expect(Math.abs((await width(2)) - before[2])).toBeLessThanOrEqual(2);
});

// Drags the border of a column
async function dragBorder(page, th, dx) {
  const box = await th.locator(".col-resizer").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
}

test("the columns of the table of the DCTAP profile change their widths too", async ({ page }) => {
  await open(page, "#validate/dctap");
  await page.locator('#panel-dctap [data-view="table"]').first().click();
  const table = page.locator("#dctap-table table.csv-table");
  await expect(table).toBeVisible();
  const th = (i) => table.locator("thead th").nth(i);
  const width = async (i) => (await th(i).boundingBox()).width;
  // The column of the buttons has no border
  await expect(table.locator("thead th.row-actions .col-resizer")).toHaveCount(0);
  const before = [await width(0), await width(1)];
  await dragBorder(page, th(1), 60);
  expect(Math.abs((await width(1)) - (before[1] + 60))).toBeLessThanOrEqual(2);
  expect(Math.abs((await width(0)) - before[0])).toBeLessThanOrEqual(1);
  // The cells can still be edited
  await table.locator("tbody tr").first().locator("input").nth(1).fill("A person");
  expect(await page.locator("#dctap-schema").evaluate((t) => t.value)).toMatch(/\nPerson,A person,:name,/);
  // Drawn again (the text changes), with the same widths
  await page.locator('#panel-dctap [data-view="csv"]').first().click();
  await page.locator('#panel-dctap [data-view="table"]').first().click();
  expect(Math.abs((await width(1)) - (before[1] + 60))).toBeLessThanOrEqual(2);
});
