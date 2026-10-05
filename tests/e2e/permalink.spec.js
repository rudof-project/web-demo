// Permalinks: after each operation the URL has the inputs of the tab shown,
// the Permalink button copies it, and opening it puts the inputs back.

import { test, expect, open, setInput } from "./fixtures.js";
import { queryString } from "../../permalink.js";

const query = (page) => new URL(page.url()).searchParams;

const SCHEMA = `PREFIX : <http://hl7.org/fhir/>
start = @<S>
<S> { :subject IRI }`;
const DATA = `PREFIX : <http://hl7.org/fhir/>
<Obs1> :subject <Patient2> .`;

test("the page opens without parameters", async ({ page }) => {
  await open(page);
  expect(new URL(page.url()).search).toBe("");
});

test("validating with ShEx writes the inputs in the URL", async ({ page }) => {
  await open(page, "#validate/shex");
  await page.locator("#shex-result-format").selectOption("details");
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result")).toBeVisible();
  const params = query(page);
  expect(params.get("schema")).toBe(await page.locator("#shex-schema").inputValue());
  expect(params.get("data")).toBe(await page.locator("#shex-data").inputValue());
  expect(params.get("shape-map")).toBe(await page.locator("#shex-shapemap").inputValue());
  expect(params.get("schema-format")).toBe("shexc");
  expect(params.get("result-format")).toBe("details");
  expect(new URL(page.url()).hash).toBe("#validate/shex");
  // Written as encodeURIComponent writes it, with %20 for spaces
  expect(new URL(page.url()).search).toContain("schema=prefix%20%3A%20%3Chttp%3A%2F%2Fexample.org%2F%3E%0A");
});

test("a link in the style of shex.js opens the ShEx tab with its inputs", async ({ page }) => {
  const search = queryString([["schema", SCHEMA], ["data", DATA], ["shape-map", "<Obs1>@START\n"], ["interface", "human"]]);
  await open(page, `?${search}`);
  await expect(page.locator("#panel-shex")).toBeVisible();
  await expect(page.locator("#shex-schema")).toHaveJSProperty("value", SCHEMA);
  await expect(page.locator("#shex-data")).toHaveJSProperty("value", DATA);
  await expect(page.locator("#shex-shapemap")).toHaveJSProperty("value", "<Obs1>@START\n");
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result .verdict")).toHaveText(/^Conforms/);
  // Parameters of other pages are not kept
  expect(query(page).has("interface")).toBe(false);
});

test("a permalink of a tab opens that tab with its inputs and options", async ({ page }) => {
  const search = queryString([["data", "<http://e.org/a> <http://e.org/p> \"1\" ."], ["data-format", "ntriples"], ["result-format", "jsonld"]]);
  await open(page, `?${search}#data/rdf`);
  await expect(page.locator("#rdf-data-format")).toHaveValue("ntriples");
  await expect(page.locator("#rdf-result-format")).toHaveValue("jsonld");
  await page.locator("#rdf-validate").click();
  await expect(page.locator("#rdf-result .verdict")).toHaveText("1 triple, N-Triples → JSON-LD");
});

test("the SPARQL result format is chosen once the query has results", async ({ page }) => {
  const search = queryString([["query", "SELECT * WHERE { ?s ?p ?o } LIMIT 1"], ["result-format", "csv"]]);
  await open(page, `?${search}#query/sparql`);
  await page.locator("#sparql-validate").click();
  await expect(page.locator("#sparql-result-format")).toHaveValue("csv");
  expect(query(page).get("result-format")).toBe("csv");
});

test("choosing another tab gives the URL the inputs of that tab", async ({ page }) => {
  await open(page, "#validate/shex");
  await page.locator("#shex-validate").click();
  await page.locator("#tab-query").click();
  expect(new URL(page.url()).hash).toBe("#query/sparql");
  expect(query(page).has("shape-map")).toBe(false);
  expect(query(page).get("query")).toBe(await page.locator("#sparql-query").inputValue());
});

test("the Permalink button copies the URL with the inputs as they are", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, "#validate/shacl");
  await setInput(page, "shacl-data", "prefix : <http://example.org/>\n:dave a :Person .");
  await page.locator("#permalink").click();
  await expect(page.locator("#permalink")).toHaveText("Copied");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(page.url());
  const params = new URL(copied).searchParams;
  expect(params.get("data")).toBe("prefix : <http://example.org/>\n:dave a :Person .");
  expect(params.get("shapes")).toBe(await page.locator("#shacl-shapes").inputValue());
  expect(new URL(copied).hash).toBe("#validate/shacl");
  await expect(page.locator("#permalink")).toHaveText("Permalink");
});
