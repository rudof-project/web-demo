// Tables that are sorted and filtered by their columns (table-tools.js).

import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { makeTableTools, compareValues } from "../../table-tools.js";

let document;
beforeEach(() => {
  document = new JSDOM("<body></body>").window.document;
});

function table(header, rows) {
  const t = document.createElement("table");
  t.innerHTML = `<thead><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => (c.startsWith("<td") ? c : `<td>${c}</td>`)).join("")}</tr>`)
    .join("")}</tbody>`;
  document.body.append(t);
  return makeTableTools(t);
}

const column = (t, i, all = false) => [...t.tBodies[0].rows].filter((r) => all || !r.hidden).map((r) => r.cells[i].textContent);
const sortBy = (t, i) => t.tHead.rows[0].cells[i].querySelector(".th-label");
const filterOf = (t, i) => t.tHead.rows[0].cells[i].querySelector(".filter-button");
const menu = () => document.querySelector(".filter-menu");
const valueBox = (value) => [...menu().querySelectorAll(".filter-values .filter-value")].find((l) => l.querySelector(".filter-text").textContent === value).querySelector("input");
const change = (box, checked) => {
  box.checked = checked;
  box.dispatchEvent(new document.defaultView.Event("change"));
};

describe("compareValues", () => {
  it("compares numbers as numbers, and text with its digits as numbers", () => {
    expect(["10", "9", "-1.5", "1e3"].sort(compareValues)).toEqual(["-1.5", "9", "10", "1e3"]);
    expect(["n10", "n2", "N1"].sort(compareValues)).toEqual(["N1", "n2", "n10"]);
  });
});

describe("sorting", () => {
  const ROWS = [
    [":carol", "10"],
    [":alice", "9"],
    [":bob", ""],
  ];

  it("sorts ascending, descending, and back to the order of the rows", () => {
    const t = table(["Node", "Age"], ROWS);
    const th = t.tHead.rows[0].cells[0];
    sortBy(t, 0).click();
    expect(column(t, 0)).toEqual([":alice", ":bob", ":carol"]);
    expect(th.getAttribute("aria-sort")).toBe("ascending");
    sortBy(t, 0).click();
    expect(column(t, 0)).toEqual([":carol", ":bob", ":alice"]);
    sortBy(t, 0).click();
    expect(column(t, 0)).toEqual([":carol", ":alice", ":bob"]);
    expect(th.getAttribute("aria-sort")).toBe("none");
    // Empty cells go last
    sortBy(t, 1).click();
    expect(column(t, 1)).toEqual(["9", "10", ""]);
    sortBy(t, 1).click();
    expect(column(t, 1)).toEqual(["10", "9", ""]);
  });

  it("sorts with the keyboard, and by data-sort when a cell has it", () => {
    const t = table(["Name"], [['<td data-sort="A">Bob</td>'], ["Alice"]]);
    sortBy(t, 0).dispatchEvent(new document.defaultView.KeyboardEvent("keydown", { key: "Enter" }));
    expect(column(t, 0)).toEqual(["Bob", "Alice"]);
  });

  it("keeps the rows with the same value in their order", () => {
    const t = table(["Status", "Node"], [["FAIL", "a"], ["OK", "b"], ["FAIL", "c"]]);
    sortBy(t, 0).click();
    expect(column(t, 1)).toEqual(["a", "c", "b"]);
  });
});

describe("filtering", () => {
  const ROWS = [
    ["FAIL", ":bob", "sh:MinCount"],
    ["OK", ":alice", ""],
    ["FAIL", ":carol", "sh:Datatype"],
    ["OK", ":dave", ""],
  ];

  it("offers the values of the column, with their counts", () => {
    const t = table(["Status", "Node", "Component"], ROWS);
    filterOf(t, 0).click();
    expect(filterOf(t, 0).getAttribute("aria-expanded")).toBe("true");
    const labels = [...menu().querySelectorAll(".filter-values .filter-value")].map((l) => [l.querySelector(".filter-text").textContent, l.querySelector(".filter-count").textContent]);
    expect(labels).toEqual([["FAIL", "2"], ["OK", "2"]]);
    filterOf(t, 2).click();
    expect(document.querySelectorAll(".filter-menu")).toHaveLength(1);
    expect([...menu().querySelectorAll(".filter-text")].map((e) => e.textContent)).toEqual(["sh:Datatype", "sh:MinCount", "(Empty)"]);
  });

  it("shows only the rows with the values chosen, and says how many", () => {
    const t = table(["Status", "Node", "Component"], ROWS);
    filterOf(t, 0).click();
    change(valueBox("OK"), false);
    expect(column(t, 1)).toEqual([":bob", ":carol"]);
    expect(t.tHead.rows[0].cells[0].classList.contains("filtered")).toBe(true);
    expect(t.querySelector("caption").textContent).toBe("Showing 2 of 4 rows");
    // (Select all) is partly checked
    const all = menu().querySelector(".filter-all input");
    expect([all.checked, all.indeterminate]).toEqual([false, true]);
    change(all, true);
    expect(column(t, 1)).toHaveLength(4);
    expect(t.querySelector("caption").hidden).toBe(true);
  });

  it("combines the filters of the columns, and lists the values the others show", () => {
    const t = table(["Status", "Node", "Component"], ROWS);
    filterOf(t, 0).click();
    change(valueBox("OK"), false);
    filterOf(t, 1).click();
    expect([...menu().querySelectorAll(".filter-text")].map((e) => e.textContent)).toEqual([":bob", ":carol"]);
    change(valueBox(":carol"), false);
    expect(column(t, 1)).toEqual([":bob"]);
    // Clear filter of the Node column
    [...menu().querySelectorAll("button")].find((b) => b.textContent === "Clear filter").click();
    expect(menu()).toBeNull();
    expect(column(t, 1)).toEqual([":bob", ":carol"]);
  });

  it("searches the values, and (Select all) chooses the ones found", () => {
    const t = table(["Status", "Node", "Component"], ROWS);
    filterOf(t, 1).click();
    const search = menu().querySelector(".filter-search");
    search.value = "a";
    search.dispatchEvent(new document.defaultView.Event("input"));
    const shown = [...menu().querySelectorAll(".filter-values .filter-value")].filter((l) => !l.hidden).map((l) => l.textContent);
    expect(shown.map((s) => s.replace(/\d+$/, ""))).toEqual([":alice", ":carol", ":dave"]);
    change(menu().querySelector(".filter-all input"), false);
    expect(column(t, 1)).toEqual([":bob"]);
  });

  it("sorts from the menu, and closes with Escape", () => {
    const t = table(["Status", "Node", "Component"], ROWS);
    filterOf(t, 1).click();
    [...menu().querySelectorAll("button")].find((b) => b.textContent === "Sort Z → A").click();
    expect(column(t, 1)).toEqual([":dave", ":carol", ":bob", ":alice"]);
    filterOf(t, 1).click();
    menu().dispatchEvent(new document.defaultView.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(menu()).toBeNull();
  });

  it("keeps the filters when the rows are sorted", () => {
    const t = table(["Status", "Node", "Component"], ROWS);
    filterOf(t, 0).click();
    change(valueBox("FAIL"), false);
    sortBy(t, 1).click();
    expect(column(t, 1)).toEqual([":alice", ":dave"]);
    expect(column(t, 1, true)).toEqual([":alice", ":bob", ":carol", ":dave"]);
  });
});
