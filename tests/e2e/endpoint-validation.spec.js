// Validations on the data of an endpoint (ShEx, SHACL, DCTAP): rudof with
// endpoints asks the endpoint for the data of each node. The endpoint here
// answers with rudof on DATA (sparql-endpoint.js). Without rudof with
// endpoints, the validations say that they need it.

import { test, expect, open, setInput, hasEndpointsBuild } from "./fixtures.js";
import { sparqlEndpoint } from "./sparql-endpoint.js";

const ENDPOINT = "https://endpoint.example/sparql";

const DATA = `prefix : <http://example.org/>
:alice a :Person ; :name "Alice" ; :age 23 .
:bob a :Person ; :age "old" .`;

const SHEX = `prefix : <http://example.org/>
prefix xsd: <http://www.w3.org/2001/XMLSchema#>
:Person { :name xsd:string ; :age xsd:integer }`;

const SHACL = `prefix : <http://example.org/>
prefix sh: <http://www.w3.org/ns/shacl#>
:PersonShape a sh:NodeShape ; sh:targetClass :Person ;
  sh:property [ sh:path :name ; sh:minCount 1 ] .`;

const DCTAP = `shapeID,propertyID,valueDataType
Person,:name,xsd:string
Person,:age,xsd:integer`;

// Waits for the result of a tab: rudof waits for the endpoint
const result = (page, prefix) => page.locator(`#${prefix}-result:not([data-kind="running"])`);

test.describe("with rudof with endpoints", () => {
  test.skip(!hasEndpointsBuild, "no rudof with endpoints: set RUDOF_ENDPOINTS_DIR");

  test("ShEx validates the nodes of the shape map on the endpoint", async ({ page }) => {
    const queries = await sparqlEndpoint(page, ENDPOINT, DATA);
    await open(page, "#validate/shex");
    await page.locator("#shex-endpoint").fill(ENDPOINT);
    await setInput(page, "shex-schema", SHEX);
    // The prefixes of the schema are the prefixes of the shape map
    await setInput(page, "shex-shapemap", ":alice@:Person, :bob@:Person");
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex").locator(".verdict")).toHaveText(/^Does not conform: 1 of 2 nodes failed on endpoint\.example$/, { timeout: 30_000 });
    // rudof asked the endpoint for the data of each node
    expect(queries.join("\n")).toContain("<http://example.org/alice>");
    expect(queries.join("\n")).toContain("<http://example.org/bob>");
    // The result formats work as with local data
    await page.locator("#shex-result-format").selectOption("json");
    await expect(page.locator("#shex-result .output")).toContainText("http://example.org/bob");
  });

  test("SHACL validates the targets of the shapes on the endpoint", async ({ page }) => {
    await sparqlEndpoint(page, ENDPOINT, DATA);
    await open(page, "#validate/shacl");
    await page.locator("#shacl-endpoint").fill(ENDPOINT);
    await setInput(page, "shacl-shapes", SHACL);
    await page.locator("#shacl-validate").click();
    await expect(result(page, "shacl").locator(".verdict")).toHaveText("Does not conform: 1 violation on endpoint.example", { timeout: 30_000 });
  });

  test("DCTAP validates with the ShEx of the profile on the endpoint", async ({ page }) => {
    await sparqlEndpoint(page, ENDPOINT, DATA);
    await open(page, "#validate/dctap");
    await page.locator("#dctap-endpoint").fill(ENDPOINT);
    await setInput(page, "dctap-schema", DCTAP);
    await setInput(page, "dctap-prefixes", "PREFIX : <http://example.org/>");
    await setInput(page, "dctap-shapemap", ":alice@:Person");
    await page.locator("#dctap-validate").click();
    await expect(result(page, "dctap").locator(".verdict")).toHaveText("Conforms: 1 node validated on endpoint.example", { timeout: 30_000 });
  });

  test("the data is not used, and the endpoint is in the permalink", async ({ page }) => {
    await sparqlEndpoint(page, ENDPOINT, DATA);
    await open(page, "#validate/shex");
    await expect(page.locator("#shex-endpoint")).toBeEnabled();
    await page.locator("#shex-endpoint").fill(ENDPOINT);
    await expect(page.locator(".field:has(#shex-data)")).toHaveClass(/unused/);
    await expect(page.locator("#shex-data-unused")).toBeVisible();
    await setInput(page, "shex-schema", SHEX);
    await setInput(page, "shex-shapemap", ":alice@:Person");
    // Enter in the field validates
    await page.locator("#shex-endpoint").press("Enter");
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 1 node validated on endpoint.example", { timeout: 30_000 });
    const params = new URL(page.url()).searchParams;
    expect(params.get("endpoint")).toBe(ENDPOINT);

    // Without the endpoint, the session validates the data of the page again
    await page.locator("#shex-endpoint").fill("");
    await setInput(page, "shex-data", DATA);
    await page.locator("#shex-validate").click();
    await expect(page.locator("#shex-result .verdict")).toHaveText("Conforms: 1 node validated");

    // The permalink validates on the endpoint again
    await open(page, `?${params}#validate/shex`);
    await expect(page.locator("#shex-endpoint")).toHaveValue(ENDPOINT);
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 1 node validated on endpoint.example", { timeout: 30_000 });
  });

  test("the known endpoints of rudof are suggested", async ({ page }) => {
    await open(page, "#validate/shex");
    await expect(page.locator("#known-endpoints option")).not.toHaveCount(3);
    await expect(page.locator('#known-endpoints option[value="https://query.wikidata.org/sparql"]')).toHaveCount(1);
  });

  test("says when the endpoint answers with an error", async ({ page }) => {
    await page.route(`${ENDPOINT}**`, (route) =>
      route.fulfill({ status: 500, body: "Server error", headers: { "access-control-allow-origin": "*", "content-type": "text/plain" } }),
    );
    await open(page, "#validate/shex");
    await page.locator("#shex-endpoint").fill(ENDPOINT);
    await setInput(page, "shex-schema", SHEX);
    await setInput(page, "shex-shapemap", ":alice@:Person");
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex")).toHaveAttribute("data-kind", "error", { timeout: 30_000 });
    await expect(page.locator("#shex-result .output")).toHaveText("endpoint.example answered 500:\nServer error");
  });

  test("a validation example of a manifest can run on an endpoint", async ({ page }) => {
    await sparqlEndpoint(page, ENDPOINT, DATA);
    await page.route("https://manifests.example/manifest.yaml", (route) =>
      route.fulfill({
        headers: { "access-control-allow-origin": "*" },
        body: `
- comment: Alice in the endpoint
  schema: |
${SHEX.replace(/^/gm, "    ")}
  endpoint: ${ENDPOINT}
  queryMap: ":alice@:Person"
  status: conformant
`,
      }),
    );
    await open(page, `?manifestURL=${encodeURIComponent("https://manifests.example/manifest.yaml")}&example=1`);
    await expect(page.locator("#shex-endpoint")).toHaveValue(ENDPOINT);
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 1 node validated on endpoint.example (as the manifest expects)", { timeout: 30_000 });
  });
});

test.describe("without rudof with endpoints", () => {
  test.use({ rudofEndpoints: false });

  test("the validations can't use endpoints, and say why", async ({ page }) => {
    await open(page, "#validate/shacl");
    await expect(page.locator("#shacl-endpoint")).toBeDisabled();
    await expect(page.locator("#panel-shacl .endpoint-hint")).toContainText("rudof");
    // A permalink with an endpoint says it too
    await open(page, `?shapes=${encodeURIComponent(SHACL)}&endpoint=${encodeURIComponent(ENDPOINT)}#validate/shacl`);
    await page.locator("#shacl-validate").click();
    await expect(page.locator("#shacl-result")).toHaveAttribute("data-kind", "error");
    await expect(page.locator("#shacl-result .output")).toContainText("endpoint");
    // SPARQL queries can: the page sends them
    await expect(page.locator("#sparql-endpoint")).toBeEnabled();
  });

  test("validation examples on endpoints can't be run", async ({ page }) => {
    await page.route("https://manifests.example/manifest.yaml", (route) =>
      route.fulfill({
        headers: { "access-control-allow-origin": "*" },
        body: `- comment: Alice in the endpoint\n  schema: "<S> {}"\n  endpoint: ${ENDPOINT}\n  queryMap: "<alice>@<S>"\n`,
      }),
    );
    await open(page, `?manifestURL=${encodeURIComponent("https://manifests.example/manifest.yaml")}`);
    await expect(page.locator("#manifest-examples option").nth(1)).toHaveText("Alice in the endpoint (not supported)");
    await expect(page.locator("#manifest-problems")).toContainText("JSPI");
  });
});
