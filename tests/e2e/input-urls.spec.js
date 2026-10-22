// Inputs given by a URL (input-source.js): "Text | URL" next to the RDF
// data, the schemas and the queries. The page reads the URL when the tab
// runs. A URL can be a prefixed name, with the prefixes of the endpoint of
// the tab (es:E371 on Wikidata).

import { test, expect, open, setInput, hasEndpointsBuild } from "./fixtures.js";
import { sparqlEndpoint } from "./sparql-endpoint.js";

const WIKIDATA = "https://query.wikidata.org/sparql";
const E371 = "https://www.wikidata.org/wiki/Special:EntitySchemaText/E371";
const SCHEMA = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
start = @<human>
<human> EXTRA wdt:P31 { wdt:P31 [ wd:Q5 ] }`;

// The files of the URLs: the requests they get
async function files(page) {
  const requests = [];
  const bodies = {
    [E371]: SCHEMA,
    "https://files.example/people.nt": '<http://example.org/dave> <http://example.org/name> "Dave" .',
    "https://files.example/names.rq": "SELECT ?n WHERE { ?s <http://example.org/name> ?n }",
  };
  await page.route(/^https:\/\/(www\.wikidata\.org|files\.example)\//, (route) => {
    const url = route.request().url();
    requests.push(url);
    if (!(url in bodies)) return route.fulfill({ status: 404, body: "Not found", headers: { "access-control-allow-origin": "*" } });
    return route.fulfill({ body: bodies[url], headers: { "access-control-allow-origin": "*" } });
  });
  return requests;
}

const source = (page, id, name) => page.locator(`#${id}-source [data-source="${name}"]`);
const result = (page, prefix) => page.locator(`#${prefix}-result:not([data-kind="running"])`);

test.describe("with rudof with endpoints", () => {
  test.skip(!hasEndpointsBuild, "no rudof with endpoints in node_modules or RUDOF_ENDPOINTS_DIR");

  test("a ShEx schema of Wikidata, by a prefixed name of the endpoint", async ({ page }) => {
    const requests = await files(page);
    await sparqlEndpoint(page, WIKIDATA, "prefix wd: <http://www.wikidata.org/entity/>\nprefix wdt: <http://www.wikidata.org/prop/direct/>\nwd:Q42 wdt:P31 wd:Q5 .");
    await open(page, "#validate/shex");
    await page.locator("#shex-endpoint").fill(WIKIDATA);
    await source(page, "shex-schema", "url").click();
    await expect(page.locator("#shex-schema-url")).toBeFocused();
    await page.locator("#shex-schema-url").fill("es:E371");
    // The URL of the prefixed name, with the prefixes of Wikidata
    await expect(page.locator("#shex-schema-url-hint")).toHaveText(`→ ${E371}`);
    await setInput(page, "shex-shapemap", "wd:Q42@START");
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 1 node validated on query.wikidata.org", { timeout: 30_000 });
    expect(requests).toEqual([E371]);
    await expect(page.locator("#shex-schema-url-hint")).toHaveText(`Read ${SCHEMA.length} characters from ${E371}`);
    // The permalink has the URL, not the schema
    const params = new URL(page.url()).searchParams;
    expect(params.get("schema-url")).toBe("es:E371");
    expect(params.has("schema")).toBe(false);
    await open(page, `?${params}#validate/shex`);
    await expect(source(page, "shex-schema", "url")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#shex-schema-url")).toHaveValue("es:E371");
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 1 node validated on query.wikidata.org", { timeout: 30_000 });
  });
});

test("the RDF data from a URL, in the format of its file, and Text gives back the text", async ({ page }) => {
  await files(page);
  await open(page, "#data/rdf");
  const text = await page.locator("#rdf-data").evaluate((t) => t.value);
  await source(page, "rdf-data", "url").click();
  await expect(page.locator('[data-editor-for="rdf-data"]')).toBeHidden();
  await page.locator("#rdf-data-url").fill("https://files.example/people.nt");
  await page.locator("#rdf-validate").click();
  await expect(result(page, "rdf").locator(".verdict")).toHaveText(/^1 triple, N-Triples →/);
  await expect(page.locator("#rdf-data-format")).toHaveValue("ntriples");
  // Text: the text that the input had
  await source(page, "rdf-data", "text").click();
  await expect(page.locator('[data-editor-for="rdf-data"]')).toBeVisible();
  await expect(page.locator("#rdf-data")).toHaveJSProperty("value", text);
  // Edit as text: the text of the URL, in the editor
  await source(page, "rdf-data", "url").click();
  await expect(page.locator("#rdf-data-url")).toHaveValue("https://files.example/people.nt");
  await page.locator("#rdf-data-url-box .url-to-text").click();
  await expect(source(page, "rdf-data", "text")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#rdf-data")).toHaveJSProperty("value", '<http://example.org/dave> <http://example.org/name> "Dave" .');
});

test("the SPARQL query from a URL", async ({ page }) => {
  await files(page);
  await open(page, "#query/sparql");
  await setInput(page, "sparql-data", '<http://example.org/dave> <http://example.org/name> "Dave" .');
  await source(page, "sparql-query", "url").click();
  await page.locator("#sparql-query-url").fill("https://files.example/names.rq");
  await page.locator("#sparql-validate").click();
  await expect(result(page, "sparql").locator(".verdict")).toHaveText(/^1 result/);
  expect(new URL(page.url()).searchParams.get("query-url")).toBe("https://files.example/names.rq");
});

test("a URL that can't be read is an error that says which input and why", async ({ page }) => {
  await files(page);
  await open(page, "#validate/shex");
  await source(page, "shex-schema", "url").click();
  await page.locator("#shex-schema-url").fill("https://files.example/none.shex");
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result")).toHaveAttribute("data-kind", "error");
  await expect(page.locator("#shex-output")).toContainText("The ShEx schema can't be read from https://files.example/none.shex: 404");
});

test("an example of a manifest puts its inputs as text", async ({ page }) => {
  await page.route("https://manifests.example/m.yaml", (route) =>
    route.fulfill({ headers: { "access-control-allow-origin": "*" }, body: "- comment: Data\n  data: '<a> <b> <c> .'\n  action: data\n" }),
  );
  await open(page, `?manifestURL=${encodeURIComponent("https://manifests.example/m.yaml")}#data/rdf`);
  await source(page, "rdf-data", "url").click();
  await page.locator("#manifest-examples").selectOption({ label: "Data" });
  await expect(source(page, "rdf-data", "text")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#rdf-data")).toHaveJSProperty("value", "<a> <b> <c> .");
});
