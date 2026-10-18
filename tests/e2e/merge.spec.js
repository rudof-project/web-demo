// More RDF data, merged with the data of a tab, to convert, validate and
// query them (extra-data.js).

import { test, expect, open, setInput } from "./fixtures.js";

const DAVE = '<http://example.org/dave> <http://example.org/name> "Dave" .';

test("the RDF tab converts its data merged with more RDF data", async ({ page }) => {
  await open(page, "#data/rdf");
  await page.locator("#rdf-validate").click();
  const before = Number((await page.locator("#rdf-result .verdict").textContent()).match(/^(\d+)/)[1]);
  await page.locator("#rdf-add-data").click();
  const more = page.locator("#rdf-extra-data .extra-data");
  await expect(more).toHaveCount(1);
  await expect(more.locator("label")).toHaveText("RDF data 2");
  const id = await more.locator("textarea").getAttribute("id");
  await setInput(page, id, DAVE);
  await more.locator("select").selectOption("ntriples");
  await page.locator("#rdf-validate").click();
  await expect(page.locator("#rdf-result .verdict")).toHaveText(`${before + 1} triples, Turtle and 1 more RDF data → N-Triples`);
  await expect(page.locator("#rdf-output")).toContainText("<http://example.org/dave>");

  // In the permalink, in its order
  const params = new URL(page.url()).searchParams;
  expect([params.get("data-2"), params.get("data-2-format")]).toEqual([DAVE, "ntriples"]);
  await open(page, `?${params}#data/rdf`);
  await expect(page.locator("#rdf-extra-data .extra-data")).toHaveCount(1);
  await page.locator("#rdf-validate").click();
  await expect(page.locator("#rdf-output")).toContainText("<http://example.org/dave>");

  // Removed
  await page.locator("#rdf-extra-data .remove-data").click();
  await expect(page.locator("#rdf-extra-data .extra-data")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("data-2")).toBe(false);
});

test("validations and queries use the RDF data merged", async ({ page }) => {
  await open(page, "#validate/shex");
  await setInput(page, "shex-schema", "prefix : <http://example.org/>\nprefix xsd: <http://www.w3.org/2001/XMLSchema#>\n:P { :name xsd:string ; :age xsd:integer }");
  await setInput(page, "shex-data", "prefix : <http://example.org/>\n:alice :name \"Alice\" .");
  await setInput(page, "shex-shapemap", ":alice@:P");
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result .verdict")).toHaveText(/^Does not conform/);
  await page.locator("#shex-add-data").click();
  await setInput(page, await page.locator("#shex-extra-data textarea").getAttribute("id"), "prefix : <http://example.org/>\n:alice :age 23 .");
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result .verdict")).toHaveText("Conforms: 1 node validated");

  await open(page, "#query/sparql");
  await page.locator("#sparql-add-data").click();
  await setInput(page, await page.locator("#sparql-extra-data textarea").getAttribute("id"), "prefix foaf: <http://xmlns.com/foaf/0.1/>\n<http://example.org/dave> a foaf:Person ; foaf:name \"Dave\" .");
  await page.locator("#sparql-validate").click();
  await expect(page.locator("#sparql-result .verdict")).toHaveText("4 results");
});

test("the RDF data added are removed when an example replaces the data", async ({ page }) => {
  await page.route("https://manifests.example/m.yaml", (route) =>
    route.fulfill({ headers: { "access-control-allow-origin": "*" }, body: "- comment: Data\n  data: '<a> <b> <c> .'\n  action: data\n" }),
  );
  await open(page, `?manifestURL=${encodeURIComponent("https://manifests.example/m.yaml")}#data/rdf`);
  await page.locator("#rdf-add-data").click();
  await expect(page.locator("#rdf-extra-data .extra-data")).toHaveCount(1);
  await page.locator("#manifest-examples").selectOption({ label: "Data" });
  await expect(page.locator("#rdf-data")).toHaveJSProperty("value", "<a> <b> <c> .");
  await expect(page.locator("#rdf-extra-data .extra-data")).toHaveCount(0);
});
