// What a run on an endpoint asks it (endpoint-log.js): while the run waits,
// the result shows the queries (the progress, the limits of the requests and
// a table of the queries, with Stop); then the switch "Result | Queries" of
// the result. The limits are settings (the Options of the endpoints).

import { test, expect, open, setInput, hasEndpointsBuild } from "./fixtures.js";
import { sparqlEndpoint } from "./sparql-endpoint.js";

const ENDPOINT = "https://endpoint.example/sparql";
const WIKIDATA = "https://query.wikidata.org/sparql";

const DATA = `prefix : <http://example.org/>
:alice a :Person ; :name "Alice" .
:bob a :Person ; :name "Bob" .
:carol a :Person ; :name "Carol" .`;

const SHEX = `prefix : <http://example.org/>
prefix xsd: <http://www.w3.org/2001/XMLSchema#>
:Person { :name xsd:string }`;

const box = (page, prefix) => page.locator(`#${prefix}-result`);
const view = (page, prefix) => page.locator(`#${prefix}-result .queries-view`);
const rows = (page, prefix) => view(page, prefix).locator("tr.query-row");
const result = (page, prefix) => page.locator(`#${prefix}-result:not([data-kind="running"])`);
const switchTo = (page, prefix, name) => page.locator(`#${prefix}-result .queries-switch [data-view="${name}"]`);

async function shexOnEndpoint(page, endpoint = ENDPOINT, shapeMap = ":alice@:Person") {
  await open(page, "#validate/shex");
  await page.locator("#shex-endpoint").fill(endpoint);
  await setInput(page, "shex-schema", SHEX);
  await setInput(page, "shex-shapemap", shapeMap);
  await page.locator("#shex-validate").click();
}

// Changes the settings of the endpoints, with the Options of the ShEx tab
async function endpointSettings(page, values) {
  await page.locator("#shex-endpoint").fill(ENDPOINT);
  await page.locator("#shex-endpoint-options").click();
  await expect(page.locator("#settings")).toBeVisible();
  await expect(page.locator("#setting-rdf-min_request_interval_ms")).toBeFocused();
  for (const [id, value] of Object.entries(values)) {
    const input = page.locator(`#setting-${id}`);
    if ((await input.evaluate((e) => e.tagName)) === "SELECT") await input.selectOption(value);
    else await input.fill(value);
  }
  await page.locator('#settings button[value="save"]').click();
  await expect(page.locator("#settings")).toBeHidden();
}

const sentAt = async (page, prefix) => (await rows(page, prefix).locator("td:nth-child(2)").allTextContents()).map((t) => parseFloat(t)).reverse();

test.describe("with rudof with endpoints", () => {
  test.skip(!hasEndpointsBuild, "no rudof with endpoints in node_modules or RUDOF_ENDPOINTS_DIR");

  test("after the result, Queries shows the queries sent to the endpoint", async ({ page }) => {
    const queries = await sparqlEndpoint(page, ENDPOINT, DATA);
    await shexOnEndpoint(page, ENDPOINT, ":alice@:Person, :bob@:Person");
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 2 nodes validated on endpoint.example", { timeout: 30_000 });
    // The result, with the switch to the queries
    await expect(box(page, "shex").locator("table.report")).toBeVisible();
    await expect(view(page, "shex")).toBeHidden();
    const n = queries.length;
    await expect(switchTo(page, "shex", "queries")).toHaveText(`Queries (${n})`);
    await expect(switchTo(page, "shex", "result")).toHaveAttribute("aria-pressed", "true");
    await switchTo(page, "shex", "queries").click();
    await expect(view(page, "shex")).toBeVisible();
    await expect(box(page, "shex").locator("table.report")).toBeHidden();
    await expect(view(page, "shex").locator(".queries-summary")).toHaveText(`${n} ${n === 1 ? "query" : "queries"} · ${n} answered · 0 failed`);
    await expect(view(page, "shex").locator(".queries-stop")).toBeHidden();
    // rudof's limits: the two nodes of the shape map in one query
    await expect(view(page, "shex").locator(".queries-limits")).toContainText("Limits: 1 query every 1.1 s at most · 1 at a time · 20 nodes per query");
    await expect(rows(page, "shex")).toHaveCount(n);
    const first = rows(page, "shex").last();
    await expect(first.locator("td").nth(2)).toHaveText(/^200( OK)?$/);
    await expect(first.locator("td").nth(5)).toHaveText("2");
    // A click shows the query and the answer
    await first.click();
    await expect(view(page, "shex").locator("tr.query-detail .query-full")).toHaveText(queries[0]);
    await expect(view(page, "shex").locator("tr.query-detail .query-answer")).toContainText('"bindings"');
    // Back to the result
    await switchTo(page, "shex", "result").click();
    await expect(box(page, "shex").locator("table.report")).toBeVisible();
    // A run without an endpoint has no queries
    await page.locator("#shex-endpoint").fill("");
    await setInput(page, "shex-data", DATA);
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 2 nodes validated");
    await expect(box(page, "shex").locator(".queries-switch")).toBeHidden();
  });

  test("while the endpoint doesn't answer, the result shows the queries, and Stop stops the run", async ({ page }) => {
    // An endpoint that never answers
    await page.route(`${ENDPOINT}**`, () => {});
    await shexOnEndpoint(page);
    await expect(box(page, "shex").locator(".verdict")).toHaveText("Waiting for endpoint.example…");
    await expect(view(page, "shex")).toBeVisible();
    await expect(box(page, "shex").locator(".queries-switch")).toBeHidden();
    await expect(view(page, "shex").locator(".queries-summary")).toHaveText("1 query · 0 answered · 1 waiting · 0 failed", { timeout: 15_000 });
    await expect(rows(page, "shex").locator(".query-state")).toHaveText("waiting…");
    // The time goes on, in the head of the result
    const time = box(page, "shex").locator(".timing");
    const before = parseFloat(await time.textContent());
    await expect.poll(async () => parseFloat(await time.textContent()), { timeout: 5_000 }).toBeGreaterThan(before);
    await view(page, "shex").locator(".queries-stop").click();
    await expect(box(page, "shex")).toHaveAttribute("data-kind", "error");
    await expect(box(page, "shex").locator(".verdict")).toHaveText("Stopped");
    // The queries stay, and the result says why it stopped
    await expect(view(page, "shex")).toBeVisible();
    await expect(rows(page, "shex").locator(".query-state")).toHaveText("Stopped");
    await expect(view(page, "shex").locator(".queries-stop")).toBeHidden();
    await switchTo(page, "shex", "result").click();
    await expect(page.locator("#shex-output")).toContainText("with 1 query waiting for an answer");
    // The run can start again, when rudof gives up the stopped one
    await page.locator("#shex-validate").click();
    await expect(box(page, "shex").locator(".verdict")).toHaveText("Waiting for endpoint.example…", { timeout: 20_000 });
    await expect(view(page, "shex")).toBeVisible();
  });

  test("after Stop, rudof sends no more requests, and a new run waits until it gives up", async ({ page }) => {
    test.setTimeout(90_000);
    // A tree of classes, as the subclasses of Wikidata: rudof would ask
    // about each one
    const lines = ["wd:Q42 wdt:P31 wd:C1 ."];
    let n = 1;
    for (const queue = [[1, 0]]; queue.length; ) {
      const [c, depth] = queue.shift();
      if (depth >= 6) continue;
      for (let k = 0; k < 3; k++) {
        n += 1;
        lines.push(`wd:C${c} wdt:P279 wd:C${n} .`);
        queue.push([n, depth + 1]);
      }
    }
    const queries = await sparqlEndpoint(page, ENDPOINT, `prefix wd: <http://www.wikidata.org/entity/>\nprefix wdt: <http://www.wikidata.org/prop/direct/>\n${lines.join("\n")}`);
    await open(page, "#validate/shex");
    await page.evaluate(() => localStorage.setItem("rudof-demo-settings", JSON.stringify({ values: { "rdf.min_request_interval_ms": 0 }, toml: "" })));
    await page.reload();
    await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 30_000 });
    await page.locator("#shex-endpoint").fill(ENDPOINT);
    await setInput(page, "shex-schema", `prefix : <http://example.org/>
prefix wd: <http://www.wikidata.org/entity/>
prefix wdt: <http://www.wikidata.org/prop/direct/>
:Person2 EXTRA wdt:P31 { wdt:P31 @:HumanOrSubclass }
:HumanOrSubclass [ wd:Q5 ] OR EXTRA wdt:P279 { wdt:P279 @:HumanOrSubclass + }`);
    await setInput(page, "shex-shapemap", "wd:Q42@:Person2");
    await page.locator("#shex-validate").click();
    await expect.poll(() => queries.length, { timeout: 30_000 }).toBeGreaterThan(20);
    await view(page, "shex").locator(".queries-stop").click();
    await expect(box(page, "shex").locator(".verdict")).toHaveText("Stopped");
    // The requests sent before the click may still arrive; then none
    await page.waitForTimeout(500);
    const atStop = queries.length;
    await expect(view(page, "shex").locator(".queries-summary")).toContainText(/stopping: rudof gives up/);
    await page.waitForTimeout(3_000);
    expect(queries.length).toBe(atStop);
    expect(atStop).toBeLessThan(n);
    // A new run waits until rudof gives up the stopped one
    await page.locator("#shex-validate").click();
    await expect(box(page, "shex").locator(".verdict")).toHaveText(/Stopping the previous run…|Waiting for endpoint\.example…/);
    await expect(box(page, "shex").locator(".verdict")).toHaveText("Waiting for endpoint.example…", { timeout: 20_000 });
    await view(page, "shex").locator(".queries-stop").click();
  });

  test("the settings of the endpoints change how rudof sends the queries", async ({ page }) => {
    await sparqlEndpoint(page, ENDPOINT, DATA);
    await open(page, "#validate/shex");
    await endpointSettings(page, { "rdf-min_request_interval_ms": "0", "rdf-max_nodes_per_query": "1" });
    await shexOnEndpoint(page, ENDPOINT, ":alice@:Person, :bob@:Person, :carol@:Person");
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 3 nodes validated on endpoint.example", { timeout: 30_000 });
    await switchTo(page, "shex", "queries").click();
    await expect(view(page, "shex").locator(".queries-limits")).toContainText("Limits: no wait between queries · 1 at a time · 1 node per query");
    // A query for each node, without waiting
    await expect(rows(page, "shex")).toHaveCount(3);
    expect((await sentAt(page, "shex")).at(-1)).toBeLessThan(1);
  });

  test("Wikidata keeps its own limit, also when the settings have a lower one", async ({ page }) => {
    await sparqlEndpoint(page, WIKIDATA, DATA);
    await open(page, "#validate/shex");
    await endpointSettings(page, { "rdf-min_request_interval_ms": "0", "rdf-max_nodes_per_query": "1" });
    await shexOnEndpoint(page, WIKIDATA, ":alice@:Person, :bob@:Person");
    await expect(result(page, "shex").locator(".verdict")).toHaveText(/^Conforms: 2 nodes validated/, { timeout: 30_000 });
    await switchTo(page, "shex", "queries").click();
    await expect(view(page, "shex").locator(".queries-limits")).toContainText(/Limits: 1 query every 1\.1 s at most · 1 at a time · 1 node per query \(those of .+\)/);
    const [a, b] = await sentAt(page, "shex");
    expect(b - a).toBeGreaterThanOrEqual(1);
  });

  test("SHACL gets the data of the endpoint node by node, or shape by shape (rudof 0.3.30)", async ({ page }) => {
    const people = Array.from({ length: 6 }, (_, i) => `:p${i} a :Person ; :name "P${i}" .`).join("\n");
    const shapes = `prefix : <http://example.org/>
prefix sh: <http://www.w3.org/ns/shacl#>
:PersonShape a sh:NodeShape ; sh:targetClass :Person ; sh:property [ sh:path :name ; sh:minCount 1 ] .`;
    // The number of queries of a validation, and the nodes of each one
    async function validate(values) {
      await page.unroute(`${ENDPOINT}**`);
      const queries = await sparqlEndpoint(page, ENDPOINT, `prefix : <http://example.org/>\n${people}`);
      // The settings, which the page reads when it opens
      await open(page, "#validate/shacl");
      await page.evaluate((v) => localStorage.setItem("rudof-demo-settings", JSON.stringify({ values: v, toml: "" })), { "rdf.min_request_interval_ms": 0, ...values });
      await page.reload();
      await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 30_000 });
      await page.locator("#shacl-endpoint").fill(ENDPOINT);
      await setInput(page, "shacl-shapes", shapes);
      await page.locator("#shacl-validate").click();
      await expect(result(page, "shacl").locator(".verdict")).toHaveText("Conforms on endpoint.example", { timeout: 30_000 });
      await switchTo(page, "shacl", "queries").click();
      const nodes = await rows(page, "shacl").locator("td:nth-child(6)").allTextContents();
      return { queries, nodes, limits: await view(page, "shacl").locator(".queries-limits").textContent() };
    }
    const onDemand = await validate({});
    expect(onDemand.limits).toContain("SHACL: node by node");
    const byShape = await validate({ "shacl.fetch_strategy": "by-shape" });
    expect(byShape.limits).toContain("SHACL: shape by shape, 50 nodes per query, 16 shape references deep");
    expect(byShape.queries.length).toBeLessThan(onDemand.queries.length);
    expect(byShape.nodes).toContain("6");
    // Fewer nodes in one query: more queries
    const small = await validate({ "shacl.fetch_strategy": "by-shape", "shacl.prefetch_batch_size": 2 });
    expect(small.limits).toContain("SHACL: shape by shape, 2 nodes per query");
    expect(small.nodes.filter((n) => n).map(Number).every((n) => n <= 2)).toBe(true);
    expect(small.queries.length).toBeGreaterThan(byShape.queries.length);
  });

  test("validations can get the RDF of the IRIs of the nodes (dereference)", async ({ page }) => {
    await page.route("http://example.org/alice", (route) =>
      route.fulfill({ body: '<http://example.org/alice> <http://example.org/name> "Alice" .', headers: { "content-type": "text/turtle", "access-control-allow-origin": "*" } }),
    );
    await open(page, "#validate/shex");
    await endpointSettings(page, { endpoint_strategy: "dereference" });
    await shexOnEndpoint(page);
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 1 node validated on endpoint.example", { timeout: 30_000 });
    await switchTo(page, "shex", "queries").click();
    await expect(view(page, "shex").locator(".queries-limits")).toContainText("the RDF of the IRIs of the nodes (dereference)");
    await expect(rows(page, "shex").locator(".query-text")).toHaveText("http://example.org/alice");
  });

  test("the queries of the SPARQL tab are shown too", async ({ page }) => {
    await sparqlEndpoint(page, ENDPOINT, DATA);
    await open(page, "#query/sparql");
    await page.locator("#sparql-endpoint").fill(ENDPOINT);
    await setInput(page, "sparql-query", "SELECT ?s WHERE { ?s a <http://example.org/Person> }");
    await page.locator("#sparql-validate").click();
    await expect(result(page, "sparql").locator(".verdict")).toHaveText(/^3 results/, { timeout: 30_000 });
    await expect(switchTo(page, "sparql", "queries")).toHaveText("Queries (1)");
    await switchTo(page, "sparql", "queries").click();
    await expect(rows(page, "sparql").locator(".query-text")).toContainText("SELECT ?s WHERE");
  });
});

test.describe("without rudof with endpoints", () => {
  test.use({ rudofEndpoints: false });

  test("the query that the page sends to the endpoint is shown", async ({ page }) => {
    await sparqlEndpoint(page, ENDPOINT, DATA);
    await open(page, "#query/sparql");
    await page.locator("#sparql-endpoint").fill(ENDPOINT);
    await setInput(page, "sparql-query", "SELECT ?s WHERE { ?s a <http://example.org/Person> }");
    await page.locator("#sparql-validate").click();
    await expect(result(page, "sparql").locator(".verdict")).toHaveText(/^3 results/, { timeout: 30_000 });
    await switchTo(page, "sparql", "queries").click();
    await expect(view(page, "sparql").locator(".queries-limits")).toHaveText(/The page sends the query to the endpoint itself/);
    await expect(view(page, "sparql").locator(".queries-options")).toBeHidden();
    await expect(rows(page, "sparql").locator(".query-text")).toContainText("SELECT ?s WHERE");
  });

  test("the Options of the endpoints are not there: the validations can't use endpoints", async ({ page }) => {
    await open(page, "#validate/shex");
    await expect(page.locator("#shex-endpoint")).toBeDisabled();
    await expect(page.locator("#shex-endpoint-options")).toBeHidden();
  });
});
