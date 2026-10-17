// SPARQL queries on an endpoint: rudof with endpoints sends them, or else the
// page itself (endpoint.js). The tests run with both. The endpoint here is a
// fake one, answered by the test.

import { test, expect, open, setInput, hasEndpointsBuild } from "./fixtures.js";

const ENDPOINT = "https://endpoint.example/sparql";
const XSD = "http://www.w3.org/2001/XMLSchema#";

const SELECT = {
  head: { vars: ["person", "name", "age"] },
  results: {
    bindings: [
      {
        person: { type: "uri", value: "http://example.org/alice" },
        name: { type: "literal", value: "Alice", "xml:lang": "en" },
        age: { type: "literal", value: "23", datatype: `${XSD}integer` },
      },
      { person: { type: "uri", value: "http://example.org/bob" }, name: { type: "literal", value: "Bob" } },
    ],
  },
};

const CONSTRUCT = `@prefix ex: <http://example.org/> .
ex:alice ex:knows ex:bob, ex:carol .`;

// The queries the endpoint got, and its answers: by the kind of query.
async function fakeEndpoint(page, { status = 200 } = {}) {
  const queries = [];
  await page.route(`${ENDPOINT}**`, async (route) => {
    const request = route.request();
    const query = new URL(request.url()).searchParams.get("query") ?? new URLSearchParams(request.postData() ?? "").get("query");
    queries.push({ query, method: request.method(), accept: request.headers().accept });
    const headers = { "access-control-allow-origin": "*" };
    if (status !== 200) return route.fulfill({ status, body: "Parse error at line 1", headers: { ...headers, "content-type": "text/plain" } });
    if (/^\s*(PREFIX[^\n]*\n\s*)*CONSTRUCT/i.test(query)) {
      return route.fulfill({ body: CONSTRUCT, headers: { ...headers, "content-type": "text/turtle" } });
    }
    if (/ASK/i.test(query)) return route.fulfill({ json: { head: {}, boolean: true }, headers });
    return route.fulfill({ json: SELECT, headers: { ...headers, "content-type": "application/sparql-results+json" } });
  });
  return queries;
}

const verdict = (page) => page.locator("#sparql-result .verdict");

for (const endpoints of [true, false]) {
  test.describe(endpoints ? "through rudof" : "sent by the page", () => {
    test.use({ rudofEndpoints: endpoints });
    test.skip(endpoints && !hasEndpointsBuild, "no rudof with endpoints: set RUDOF_ENDPOINTS_DIR");

    test("the status says which rudof the page loaded", async ({ page }) => {
      await open(page);
      await expect(page.locator("#status")).toHaveText(endpoints ? /ready, with endpoints$/ : /ready$/);
    });


    test("runs a SELECT query on an endpoint, and shows its solutions", async ({ page }) => {
      const queries = await fakeEndpoint(page);
      await open(page, "#query/sparql");
      await page.locator("#sparql-endpoint").fill(ENDPOINT);
      await setInput(page, "sparql-query", "PREFIX ex: <http://example.org/>\nSELECT ?person ?name ?age WHERE { ?person ex:name ?name }");
      await page.locator("#sparql-validate").click();
      await expect(verdict(page)).toHaveText("2 results from endpoint.example");
      expect(queries[0]).toMatchObject({ method: "GET", query: expect.stringContaining("SELECT ?person") });
      expect(queries[0].accept).toMatch(/application\/sparql-results\+json/);

      const table = page.locator("#sparql-result table.solutions");
      await expect(table.locator("th")).toHaveText(["?person", "?name", "?age"]);
      // Prefixed with the prefixes of the query
      await expect(table.locator("tbody tr").first().locator("td")).toHaveText(["ex:alice", "Alice @en", "23"]);

      await page.locator("#sparql-result-format").selectOption("csv");
      // rudof writes the results as it writes the results of local queries
      await expect(page.locator("#sparql-result .output")).toContainText(endpoints ? "?person,?name,?age" : "person,name,age");
      await page.locator("#sparql-result-format").selectOption("json");
      await expect(page.locator("#sparql-result .output")).toContainText(endpoints ? '@en' : '"xml:lang": "en"');
    });

    test("runs a CONSTRUCT query on an endpoint, and shows its graph", async ({ page }) => {
      await fakeEndpoint(page);
      await open(page, "#query/sparql");
      await page.locator("#sparql-endpoint").fill(ENDPOINT);
      await setInput(page, "sparql-query", "PREFIX ex: <http://example.org/>\nCONSTRUCT { ?a ex:knows ?b } WHERE { ?a ex:knows ?b }");
      await page.locator("#sparql-validate").click();
      await expect(verdict(page)).toHaveText("2 triples from endpoint.example");
      await expect(page.locator("#sparql-result .output")).toContainText("ex:carol");
    });

    test("runs an ASK query on an endpoint, with Enter in the endpoint field", async ({ page }) => {
      await fakeEndpoint(page);
      await open(page, "#query/sparql");
      await setInput(page, "sparql-query", "ASK { ?s ?p ?o }");
      await page.locator("#sparql-endpoint").fill(ENDPOINT);
      await page.locator("#sparql-endpoint").press("Enter");
      await expect(verdict(page)).toHaveText("ASK: true from endpoint.example");
    });

    test("says what the endpoint answered when the query fails", async ({ page }) => {
      await fakeEndpoint(page, { status: 400 });
      await open(page, "#query/sparql");
      await page.locator("#sparql-endpoint").fill(ENDPOINT);
      await page.locator("#sparql-validate").click();
      await expect(page.locator("#sparql-result")).toHaveAttribute("data-kind", "error");
      await expect(page.locator("#sparql-result .output")).toContainText("endpoint.example answered 400");
      await expect(page.locator("#sparql-result .output")).toContainText("Parse error at line 1");
    });

    test("says when the endpoint can't be reached", async ({ page }) => {
      await open(page, "#query/sparql");
      await page.locator("#sparql-endpoint").fill("https://unreachable.example/sparql");
      await page.locator("#sparql-validate").click();
      // rudof tries again a few times before it gives up
      await expect(page.locator("#sparql-result .output")).toContainText("Could not reach unreachable.example", { timeout: 30_000 });
    });

    test("the data is marked as not used while there is an endpoint", async ({ page }) => {
      await open(page, "#query/sparql");
      const field = page.locator(".field:has(#sparql-data)");
      await expect(page.locator("#sparql-data-unused")).toBeHidden();
      await page.locator("#sparql-endpoint").fill(ENDPOINT);
      await expect(field).toHaveClass(/unused/);
      await expect(page.locator("#sparql-data-unused")).toBeVisible();
      await page.locator("#sparql-endpoint").fill("");
      await expect(field).not.toHaveClass(/unused/);
    });

    test("without an endpoint, the query runs on the data, as before", async ({ page }) => {
      await open(page, "#query/sparql");
      await page.locator("#sparql-validate").click();
      await expect(verdict(page)).toHaveText("3 results");
    });

    test("the endpoint is in the permalink", async ({ page }) => {
      await fakeEndpoint(page);
      await open(page, `?endpoint=${encodeURIComponent(ENDPOINT)}&query=${encodeURIComponent("ASK {}")}`);
      await expect(page.locator("#panel-sparql")).toBeVisible();
      await expect(page.locator("#sparql-endpoint")).toHaveValue(ENDPOINT);
      await expect(page.locator(".field:has(#sparql-data)")).toHaveClass(/unused/);
      await page.locator("#sparql-validate").click();
      await expect(verdict(page)).toHaveText("ASK: true from endpoint.example");
      expect(new URL(page.url()).searchParams.get("endpoint")).toBe(ENDPOINT);
    });

    test("a query example of a manifest can run on an endpoint", async ({ page }) => {
      await fakeEndpoint(page);
      await page.route("https://manifests.example/manifest.yaml", (route) =>
        route.fulfill({
          headers: { "access-control-allow-origin": "*" },
          body: `
    - comment: People in the endpoint
      query: "SELECT ?person ?name ?age WHERE { ?person <http://example.org/name> ?name }"
      endpoint: ${ENDPOINT}
      action: query
    `,
        }),
      );
      await open(page, `?manifestURL=${encodeURIComponent("https://manifests.example/manifest.yaml")}&example=1`);
      await expect(page.locator("#sparql-endpoint")).toHaveValue(ENDPOINT);
      await expect(page.locator("#sparql-result")).toBeHidden();
      await page.locator("#sparql-validate").click();
      await expect(verdict(page)).toHaveText("2 results from endpoint.example");
    });
  });
}
