// The log of the requests to endpoints (endpoint-log.js).

import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { startLog, loggingFetch, logSummary, logTime, requestParts, nodesOf, limitsText, sizeText, answerText, renderQueries, isStopping, ANSWER_LIMIT, MAX_ROWS } from "../../endpoint-log.js";

const QUERY_URL = (host, query) => `https://${host}/sparql?query=${encodeURIComponent(query)}`;

// A clock that the tests move
function clock() {
  let t = 0;
  const now = () => t;
  now.add = (ms) => (t += ms);
  return now;
}

describe("the log of a run on an endpoint", () => {
  it("has each request: its query, its status, its time and the start of the answer", async () => {
    const now = clock();
    const log = startLog("https://a.example/sparql", { now });
    const fetch = loggingFetch(async () => {
      now.add(250);
      return new Response("x".repeat(ANSWER_LIMIT + 10), { status: 200 });
    });
    const response = await fetch(QUERY_URL("a.example", "SELECT * WHERE { ?s ?p ?o }"), { headers: { Accept: "application/sparql-results+json" } });
    // rudof still reads the answer
    expect((await response.text()).length).toBe(ANSWER_LIMIT + 10);
    expect(log.entries).toEqual([
      expect.objectContaining({ query: "SELECT * WHERE { ?s ?p ?o }", url: "https://a.example/sparql", accept: "application/sparql-results+json", sent: 0, status: 200, millis: 250, size: ANSWER_LIMIT + 10 }),
    ]);
    expect(log.entries[0].answer).toHaveLength(ANSWER_LIMIT);
    now.add(1000);
    log.finish();
    expect(logSummary(log)).toBe("1 query · 1 answered · 0 failed");
    expect(logTime(log)).toBe("1.3 s");
  });

  it("says the queries that wait for an answer, and those that failed", async () => {
    const now = clock();
    const log = startLog("https://a.example/sparql", { now });
    let answer;
    const fetch = loggingFetch((url) => (url.includes("fail") ? Promise.resolve(new Response("no", { status: 500 })) : new Promise((resolve) => (answer = resolve))));
    const waiting = fetch(QUERY_URL("a.example", "ASK {}"), { headers: {} });
    await fetch(QUERY_URL("a.example", "fail"), { headers: {} });
    now.add(2000);
    expect(logSummary(log)).toBe("2 queries · 0 answered · 1 waiting · 1 failed");
    answer(new Response("{}"));
    await waiting;
    expect(logSummary(log)).toBe("2 queries · 1 answered · 0 waiting · 1 failed");
    log.finish();
  });

  it("stops: the requests that wait are aborted", async () => {
    const log = startLog("https://a.example/sparql");
    const fetch = loggingFetch((url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))));
    const waiting = fetch(QUERY_URL("a.example", "ASK {}"), { headers: {} });
    log.stop();
    await expect(waiting).rejects.toThrow("stopped");
    expect(log.entries[0].error).toBe("Stopped");
    expect(log.stopped).toBe(true);
    log.finish();
  });

  it("stops: the next requests of the stopped run fail at once, until rudof gives up", async () => {
    const sent = [];
    const fetch = loggingFetch(async (url) => (sent.push(url), new Response("{}")));
    const log = startLog("https://a.example/sparql");
    await fetch(QUERY_URL("a.example", "first"), { headers: {} });
    log.stop();
    expect(isStopping(log)).toBe(true);
    // rudof goes on: its requests are not sent, and the log counts them
    await expect(fetch(QUERY_URL("a.example", "next"), { headers: {} })).rejects.toThrow("The validation was stopped");
    await expect(fetch("https://other.example/schema.shex", { headers: {} })).rejects.toThrow("The validation was stopped");
    expect(sent).toHaveLength(1);
    expect(log.blocked).toBe(2);
    expect(logSummary(log)).toBe("1 query · 1 answered · 0 failed · stopping: rudof gives up, 2 requests not sent");
    // A run on another endpoint sends its requests
    const other = startLog("https://b.example/sparql");
    await fetch(QUERY_URL("b.example", "b"), { headers: {} });
    expect(sent).toHaveLength(2);
    other.finish();
    // rudof gave up: the requests are sent again
    let done = false;
    log.finished.then(() => (done = true));
    log.finish();
    await Promise.resolve();
    expect(done).toBe(true);
    expect(isStopping(log)).toBe(false);
    expect(logSummary(log)).toBe("1 query · 1 answered · 0 failed · stopped, 2 requests not sent");
    await fetch(QUERY_URL("a.example", "later"), { headers: {} });
    expect(sent).toHaveLength(3);
  });

  it("keeps the requests to the host of its endpoint, or all when no run is on their host", async () => {
    const a = startLog("https://a.example/sparql");
    const b = startLog("https://b.example/sparql");
    const fetch = loggingFetch(async () => new Response(""));
    await fetch(QUERY_URL("a.example", "A"), { headers: {} });
    await fetch(QUERY_URL("c.example", "C"), { headers: {} });
    expect(a.entries.map((e) => e.query)).toEqual(["A", "C"]);
    expect(b.entries.map((e) => e.query)).toEqual(["C"]);
    // A finished run doesn't get more requests
    a.finish();
    await fetch(QUERY_URL("a.example", "A2"), { headers: {} });
    expect(a.entries).toHaveLength(2);
    b.finish();
  });

  it("reads the query of a request", () => {
    expect(requestParts("https://a.example/sparql?query=ASK%20%7B%7D&format=json")).toEqual({ query: "ASK {}", url: "https://a.example/sparql?format=json", nodes: undefined });
    // Dereference: the IRI of a node
    expect(requestParts("https://a.example/page.ttl")).toEqual({ query: null, url: "https://a.example/page.ttl", nodes: 1 });
  });

  it("counts the nodes that a query asks about", () => {
    expect(nodesOf("SELECT ?s ?p ?o WHERE { VALUES ?s { <http://a> <http://b> wd:Q1 } { ?s ?p ?o } }")).toBe(3);
    expect(nodesOf("SELECT ?p ?o WHERE { <http://a> ?p ?o }")).toBeUndefined();
  });

  it("writes the limits, the sizes and the answers", () => {
    expect(limitsText({ interval: 1100, concurrent: 1, nodes: 20 })).toBe("1 query every 1.1 s at most · 1 at a time · 20 nodes per query");
    expect(limitsText({ interval: 250, concurrent: 4, nodes: 1 })).toBe("1 query every 250 ms at most · 4 at a time · 1 node per query");
    expect(limitsText({ interval: 0, concurrent: 1, nodes: 20 })).toMatch(/^no wait between queries/);
    expect([sizeText(512), sizeText(12345), sizeText(2_500_000)]).toEqual(["512 B", "12.3 kB", "2.5 MB"]);
    expect(answerText({ answer: '{"head":{}}', size: 11 })).toBe('{\n  "head": {}\n}');
    // Not all of it: as it is
    expect(answerText({ answer: '{"head":', size: 100 })).toBe('{"head":');
    expect(answerText({ answer: "", size: 0 })).toBe("(empty)");
  });

  it("is a table of the requests, the last one first, which shows a request with a click", async () => {
    const doc = new JSDOM("").window.document;
    const now = clock();
    let changes = 0;
    const log = startLog("https://a.example/sparql", { now, onChange: () => (changes += 1) });
    const fetch = loggingFetch(async () => new Response('{"head":{}}'));
    await fetch(QUERY_URL("a.example", "SELECT * WHERE { VALUES ?s { <http://a> <http://b> } ?s ?p ?o }"), { headers: {} });
    now.add(1100);
    await fetch(QUERY_URL("a.example", "ASK {}"), { headers: {} });
    log.finish();
    let table = renderQueries(doc, log);
    expect([...table.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["#", "Sent", "Status", "Time", "Size", "Nodes", "Query"]);
    const rows = () => [...table.querySelectorAll("tr.query-row")].map((tr) => [...tr.children].slice(0, 6).map((td) => td.textContent));
    expect(rows()).toEqual([
      ["2", "1.1 s", "200", "0 ms", "11 B", ""],
      ["1", "0.0 s", "200", "0 ms", "11 B", "2"],
    ]);
    // A click shows the query and the answer, and the log says it changed
    const before = changes;
    table.querySelector('tr.query-row[data-n="0"] td').dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles: true }));
    expect(changes).toBe(before + 1);
    table = renderQueries(doc, log);
    expect(table.querySelector("tr.query-detail .query-full").textContent).toContain("VALUES ?s");
    expect(table.querySelector("tr.query-detail .query-answer").textContent).toBe('{\n  "head": {}\n}');
  });

  it("shows the last MAX_ROWS requests", async () => {
    const doc = new JSDOM("").window.document;
    const log = startLog("https://c.example/sparql");
    const fetch = loggingFetch(async () => new Response("{}"));
    for (let i = 0; i < MAX_ROWS + 3; i++) await fetch(QUERY_URL("c.example", `Q${i}`), { headers: {} });
    log.finish();
    const table = renderQueries(doc, log);
    expect(table.querySelectorAll("tr.query-row")).toHaveLength(MAX_ROWS);
    expect(table.querySelector("tr.query-row td").textContent).toBe(String(MAX_ROWS + 3));
    expect(table.querySelector("tr.query-none").textContent).toBe("… and 3 earlier queries, which the table doesn't show");
  });
});
