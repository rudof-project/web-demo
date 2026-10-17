// The examples of a manifest: ?manifestURL=… lists them, and choosing one
// loads it into the editors of the tab of its action, and runs it.

import { test, expect, open, hasEndpointsBuild } from "./fixtures.js";

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
  "https://manifests.example/doc/actions.yaml": `
- dataLabel: a property graph
  dataURL: ../examples/graph.pg
  dataFormat: yars-pg
  action: data
- dataLabel: names
  data: |
    prefix : <http://example.org/>
    :alice :name "Alice" .
  dataFormat: turtle
  query: "SELECT ?name WHERE { ?p <http://example.org/name> ?name }"
  action: query
- schemaLabel: SHACL
  dataLabel: Alice without a name
  data: |
    prefix : <http://example.org/>
    :alice a :Person .
  schema: |
    prefix : <http://example.org/>
    prefix sh: <http://www.w3.org/ns/shacl#>
    :PersonShape a sh:NodeShape ; sh:targetClass :Person ; sh:property [ sh:path :name ; sh:minCount 1 ] .
  schemaFormat: turtle
  validationEngine: shacl
  status: nonconformant
  action: validate
`,
  "https://manifests.example/doc/dctap.yaml": `
- schemaLabel: DCTAP
  schemaURL: ../examples/person.csv
  prefixes: |
    BASE <http://example.org/>
    PREFIX : <http://example.org/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
  picklistSeparator: "|"
  data: |
    prefix : <http://example.org/>
    :bob :status :Unknown .
  queryMap: ":bob@:Person"
  status: nonconformant
  comment: Bob has no name, and an unknown status
`,
  "https://manifests.example/doc/schemas.yaml": `
- schemaURL: ../examples/person.shex
  action: schema
  comment: A ShEx schema
- schemaURL: ../examples/person.csv
  prefixes: "PREFIX : <http://example.org/>"
  picklistSeparator: bar
  action: schema
  comment: A DCTAP profile
- schemaLanguage: shacl
  schemaFormat: turtle
  schema: |
    prefix : <http://example.org/>
    prefix sh: <http://www.w3.org/ns/shacl#>
    :PersonShape a sh:NodeShape ; sh:targetClass :Person .
  action: schema
  comment: SHACL shapes
`,
  "https://manifests.example/examples/person.csv": `shapeID,propertyID,mandatory,valueDataType,valueConstraint,valueConstraintType
Person,:name,true,xsd:string,,
Person,:status,false,,:Active|:Retired,picklist`,
  "https://manifests.example/examples/graph.pg": `(n1 {Person} [ name: "Alice" ])`,
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

// The Wikidata example reads the data of an endpoint as it validates
// (neighborhood: sparql), which only rudof with endpoints can do.
test.describe("without rudof with endpoints", () => {
  test.use({ rudofEndpoints: false });

  test("lists the examples of the manifest, grouped by schema", async ({ page }) => {
    await open(page, `?manifestURL=${encodeURIComponent(MANIFEST_URL)}`);
    await expect(page.locator("#manifest")).toBeVisible();
    await expect(page.locator("#manifest-link")).toHaveAttribute("href", MANIFEST_URL);
    await expect(select(page)).toBeEnabled();
    await expect(select(page).locator("optgroup")).toHaveCount(2);
    await expect(select(page).locator('optgroup[label="person"] option')).toHaveText(["✓ Alice has a name.", "✗ Bob"]);
    await expect(select(page).locator('optgroup[label="Wikidata"] option')).toBeDisabled();
  });

  test("says why the examples that can't be run can't be run", async ({ page }) => {
    await open(page, `?manifestURL=${encodeURIComponent(MANIFEST_URL)}`);
    const problems = page.locator("#manifest-problems");
    await expect(problems.locator("summary").first()).toHaveText("Why 1 example can't be run");
    await expect(problems.locator("ul")).toBeHidden();
    await problems.locator("summary").first().click();
    const item = problems.locator("li");
    await expect(item).toHaveCount(1);
    await expect(item.locator(".problem-title")).toHaveText("from the query service (entry 3, Wikidata)");
    await expect(item.locator(".problem-reason")).toHaveText(
      "This example validates the data of https://query.wikidata.org/sparql, which needs a browser with JSPI (JavaScript Promise Integration).",
    );
    await expect(item.locator(".problem-hint")).toContainText("give the data with data: or dataURL:");
    await expect(item.locator(".problem-hint a")).toHaveAttribute("href", "help.html#example-endpoint");
    await item.locator(".problem-source summary").click();
    await expect(item.locator("pre")).toContainText("neighborhood: sparql");
  });
});

test("with rudof with endpoints, an example can validate the data of an endpoint", async ({ page }) => {
  test.skip(!hasEndpointsBuild, "no rudof with endpoints: set RUDOF_ENDPOINTS_DIR");
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST_URL)}`);
  await expect(select(page).locator('optgroup[label="Wikidata"] option')).toBeEnabled();
  await expect(page.locator("#manifest-problems")).toBeHidden();
  await select(page).selectOption({ label: "from the query service" });
  await expect(page.locator("#shex-endpoint")).toHaveValue("https://query.wikidata.org/sparql");
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

test("the chosen example waits for Validate", async ({ page }) => {
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST_URL)}`);
  await select(page).selectOption({ label: "✓ Alice has a name." });
  await expect(page.locator("#manifest-note")).toContainText("Alice has a name.");
  await expect(page.locator("#shex-result")).toBeHidden();
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result .verdict")).toHaveText(/^Conforms.*\(as the manifest expects\)$/);
});

test.describe("the action of an example", () => {
  const ACTIONS_URL = "https://manifests.example/doc/actions.yaml";

  test("data loads the data in the Data tab", async ({ page }) => {
    await open(page, `?manifestURL=${encodeURIComponent(ACTIONS_URL)}`);
    await select(page).selectOption({ label: "a property graph" });
    await expect(page.locator("#panel-pg")).toBeVisible();
    await expect(page.locator("#pg-data")).toHaveJSProperty("value", FILES["https://manifests.example/examples/graph.pg"]);
    await expect(page.locator("#pg-result .verdict")).toHaveText("Press Convert");
  });

  test("query loads the query in the Query tab, and waits for Run query", async ({ page }) => {
    await open(page, `?manifestURL=${encodeURIComponent(ACTIONS_URL)}&example=2`);
    await expect(page.locator("#panel-sparql")).toBeVisible();
    await expect(page.locator("#sparql-query")).toHaveJSProperty("value", "SELECT ?name WHERE { ?p <http://example.org/name> ?name }");
    await expect.poll(() => page.locator("#sparql-data").inputValue()).toMatch(/:alice :name "Alice"/);
    await expect(page.locator("#sparql-result")).toBeHidden();
    await page.locator("#sparql-validate").click();
    await expect(page.locator("#sparql-result .verdict")).toHaveText("1 result");
  });

  test("the list shows the comment of an example, or else its data label", async ({ page }) => {
    await open(page, `?manifestURL=${encodeURIComponent(MANIFEST_URL)}`);
    const alice = select(page).locator("option", { hasText: "Alice has a name." });
    await expect(alice).toHaveAttribute("title", "Alice");
  });

  test("validate validates with the validation engine of the example", async ({ page }) => {
    await open(page, `?manifestURL=${encodeURIComponent(ACTIONS_URL)}`);
    await select(page).selectOption({ label: "✗ Alice without a name" });
    await expect(page.locator("#panel-shacl")).toBeVisible();
    await expect(page.locator("#shacl-shapes-format")).toHaveValue("turtle");
    await expect(page.locator("#shacl-result")).toBeHidden();
    await page.locator("#shacl-validate").click();
    await expect(page.locator("#shacl-result .verdict")).toHaveText(/^Does not conform.*\(as the manifest expects\)$/);
  });
});

test("?example= loads an example when the page opens", async ({ page }) => {
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST_URL)}&example=1#data/rdf`);
  await expect(page.locator("#panel-shex")).toBeVisible();
  await expect.poll(() => page.locator("#shex-data").inputValue()).toMatch(/:alice :name "Alice"/);
  await expect(page.locator("#manifest-note")).toContainText("Alice has a name.");
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result .verdict")).toHaveText(/^Conforms.*\(as the manifest expects\)$/);
});

test("choosing an example writes its inputs in the URL", async ({ page }) => {
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST_URL)}`);
  await select(page).selectOption({ label: "✗ Bob" });
  await expect(page.locator("#manifest-note")).toContainText("Expected:");
  const params = new URL(page.url()).searchParams;
  expect(params.get("data")).toBe(FILES["https://manifests.example/examples/bob.ttl"]);
  expect(params.get("manifestURL")).toBe(MANIFEST_URL);
  expect(params.get("example")).toBe("2");
});

test("in a permalink with an example, its inputs are the ones of the link", async ({ page }) => {
  const data = "prefix : <http://example.org/>\n:alice :name \"Alice, edited\" .";
  await open(page, `?data=${encodeURIComponent(data)}&manifestURL=${encodeURIComponent(MANIFEST_URL)}&example=1#validate/shex`);
  await expect(select(page)).toHaveValue("0");
  await expect(page.locator("#shex-data")).toHaveJSProperty("value", data);
});

test("a link opens the page again with only the manifest", async ({ page }) => {
  await open(page, `?manifestURL=${encodeURIComponent(MANIFEST_URL)}`);
  const home = page.locator("#manifest-home");
  await expect(home).toBeVisible();
  await select(page).selectOption({ label: "✗ Bob" });
  await expect(page.locator("#manifest-note")).toContainText("Expected:");
  expect(new URL(page.url()).searchParams.has("data")).toBe(true);

  await home.click();
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 30_000 });
  const url = new URL(page.url());
  expect([...url.searchParams.keys()]).toEqual(["manifestURL"]);
  expect(url.searchParams.get("manifestURL")).toBe(MANIFEST_URL);
  await expect(select(page)).toHaveValue("");
  await expect(select(page)).toBeEnabled();
});

test("the link keeps the manifest URL as it was given", async ({ page }) => {
  await page.route("**/doc/relative.yaml", (route) => route.fulfill({ body: FILES["https://manifests.example/doc/manifest.yaml"] }));
  await open(page, "?manifestURL=doc/relative.yaml");
  await expect(page.locator("#manifest-home")).toHaveAttribute("href", "/?manifestURL=doc%2Frelative.yaml");
});

test("there are no reasons when all the examples can be run", async ({ page }) => {
  await open(page, `?manifestURL=${encodeURIComponent("https://manifests.example/doc/actions.yaml")}`);
  await expect(select(page)).toBeEnabled();
  await expect(page.locator("#manifest-problems")).toBeHidden();
});

test("a DCTAP example opens the DCTAP tab, with its prefixes", async ({ page }) => {
  await open(page, `?manifestURL=${encodeURIComponent("https://manifests.example/doc/dctap.yaml")}&example=1`);
  await expect(page.locator("#panel-dctap")).toBeVisible();
  await expect(page.locator("#dctap-schema")).toHaveJSProperty("value", FILES["https://manifests.example/examples/person.csv"]);
  await expect(page.locator("#dctap-prefixes")).toHaveJSProperty("value", "BASE <http://example.org/>\nPREFIX : <http://example.org/>\nPREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\n");
  await expect(page.locator("#dctap-picklist")).toHaveValue("|");
  await page.locator("#dctap-validate").click();
  await expect(page.locator("#dctap-result .verdict")).toHaveText(/^Does not conform.*\(as the manifest expects\)$/);
});

test("a schema example opens the Schema tab, in the language of the schema", async ({ page }) => {
  await open(page, `?manifestURL=${encodeURIComponent("https://manifests.example/doc/schemas.yaml")}&example=1`);
  await expect(page.locator("#panel-convert")).toBeVisible();
  await expect(page).toHaveURL(/#schema\/convert$/);
  await expect(page.locator("#convert-language")).toHaveValue("shex");
  await expect(page.locator("#convert-format")).toHaveValue("shexc");
  await expect(page.locator("#convert-schema")).toHaveJSProperty("value", FILES["https://manifests.example/examples/person.shex"]);
  // It waits for Convert
  await expect(page.locator("#convert-result .verdict")).toHaveText("Press Convert");
  await page.locator("#convert-validate").click();
  await expect(page.locator("#convert-result")).toHaveAttribute("data-kind", "ok");
  await expect(page.locator("#convert-output")).toContainText("ShapeDecl");

  await select(page).selectOption({ label: "A DCTAP profile" });
  await expect(page.locator("#convert-language")).toHaveValue("dctap");
  await expect(page.locator("#convert-schema")).toHaveJSProperty("value", FILES["https://manifests.example/examples/person.csv"]);
  await expect(page.locator("#convert-prefixes")).toHaveJSProperty("value", "PREFIX : <http://example.org/>");
  await expect(page.locator("#convert-picklist")).toHaveValue("|");
  await expect(page.locator("#convert-dctap-options")).toBeVisible();
  // The result of the example before is gone
  await expect(page.locator("#convert-result .verdict")).toHaveText("Press Convert");
  await expect(page.locator("#convert-result")).not.toHaveAttribute("data-kind");
  await expect(page.locator("#convert-copy")).toBeDisabled();
  await page.locator("#convert-validate").click();
  await expect(page.locator("#convert-output")).toContainText(":Active");

  await select(page).selectOption({ label: "SHACL shapes" });
  await expect(page.locator("#convert-language")).toHaveValue("shacl");
  await expect(page.locator("#convert-format")).toHaveValue("turtle");
  await expect.poll(() => page.locator("#convert-schema").inputValue()).toContain(":PersonShape");
  await expect(page.locator("#convert-to")).toHaveValue("shex");
});

test("says when the manifest can't be read", async ({ page }) => {
  await open(page, "?manifestURL=https://manifests.example/missing.yaml");
  await expect(page.locator("#manifest-note")).toHaveText(/Could not load the manifest: .*404/);
  await expect(select(page)).toBeDisabled();
});
