// The log of the requests to endpoints (endpoint-log.js).

import { describe, it, expect } from "vitest";
import { startLog, loggingFetch, logSummary, requestParts, ANSWER_LIMIT } from "../../endpoint-log.js";

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
    expect(logSummary(log)).toBe("1 query to a.example, 1.3 s");
  });

  it("says the queries that wait for an answer, and those that failed", async () => {
    const now = clock();
    const log = startLog("https://a.example/sparql", { now });
    let answer;
    const fetch = loggingFetch((url) => (url.includes("fail") ? Promise.resolve(new Response("no", { status: 500 })) : new Promise((resolve) => (answer = resolve))));
    const waiting = fetch(QUERY_URL("a.example", "ASK {}"), { headers: {} });
    await fetch(QUERY_URL("a.example", "fail"), { headers: {} });
    now.add(2000);
    expect(logSummary(log)).toBe("2 queries to a.example, 1 waiting for an answer, 1 failed, 2.0 s");
    answer(new Response("{}"));
    await waiting;
    expect(logSummary(log)).toBe("2 queries to a.example, 1 failed, 2.0 s");
  });

  it("stops: the requests that wait are aborted", async () => {
    const log = startLog("https://a.example/sparql");
    const fetch = loggingFetch((url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))));
    const waiting = fetch(QUERY_URL("a.example", "ASK {}"), { headers: {} });
    log.stop();
    await expect(waiting).rejects.toThrow("stopped");
    expect(log.entries[0].error).toBe("Stopped");
    expect(log.stopped).toBe(true);
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
    expect(requestParts("https://a.example/sparql?query=ASK%20%7B%7D&format=json")).toEqual({ query: "ASK {}", url: "https://a.example/sparql?format=json" });
    expect(requestParts("https://a.example/page.ttl")).toEqual({ query: null, url: "https://a.example/page.ttl" });
  });
});
