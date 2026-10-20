// What rudof asks the endpoints while a validation or a query runs on one.
// rudof (built with endpoints) sends its HTTP requests with the function that
// setFetch gives it: loggingFetch sends them with fetch, and keeps each
// request in the logs of the runs that wait for its endpoint: its SPARQL
// query, when it was sent, its status, how long it took and what the endpoint
// answered. A run can be stopped: its requests are aborted.
//
// rudof has one fetch function for all its sessions, so a request goes to
// the logs of the runs on the host of its URL (or of all the runs, when no
// run is on that host).

// Why the queries are sent one after another, slowly (rudof_rdf, the
// endpoints of rudof)
export const RATE_NOTE =
  "rudof sends at most one query every 1.1 s to an endpoint, and waits longer (up to 10 s) after an answer " +
  "429 Too Many Requests, so that endpoints such as Wikidata don't block it. It sends a query again when the " +
  "answer is 429, 502, 503 or 504, at most 3 times.";

// The text of the answers that a log keeps, at most
export const ANSWER_LIMIT = 4000;

const active = new Set();

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

// A log of the requests of a run on an endpoint. onChange is called when a
// request is sent or answered.
export function startLog(endpoint, { onChange, now = () => performance.now() } = {}) {
  const controller = new AbortController();
  const log = {
    endpoint,
    host: hostOf(endpoint),
    start: now(),
    end: undefined,
    entries: [],
    signal: controller.signal,
    stopped: false,
    now,
    changed: () => onChange?.(log),
    // The run has its result, or is stopped: its requests are not logged
    // any more
    finish() {
      if (log.end === undefined) log.end = now();
      active.delete(log);
      log.changed();
    },
    stop() {
      log.stopped = true;
      controller.abort(new DOMException("The validation was stopped", "AbortError"));
      log.finish();
    },
  };
  active.add(log);
  return log;
}

// The logs that a request to a URL goes to
function logsOf(url) {
  const host = hostOf(url);
  const same = [...active].filter((log) => log.host && log.host === host);
  return same.length ? same : [...active];
}

// The SPARQL query of a request (GET, with the SPARQL protocol), and the
// other parameters of its URL
export function requestParts(url) {
  try {
    const u = new URL(url);
    const query = u.searchParams.get("query") ?? u.searchParams.get("update");
    u.searchParams.delete("query");
    u.searchParams.delete("update");
    return { query, url: u.href };
  } catch {
    return { query: null, url: String(url) };
  }
}

// The fetch function for setFetch
export function loggingFetch(baseFetch = (...args) => fetch(...args)) {
  return async (url, init = {}) => {
    const logs = logsOf(url);
    const now = logs[0]?.now ?? (() => performance.now());
    const entry = { ...requestParts(url), accept: init.headers?.Accept ?? init.headers?.accept, sent: now(), status: undefined, millis: undefined };
    for (const log of logs) {
      log.entries.push(entry);
      log.changed();
    }
    const signals = [init.signal, ...logs.map((log) => log.signal)].filter(Boolean);
    const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];
    const done = (fields) => {
      Object.assign(entry, fields, { millis: now() - entry.sent });
      for (const log of logs) log.changed();
    };
    try {
      const response = await baseFetch(url, { ...init, signal });
      // What the endpoint answered, without taking it from rudof
      const answer = await response
        .clone()
        .text()
        .catch(() => "");
      done({ status: response.status, statusText: response.statusText, size: answer.length, answer: answer.slice(0, ANSWER_LIMIT) });
      return response;
    } catch (e) {
      done({ error: signal?.aborted ? "Stopped" : `${e.message ?? e}` });
      throw e;
    }
  };
}

// The summary of a log: "3 queries, 1 waiting, 2.4 s"
export function logSummary(log) {
  const n = log.entries.length;
  const waiting = log.entries.filter((e) => e.millis === undefined).length;
  const failed = log.entries.filter((e) => e.error || e.status >= 400).length;
  const seconds = (((log.end ?? log.now()) - log.start) / 1000).toFixed(1);
  const parts = [`${n} ${n === 1 ? "query" : "queries"} to ${log.host ?? log.endpoint}`];
  if (waiting && log.end === undefined) parts.push(`${waiting} waiting for an answer`);
  if (failed) parts.push(`${failed} failed`);
  parts.push(`${seconds} s`);
  return parts.join(", ");
}

// The log as elements: a list of the requests, the last one first
export function renderLog(doc, log) {
  const el = (tag, props = {}, ...children) => {
    const e = Object.assign(doc.createElement(tag), props);
    e.append(...children);
    return e;
  };
  const note = el("li", { className: "hint log-note" }, RATE_NOTE);
  if (!log.entries.length) return [el("li", { className: "hint" }, "No queries yet: rudof prepares the validation, or reads the data of the page."), note];
  const items = log.entries
    .map((entry, i) => {
      const at = `${((entry.sent - log.start) / 1000).toFixed(1)} s`;
      const state =
        entry.error ? `${entry.error}` :
        entry.millis === undefined ? "waiting for an answer…" :
        `${entry.status}${entry.statusText ? ` ${entry.statusText}` : ""}, ${entry.millis.toFixed(0)} ms, ${entry.size} characters`;
      const kind = entry.error || entry.status >= 400 ? "fail" : entry.millis === undefined ? "waiting" : "ok";
      const item = el(
        "li",
        { className: `log-entry ${kind}` },
        el("div", { className: "log-head" }, el("span", { className: "log-n" }, `#${i + 1}`), ` at ${at} · `, el("span", { className: "log-state" }, state)),
        el("pre", { className: "log-query" }, entry.query ?? entry.url),
      );
      if (entry.answer !== undefined) {
        const more = entry.size > entry.answer.length ? `\n… (${entry.size - entry.answer.length} more characters)` : "";
        item.append(el("details", { className: "log-answer" }, el("summary", {}, "Answer"), el("pre", {}, (entry.answer || "(empty)") + more)));
      }
      return item;
    })
    .reverse();
  return [...items, note];
}
