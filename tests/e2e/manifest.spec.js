// The examples of a manifest: ?manifestURL=… lists them, and choosing one
// loads it into the editors.

import { test, expect, open } from "./fixtures.js";

const MANIFEST_URL = "https://manifests.example/doc/manifest.yaml";

const FILES = {
  "https://manifests.example/doc/manifest.yaml": `
- schemaLabel: person
  schemaURL: ../examples/person.shex
  dataLabel: Alice
  data: |
    prefix : <http://example.org/>
    :alice :name "Alice" .
  queryMap: ":alice@<http://example.org/Person>"
  status: conformant
  comment: Alice has a name.
- schemaLabel: person
  schemaURL: ../examples/person.shex
  dataLabel: Bob
  dataURL: ../examples/bob.ttl
  queryMap: |
    <http://example.org/bob>@START
  status: nonconformant
- schemaLabel: Wikidata
  schema: "<S> {}"
  dataLabel: from the query service
  neighborhood: sparql
  endpoint: https://query.wikidata.org/sparql
  queryMap: "<x>@<S>"
`,
  "https://manifests.example/examples/person.shex": `prefix : <http://example.org/>
prefix xsd: <http://www.w3.org/2001/XMLSchema#>
start = @:Person
:Person { :name xsd:string }`,
  "https://manifests.example/examples/bob.ttl": `prefix : <http://example.org/>
:bob :name 23 .`,
};

test.beforeEach(async ({ page }) => {
  await page.route("https://manifests.example/**", (route) => {
    const body = FILES[route.request().url()];
    return body === undefined
      ? route.fulfill({ status: 404, body: "Not found" })
      : route.fulfill({ body, headers: { "access-control-allow-origin": "*" } });
  });
});

const select = (page) => page.locator("#manifest-examples");

test("without a manifest, there is no list of examples", async ({ page }) => {
  await open(page);
  await expect(page.locator("#manifest")).toBeHidden();
});

test("lists the examples of the manifest, grouped by schema", async ({ page }) => {
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST_URL)}`);
  await expect(page.locator("#manifest")).toBeVisible();
  await expect(page.locator("#manifest-link")).toHaveAttribute("href", MANIFEST_URL);
  await expect(select(page)).toBeEnabled();
  await expect(select(page).locator("optgroup")).toHaveCount(2);
  await expect(select(page).locator('optgroup[label="person"] option')).toHaveText(["✓ Alice", "✗ Bob"]);
  await expect(select(page).locator('optgroup[label="Wikidata"] option')).toBeDisabled();
});

test("loads the chosen example into the editors, and validates it", async ({ page }) => {
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST_URL)}`);
  await select(page).selectOption({ label: "✗ Bob" });
  await expect(page.locator("#panel-shex")).toBeVisible();
  await expect(page.locator("#shex-schema")).toHaveJSProperty("value", FILES["https://manifests.example/examples/person.shex"]);
  await expect(page.locator("#shex-data")).toHaveJSProperty("value", FILES["https://manifests.example/examples/bob.ttl"]);
  await expect(page.locator("#shex-shapemap")).toHaveJSProperty("value", "<http://example.org/bob>@START\n");
  await expect(page.locator("#manifest-note")).toContainText("Expected: nonconformant.");
  expect(new URL(page.url()).searchParams.get("example")).toBe("2");

  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result .verdict")).toHaveText(/^Does not conform.*\(as the manifest expects\)$/);
});

test("?example= loads an example when the page opens", async ({ page }) => {
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST_URL)}&example=1#data/rdf`);
  await expect(page.locator("#panel-shex")).toBeVisible();
  await expect.poll(() => page.locator("#shex-data").inputValue()).toMatch(/:alice :name "Alice"/);
  await expect(page.locator("#manifest-note")).toContainText("Alice has a name.");
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result .verdict")).toHaveText(/^Conforms.*\(as the manifest expects\)$/);
});

test("says when the manifest can't be read", async ({ page }) => {
  await open(page, "?manifestURL=https://manifests.example/missing.yaml");
  await expect(page.locator("#manifest-note")).toHaveText(/Could not load the manifest: .*404/);
  await expect(select(page)).toBeDisabled();
});
