// Tables of results: validations as tables (the default format of ShEx,
// SHACL and DCTAP), sorted by clicking their headers.

import { test, expect, open } from "./fixtures.js";

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
  await header.click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await expect(nodes).toHaveText(sorted);
  await header.click();
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(nodes).toHaveText([...sorted].reverse());
  await header.click();
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
  await table.locator("th").first().press("Enter");
  await expect(first).toHaveText([...before].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));
});

test("the tables of CSV results are sorted too", async ({ page }) => {
  await open(page, "#validate/shex");
  await page.locator("#shex-result-format").selectOption("csv");
  await page.locator("#shex-validate").click();
  await page.locator("#shex-result .csv-switch button[data-view=table]").click();
  await expect(page.locator("#shex-result .csv-output th.sortable").first()).toBeVisible();
});
