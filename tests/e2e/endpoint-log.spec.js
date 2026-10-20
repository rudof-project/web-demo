// What a run on an endpoint asks it (endpoint-log.js): under the verdict,
// how many queries were sent and how long the run takes, Details with the
// queries and the answers, and Stop.

import { test, expect, open, setInput, hasEndpointsBuild } from "./fixtures.js";
import { sparqlEndpoint } from "./sparql-endpoint.js";

const ENDPOINT = "https://endpoint.example/sparql";

const DATA = `prefix : <http://example.org/>
:alice a :Person ; :name "Alice" .`;

const SHEX = `prefix : <http://example.org/>
prefix xsd: <http://www.w3.org/2001/XMLSchema#>
:Person { :name xsd:string }`;

const activity = (page, prefix) => page.locator(`#${prefix}-result .endpoint-activity`);
const result = (page, prefix) => page.locator(`#${prefix}-result:not([data-kind="running"])`);

async function shexOnEndpoint(page) {
  await open(page, "#validate/shex");
  await page.locator("#shex-endpoint").fill(ENDPOINT);
  await setInput(page, "shex-schema", SHEX);
  await setInput(page, "shex-shapemap", ":alice@:Person");
  await page.locator("#shex-validate").click();
}

test.describe("with rudof with endpoints", () => {
  test.skip(!hasEndpointsBuild, "no rudof with endpoints in node_modules or RUDOF_ENDPOINTS_DIR");

  test("the result says the queries sent to the endpoint, and Details shows them", async ({ page }) => {
    const queries = await sparqlEndpoint(page, ENDPOINT, DATA);
    await shexOnEndpoint(page);
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 1 node validated on endpoint.example", { timeout: 30_000 });
    const n = queries.length;
    expect(n).toBeGreaterThan(0);
    await expect(activity(page, "shex").locator(".activity-summary")).toHaveText(new RegExp(`^${n} quer(y|ies) to endpoint\\.example, \\d+\\.\\d s$`));
    await expect(activity(page, "shex").locator(".activity-stop")).toBeHidden();
    // Details: each query, the last one first, with its status and its answer
    const log = activity(page, "shex").locator(".endpoint-log");
    await expect(log).toBeHidden();
    await activity(page, "shex").locator(".activity-details").click();
    await expect(log.locator(".log-entry")).toHaveCount(n);
    // Why the queries are slow
    await expect(log.locator(".log-note")).toContainText("at most one query every 1.1 s");
    await expect(log.locator(".log-query").last()).toHaveText(queries[0]);
    await expect(log.locator(".log-entry.ok .log-state").first()).toHaveText(/^200( OK)?, \d+ ms, \d+ characters$/);
    await log.locator(".log-answer summary").first().click();
    await expect(log.locator(".log-answer pre").first()).toContainText("{");
    // Details stays open for the next run; a run without an endpoint has no log
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex").locator(".verdict")).toHaveText(/^Conforms/, { timeout: 30_000 });
    await expect(log).toBeVisible();
    await page.locator("#shex-endpoint").fill("");
    await setInput(page, "shex-data", DATA);
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 1 node validated");
    await expect(activity(page, "shex")).toBeHidden();
  });

  test("while the endpoint doesn't answer, the log says so, and Stop stops the run", async ({ page }) => {
    // An endpoint that never answers
    await page.route(`${ENDPOINT}**`, () => {});
    await shexOnEndpoint(page);
    await expect(page.locator("#shex-result .verdict")).toHaveText("Waiting for the endpoint…");
    const summary = activity(page, "shex").locator(".activity-summary");
    await expect(summary).toHaveText(/^1 query to endpoint\.example, 1 waiting for an answer, \d+\.\d s$/, { timeout: 15_000 });
    // The time goes on
    const before = Number((await summary.textContent()).match(/([\d.]+) s$/)[1]);
    await expect.poll(async () => Number((await summary.textContent()).match(/([\d.]+) s$/)[1]), { timeout: 5_000 }).toBeGreaterThan(before);
    await activity(page, "shex").locator(".activity-details").click();
    await expect(activity(page, "shex").locator(".log-entry.waiting .log-state")).toHaveText("waiting for an answer…");
    await activity(page, "shex").locator(".activity-stop").click();
    await expect(page.locator("#shex-result")).toHaveAttribute("data-kind", "error");
    await expect(page.locator("#shex-result .verdict")).toHaveText("Stopped");
    await expect(page.locator("#shex-output")).toContainText("with 1 query waiting for an answer");
    await expect(activity(page, "shex").locator(".log-entry.fail .log-state")).toHaveText("Stopped");
    await expect(activity(page, "shex").locator(".activity-stop")).toBeHidden();
    // The run can start again
    await page.locator("#shex-validate").click();
    await expect(page.locator("#shex-result .verdict")).toHaveText("Waiting for the endpoint…");
  });

  test("the queries of the SPARQL tab are in the log too", async ({ page }) => {
    await sparqlEndpoint(page, ENDPOINT, DATA);
    await open(page, "#query/sparql");
    await page.locator("#sparql-endpoint").fill(ENDPOINT);
    await setInput(page, "sparql-query", "SELECT ?s WHERE { ?s a <http://example.org/Person> }");
    await page.locator("#sparql-validate").click();
    await expect(result(page, "sparql").locator(".verdict")).toHaveText(/^1 result/, { timeout: 30_000 });
    await expect(activity(page, "sparql").locator(".activity-summary")).toHaveText(/^1 query to endpoint\.example/);
    await activity(page, "sparql").locator(".activity-details").click();
    await expect(activity(page, "sparql").locator(".log-query")).toContainText("SELECT ?s WHERE");
  });
});

test.describe("without rudof with endpoints", () => {
  test.use({ rudofEndpoints: false });

  test("the query that the page sends to the endpoint is in the log", async ({ page }) => {
    await sparqlEndpoint(page, ENDPOINT, DATA);
    await open(page, "#query/sparql");
    await page.locator("#sparql-endpoint").fill(ENDPOINT);
    await setInput(page, "sparql-query", "SELECT ?s WHERE { ?s a <http://example.org/Person> }");
    await page.locator("#sparql-validate").click();
    await expect(result(page, "sparql").locator(".verdict")).toHaveText(/^1 result/, { timeout: 30_000 });
    await activity(page, "sparql").locator(".activity-details").click();
    await expect(activity(page, "sparql").locator(".log-query")).toContainText("SELECT ?s WHERE");
  });
});
