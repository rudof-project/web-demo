// A table view of the CSV text of an editor (the DCTAP profile): a switch
// between the text (CSV) and a table, whose cells can be edited. The text
// stays the input: each change in the table writes the CSV again in the
// textarea of the editor, and each change of the text (typed, loaded from a
// manifest or a permalink) draws the table again.

import { parseCsv, serializeCsv } from "./csv.js";

const VIEW_KEY = "rudof-demo-view-";

function stored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not remembered
  }
}

const el = (doc, tag, props = {}, ...children) => {
  const e = Object.assign(doc.createElement(tag), props);
  e.append(...children);
  return e;
};

// textarea: the textarea of the CSV editor; container: where the table goes;
// toggle: the buttons of the switch (data-view="csv" and "table");
// cellClass(header): a class for the cells of a column, by its header.
export function setupTableView({ textarea, container, toggle, cellClass = () => "", name = textarea.id }) {
  const doc = textarea.ownerDocument;
  const field = textarea.closest(".field");
  let view = "csv";
  let writing = false;
  // Whether the text ended with a line break, to keep it when the table writes it
  let finalNewline = false;

  function rows() {
    const text = textarea.value;
    finalNewline = /\r?\n$/.test(text);
    return parseCsv(text);
  }

  // The cells of the table, as rows, written as CSV in the editor
  function write() {
    const table = [...container.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("input")].map((input) => input.value));
    writing = true;
    textarea.value = serializeCsv(table) + (finalNewline ? "\n" : "");
    writing = false;
  }

  function cell(value, column, header, tag) {
    const input = el(doc, "input", { type: "text", value, spellcheck: false });
    input.setAttribute("aria-label", header ? `${header}` : `Column ${column + 1}`);
    return el(doc, tag, { className: cellClass(header) }, input);
  }

  function rowActions(index) {
    const remove = el(doc, "button", { type: "button", className: "icon row-delete", textContent: "×", title: "Delete the row" });
    remove.setAttribute("aria-label", `Delete row ${index}`);
    return el(doc, "td", { className: "row-actions" }, remove);
  }

  function draw() {
    const [header = [], ...body] = rows();
    const width = Math.max(header.length, ...body.map((r) => r.length), 1);
    const names = Array.from({ length: width }, (_, i) => header[i] ?? "");
    const pad = (row) => Array.from({ length: width }, (_, i) => row[i] ?? "");
    const thead = el(doc, "thead", {}, el(doc, "tr", {}, ...pad(header).map((v, i) => cell(v, i, v, "th")), el(doc, "th", { className: "row-actions" })));
    const tbody = el(
      doc,
      "tbody",
      {},
      ...body.map((row, r) => el(doc, "tr", {}, ...pad(row).map((v, i) => cell(v, i, names[i], "td")), rowActions(r + 1))),
    );
    const add = el(doc, "button", { type: "button", className: "secondary add-row", textContent: "Add row" });
    container.replaceChildren(el(doc, "div", { className: "table-scroll" }, el(doc, "table", { className: "csv-table" }, thead, tbody)), add);
  }

  container.addEventListener("input", (e) => {
    if (e.target.tagName !== "INPUT") return;
    write();
    // A new header names its column
    if (e.target.closest("th")) {
      const column = [...e.target.closest("tr").children].indexOf(e.target.closest("th"));
      for (const tr of container.querySelectorAll("tbody tr")) {
        const td = tr.children[column];
        if (td) td.className = cellClass(e.target.value);
      }
      e.target.parentElement.className = cellClass(e.target.value);
    }
  });

  container.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    if (button.classList.contains("row-delete")) {
      button.closest("tr").remove();
      write();
      draw();
    } else if (button.classList.contains("add-row")) {
      const width = container.querySelectorAll("thead th:not(.row-actions)").length;
      const tbody = container.querySelector("tbody");
      const tr = el(doc, "tr", {}, ...Array.from({ length: width }, (_, i) => cell("", i, container.querySelectorAll("thead input")[i]?.value ?? "", "td")), rowActions(tbody.children.length + 1));
      tbody.append(tr);
      write();
      tr.querySelector("input")?.focus();
    }
  });

  // Enter goes to the cell below (in a new row at the end); Ctrl+Enter still runs the tab.
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.target.tagName !== "INPUT") return;
    e.preventDefault();
    const td = e.target.parentElement;
    const column = [...td.parentElement.children].indexOf(td);
    let next = td.parentElement.nextElementSibling ?? (td.tagName === "TH" ? container.querySelector("tbody tr") : null);
    if (!next) {
      container.querySelector(".add-row").click();
      next = container.querySelector("tbody tr:last-child");
    }
    next?.children[column]?.querySelector("input")?.focus();
  });

  // The text changed out of the table: the table follows it
  textarea.addEventListener("input", () => {
    if (view === "table" && !writing) draw();
  });

  function setView(next) {
    view = next === "table" ? "table" : "csv";
    field.classList.toggle("table-view", view === "table");
    container.hidden = view !== "table";
    for (const button of toggle) button.setAttribute("aria-pressed", String(button.dataset.view === view));
    if (view === "table") draw();
    store(VIEW_KEY + name, view);
    return view;
  }

  for (const button of toggle) button.addEventListener("click", () => setView(button.dataset.view));
  setView(stored(VIEW_KEY + name) ?? "csv");
  return { setView, view: () => view, draw };
}
