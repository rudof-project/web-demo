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
//
// rudof can't be stopped from JavaScript: a stopped run goes on until rudof
// gives up. Until then (finish), its new requests fail at once, without
// going to the network: else rudof would go on asking the endpoint, and
// reading its answers, in the page.

import { makeResizable } from "./table-tools.js";

// The text of the answers that a log keeps, at most
export const ANSWER_LIMIT = 4000;

const active = new Set();
// The runs that were stopped, until rudof gives up
const stopping = new Set();

// Why a request of a stopped run fails
const stoppedError = () => new DOMException("The validation was stopped", "AbortError");

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
  let finished;
  const log = {
    // When rudof has the result, or gave up after the run was stopped
    finished: new Promise((resolve) => (finished = resolve)),
    endpoint,
    host: hostOf(endpoint),
    start: now(),
    end: undefined,
    entries: [],
    // The requests that a stopped run tried to send
    blocked: 0,
    signal: controller.signal,
    stopped: false,
    now,
    changed: () => onChange?.(log),
    // The run has its result, or rudof gave up after it was stopped
    finish() {
      if (log.end === undefined) log.end = now();
      active.delete(log);
      stopping.delete(log);
      finished();
      log.changed();
    },
    // The requests that wait are aborted, and the next ones fail
    stop() {
      log.stopped = true;
      if (log.end === undefined) log.end = now();
      active.delete(log);
      stopping.add(log);
      controller.abort(stoppedError());
      log.changed();
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

// The stopped runs that a request to a URL is of: those on its host, when
// no running run is on it, or all of them, when no run is running
function stoppedOf(url) {
  const host = hostOf(url);
  if ([...active].some((log) => log.host && log.host === host)) return [];
  const same = [...stopping].filter((log) => log.host && log.host === host);
  return same.length || active.size ? same : [...stopping];
}

// The SPARQL query of a request (GET, with the SPARQL protocol), and the
// other parameters of its URL. A request without a query gets the RDF of an
// IRI (the dereference strategy).
export function requestParts(url) {
  try {
    const u = new URL(url);
    const query = u.searchParams.get("query") ?? u.searchParams.get("update");
    u.searchParams.delete("query");
    u.searchParams.delete("update");
    return { query, url: u.href, nodes: nodesOf(query) };
  } catch {
    return { query: null, url: String(url), nodes: undefined };
  }
}

// The nodes that a query asks about: the values of its VALUES (rudof asks
// about several nodes of a shape map in one query), or one
export function nodesOf(query) {
  if (!query) return 1;
  const values = query.match(/VALUES\s+\?\w+\s*\{([^}]*)\}/i);
  if (!values) return undefined;
  return (values[1].match(/<[^>]*>|"(?:[^"\\]|\\.)*"(?:\^\^<[^>]*>|@[\w-]+)?|_:\S+|[\w-]*:\S*/g) ?? []).length;
}

// The fetch function for setFetch
export function loggingFetch(baseFetch = (...args) => fetch(...args)) {
  return async (url, init = {}) => {
    // A request of a stopped run
    const stopped = stoppedOf(url);
    if (stopped.length) {
      for (const log of stopped) {
        log.blocked += 1;
        log.changed();
      }
      throw stoppedError();
    }
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

// The numbers of the requests of a log
export function logCounts(log) {
  const sent = log.entries.length;
  const waiting = log.entries.filter((e) => e.millis === undefined).length;
  const failed = log.entries.filter((e) => e.error || e.status >= 400).length;
  return { sent, answered: sent - waiting - failed, waiting, failed };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The summary of a log: "8 queries · 7 answered · 1 waiting · 0 failed"
export function logSummary(log) {
  const { sent, answered, waiting, failed } = logCounts(log);
  const parts = [plural(sent, "query", "queries"), `${answered} answered`];
  if (waiting || log.end === undefined) parts.push(`${waiting} waiting`);
  parts.push(`${failed} failed`);
  if (log.stopped) parts.push(stoppingText(log));
  return parts.join(" · ");
}

// What a stopped run does: rudof goes on until it gives up, without sending
// its requests
export function stoppingText(log) {
  const blocked = log.blocked ? `, ${plural(log.blocked, "request", "requests")} not sent` : "";
  return stopping.has(log) ? `stopping: rudof gives up${blocked}` : `stopped${blocked}`;
}

// Whether rudof still runs a stopped run
export const isStopping = (log) => stopping.has(log);

// The time of a run so far, or all of it: "12.4 s"
export const logTime = (log) => `${(((log.end ?? log.now()) - log.start) / 1000).toFixed(1)} s`;

// The limits of the requests to an endpoint, as text:
// { interval, concurrent, nodes } in ms, requests and nodes. `parts`: the
// limits to say; `own`: those that the endpoint sets itself, which are
// marked with the name of the endpoint (owner).
export function limitsText({ interval, concurrent, nodes, own = new Set() }, { parts = ["interval", "concurrent", "nodes"], owner } = {}) {
  const texts = {
    interval: interval ? `1 query every ${interval >= 1000 ? `${(interval / 1000).toFixed(1)} s` : `${interval} ms`} at most` : "no wait between queries",
    concurrent: `${concurrent} at a time`,
    nodes: `${plural(nodes, "node", "nodes")} per query`,
  };
  return parts.map((part) => texts[part] + (own.has(part) && owner ? ` (set by ${owner})` : "")).join(" · ");
}

// A size in characters: "512 B", "12.3 kB", "1.2 MB"
export function sizeText(n) {
  if (n === undefined) return "";
  if (n < 1000) return `${n} B`;
  if (n < 1e6) return `${(n / 1000).toFixed(1)} kB`;
  return `${(n / 1e6).toFixed(1)} MB`;
}

// The state of a request, as text, and its kind (ok, fail, waiting)
function stateOf(entry) {
  if (entry.error) return [entry.error, "fail"];
  if (entry.millis === undefined) return ["waiting…", "waiting"];
  return [`${entry.status}${entry.statusText ? ` ${entry.statusText}` : ""}`, entry.status >= 400 ? "fail" : "ok"];
}

// The answer to a request, as the log keeps it: JSON (SPARQL results)
// indented, when the log has all of it
export function answerText({ answer, size }) {
  if (!answer) return "(empty)";
  if (size === answer.length && /^\s*[[{]/.test(answer)) {
    try {
      return JSON.stringify(JSON.parse(answer), null, 2);
    } catch {
      // not JSON
    }
  }
  return answer;
}

// The requests that the table shows at most, the last ones: the table is
// drawn again at each request
export const MAX_ROWS = 500;

const COLUMNS = ["#", "Sent", "Status", "Time", "Size", "Nodes", "Query"];

// The requests of a log as a table, the last one first. A click on a request
// shows its query and its answer under it (log.open has the numbers of the
// requests shown so).
export function renderQueries(doc, log) {
  const el = (tag, props = {}, ...children) => {
    const e = Object.assign(doc.createElement(tag), props);
    e.append(...children);
    return e;
  };
  log.open ??= new Set();
  const rows = [];
  const first = Math.max(0, log.entries.length - MAX_ROWS);
  log.entries.forEach((entry, i) => {
    if (i < first) return;
    const [state, kind] = stateOf(entry);
    const open = log.open.has(i);
    const row = el(
      "tr",
      { className: `query-row ${kind}${open ? " open" : ""}`, tabIndex: 0, title: open ? "Hide the query and the answer" : "Show the query and the answer" },
      el("td", { className: "query-n" }, String(i + 1)),
      el("td", {}, `${((entry.sent - log.start) / 1000).toFixed(1)} s`),
      el("td", { className: "query-state" }, state),
      el("td", {}, entry.millis === undefined ? "" : `${entry.millis.toFixed(0)} ms`),
      el("td", {}, sizeText(entry.size)),
      el("td", {}, entry.nodes === undefined ? "" : String(entry.nodes)),
      el("td", { className: "query-text" }, el("span", {}, (entry.query ?? entry.url).replace(/\s+/g, " ").trim())),
    );
    row.dataset.n = String(i);
    row.setAttribute("aria-expanded", String(open));
    const group = [row];
    if (open) {
      const more = entry.size > (entry.answer?.length ?? 0) ? `\n… (${entry.size - entry.answer.length} more characters)` : "";
      const cell = el("td", { colSpan: COLUMNS.length }, el("div", { className: "query-label" }, entry.query ? "Query" : "IRI"), el("pre", { className: "query-full" }, entry.query ?? entry.url));
      if (entry.query) cell.append(el("div", { className: "query-label" }, `Endpoint: ${entry.url}`));
      if (entry.answer !== undefined) cell.append(el("div", { className: "query-label" }, "Answer"), el("pre", { className: "query-answer" }, answerText(entry) + more));
      group.push(el("tr", { className: "query-detail" }, cell));
    }
    rows.push(group);
  });
  const body = el("tbody", {}, ...rows.reverse().flat());
  if (first) body.append(el("tr", { className: "query-none" }, el("td", { colSpan: COLUMNS.length }, `… and ${plural(first, "earlier query", "earlier queries")}, which the table doesn't show`)));
  if (!log.entries.length) body.append(el("tr", { className: "query-none" }, el("td", { colSpan: COLUMNS.length }, "No queries yet: rudof prepares the run.")));
  const table = el("table", { className: "queries" }, el("thead", {}, el("tr", {}, ...COLUMNS.map((c) => el("th", {}, c)))), body);
  // The borders of the columns change their widths, which stay when the
  // table is drawn again (at each request)
  makeResizable(table, { key: "queries" });
  const toggle = (row) => {
    const n = Number(row.dataset.n);
    if (log.open.has(n)) log.open.delete(n);
    else log.open.add(n);
    log.changed();
  };
  table.addEventListener("click", (e) => {
    const row = e.target.closest("tr.query-row");
    if (row && !doc.getSelection?.()?.toString()) toggle(row);
  });
  table.addEventListener("keydown", (e) => {
    const row = e.target.closest?.("tr.query-row");
    if (row && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      toggle(row);
    }
  });
  return table;
}
