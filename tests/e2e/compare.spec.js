// The Compare tab (compare.js): two RDF graphs (rudof 0.3.36, diffData), or
// two shapes of two ShEx schemas (compareSchemas). What rudof can't compare
// yet is in the menus, and can't be chosen.

import { test, expect, open, setInput } from "./fixtures.js";

const result = (page, prefix) => page.locator(`#${prefix}-result`);
const PREFIXES = "prefix : <http://example.org/>\n";

test.describe("Compare data", () => {
  test("says how the two graphs are related, with the triples only in one of them", async ({ page }) => {
    await open(page, "#compare/compare-data");
    await page.locator("#compare-data-validate").click();
    await expect(result(page, "compare-data").locator(".verdict")).toHaveText("The first graph is contained in the second one · 1 triple only in the second");
    await expect(result(page, "compare-data")).toHaveAttribute("data-kind", "fail");
    // The table: the prefixes of the data, links to the IRIs
    const rows = result(page, "compare-data").locator("tbody tr");
    await expect(rows).toHaveCount(1);
    // The example of the other tabs, and the same with a birth date for Carol
    await expect(rows.first().locator("td")).toHaveText(["Second", ":carol", ":birthDate", '"2001-07-04"^^xsd:date']);
    await expect(rows.first().locator("a.iri").first()).toHaveAttribute("href", "http://example.org/carol");
    // No blank nodes
    await expect(result(page, "compare-data").locator("li")).toHaveCount(0);
    // The report of rudof, and JSON
    await page.locator("#compare-data-result-format").selectOption("report");
    await expect(page.locator("#compare-data-output")).toContainText('Only in the second graph (1):\n  :carol :birthDate "2001-07-04"^^xsd:date .');
    await page.locator("#compare-data-result-format").selectOption("json");
    const json = JSON.parse(await page.locator("#compare-data-output").textContent());
    expect([json.relation, json.mode, json.onlyInSecond.length, json.report]).toEqual(["subgraph", "injective", 1, undefined]);
  });

  test("swaps the two graphs, and keeps them in the permalink", async ({ page }) => {
    await open(page, "#compare/compare-data");
    await page.locator("#compare-data-1-format").selectOption("n3");
    await page.locator("#compare-data-swap").click();
    await expect(page.locator("#compare-data-2-format")).toHaveValue("n3");
    await expect(page.locator("#compare-data-1-format")).toHaveValue("turtle");
    await expect(page.locator("#compare-data-1")).toHaveValue(/2001-07-04/);
    await page.locator("#compare-data-2-format").selectOption("turtle");
    await page.locator("#compare-data-validate").click();
    await expect(result(page, "compare-data").locator(".verdict")).toHaveText("The second graph is contained in the first one · 1 triple only in the first");
    const url = new URL(page.url());
    expect(url.hash).toBe("#compare/compare-data");
    expect(url.searchParams.get("data2")).toContain(':name "Carol" .');
    // The permalink opens the tab with the graphs
    await page.goto(url.href.replace("mode=injective", "mode=homomorphic"));
    await page.reload();
    await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 30_000 });
    await expect(page.locator("#tab-compare-data")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#compare-data-1")).toHaveValue(/2001-07-04/);
    await expect(page.locator("#compare-data-mode")).toHaveValue("homomorphic");
  });

  test("maps the blank nodes as the mode says", async ({ page }) => {
    await open(page, "#compare/compare-data");
    await setInput(page, "compare-data-1", `${PREFIXES}:a :p [] .`);
    await setInput(page, "compare-data-2", `${PREFIXES}:a :p [], [] .`);
    await page.locator("#compare-data-validate").click();
    await expect(result(page, "compare-data").locator(".verdict")).toHaveText(/^The first graph is contained in the second one/);
    await page.locator("#compare-data-mode").selectOption("homomorphic");
    await page.locator("#compare-data-validate").click();
    await expect(result(page, "compare-data").locator(".verdict")).toHaveText(/^The graphs are equivalent/);
    await expect(result(page, "compare-data")).toHaveAttribute("data-kind", "ok");
    // The same graph
    await setInput(page, "compare-data-2", `${PREFIXES}:a :p _:x .`);
    await page.locator("#compare-data-validate").click();
    await expect(result(page, "compare-data").locator(".verdict")).toHaveText(/^The graphs are isomorphic/);
    await expect(result(page, "compare-data")).toContainText("No differences");
  });

  test("says which data can't be read", async ({ page }) => {
    await open(page, "#compare/compare-data");
    await setInput(page, "compare-data-2", "not turtle");
    await page.locator("#compare-data-validate").click();
    await expect(result(page, "compare-data")).toHaveAttribute("data-kind", "error");
    await expect(page.locator("#compare-data-output")).toContainText("The second RDF data can't be read:");
    // rudof can still be used: no crash
    await expect(page.locator("#status")).not.toHaveText(/loaded again/);
  });

  test("has property graphs in its menu, which can't be chosen yet", async ({ page }) => {
    await open(page, "#compare/compare-data");
    await expect(page.locator("#compare-data-kind option")).toHaveText(["RDF", "Property graph (not in rudof yet)"]);
    await expect(page.locator('#compare-data-kind option[value="pg"]')).toHaveJSProperty("disabled", true);
    await expect(page.locator("#compare-data-mode option")).toHaveText(["Injective", "Homomorphic", "Entailment"]);
  });
});

test.describe("Compare schemas", () => {
  test("compares the first shapes of two ShEx schemas, property by property", async ({ page }) => {
    await open(page, "#compare/compare-schemas");
    await page.locator("#compare-schemas-validate").click();
    await expect(result(page, "compare-schemas").locator(".verdict")).toHaveText("The shape :Person of the first schema compared with the shape :Person of the second one");
    const report = page.locator("#compare-schemas-output");
    await expect(report).toContainText("Properties in shape 1 that are not in shape 2:\n  - http://example.org/birthDate");
    await expect(report).toContainText("Properties in shape 2 that are not in shape 1:\n  - http://example.org/email");
    expect(new URL(page.url()).searchParams.get("schema2")).toContain(":email");
  });

  test("compares the shapes written, as prefixed names or IRIs", async ({ page }) => {
    await open(page, "#compare/compare-schemas");
    await setInput(page, "compare-schemas-2", `${PREFIXES}:Other { :q . }\n:Person { :name . }`);
    await page.locator("#compare-schemas-2-label").fill("<http://example.org/Person>");
    await page.locator("#compare-schemas-validate").click();
    await expect(result(page, "compare-schemas").locator(".verdict")).toHaveText("The shape :Person of the first schema compared with the shape :Person of the second one");
    // A shape that the schema doesn't have, and an undeclared prefix
    await page.locator("#compare-schemas-2-label").fill(":Missing");
    await page.locator("#compare-schemas-validate").click();
    await expect(page.locator("#compare-schemas-output")).toContainText("Shape not found for label http://example.org/Missing");
    await page.locator("#compare-schemas-1-label").fill("foo:S");
    await page.locator("#compare-schemas-validate").click();
    await expect(page.locator("#compare-schemas-output")).toHaveText("The prefix of the shape foo:S is not declared in its schema");
  });

  test("says which schema can't be read", async ({ page }) => {
    await open(page, "#compare/compare-schemas");
    await setInput(page, "compare-schemas-2", ":S {");
    await page.locator("#compare-schemas-validate").click();
    await expect(result(page, "compare-schemas")).toHaveAttribute("data-kind", "error");
    await expect(page.locator("#compare-schemas-output")).toContainText("The second schema can't be read:");
  });

  test("has the languages and formats that rudof can't compare yet in its menus, which can't be chosen", async ({ page }) => {
    await open(page, "#compare/compare-schemas");
    await expect(page.locator("#compare-schemas-language option")).toHaveText(["ShEx", "SHACL (not in rudof yet)", "DCTAP (not in rudof yet)", "PGSchema (not in rudof yet)"]);
    await expect(page.locator("#compare-schemas-language option:disabled")).toHaveCount(3);
    await expect(page.locator("#compare-schemas-1-format option:disabled")).toHaveText(["ShExJ (not in rudof yet)", "ShExR (Turtle) (not in rudof yet)"]);
  });
});
