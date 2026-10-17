// Tables that are sorted by clicking their headers (sortable.js).

import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { makeSortable, compareValues } from "../../sortable.js";

const { document } = new JSDOM("").window;

function table(header, rows) {
  const t = document.createElement("table");
  t.innerHTML = `<thead><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return makeSortable(t);
}

const column = (t, i) => [...t.tBodies[0].rows].map((r) => r.cells[i].textContent);

describe("compareValues", () => {
  it("compares numbers as numbers, and text with its digits as numbers", () => {
    expect(["10", "9", "-1.5", "1e3"].sort(compareValues)).toEqual(["-1.5", "9", "10", "1e3"]);
    expect(["n10", "n2", "N1"].sort(compareValues)).toEqual(["N1", "n2", "n10"]);
  });
});

describe("makeSortable", () => {
  const ROWS = [
    [":carol", "10"],
    [":alice", "9"],
    [":bob", ""],
  ];

  it("sorts ascending, descending, and back to the order of the rows", () => {
    const t = table(["Node", "Age"], ROWS);
    const [node, age] = t.tHead.rows[0].cells;
    node.click();
    expect(column(t, 0)).toEqual([":alice", ":bob", ":carol"]);
    expect(node.getAttribute("aria-sort")).toBe("ascending");
    node.click();
    expect(column(t, 0)).toEqual([":carol", ":bob", ":alice"]);
    expect(node.getAttribute("aria-sort")).toBe("descending");
    node.click();
    expect(column(t, 0)).toEqual([":carol", ":alice", ":bob"]);
    expect(node.getAttribute("aria-sort")).toBe("none");
    // Another column starts in ascending order; empty cells go last
    age.click();
    expect(column(t, 1)).toEqual(["9", "10", ""]);
    expect(node.getAttribute("aria-sort")).toBe("none");
    age.click();
    expect(column(t, 1)).toEqual(["10", "9", ""]);
  });

  it("sorts with the keyboard, and by data-sort when a cell has it", () => {
    const t = table(["Name"], [["Bob"], ["Alice"]]);
    t.tBodies[0].rows[0].cells[0].dataset.sort = "A";
    const th = t.tHead.rows[0].cells[0];
    expect(th.tabIndex).toBe(0);
    th.dispatchEvent(new document.defaultView.KeyboardEvent("keydown", { key: "Enter" }));
    expect(column(t, 0)).toEqual(["Bob", "Alice"]);
  });

  it("keeps the rows with the same value in their order", () => {
    const t = table(["Status", "Node"], [["FAIL", "a"], ["OK", "b"], ["FAIL", "c"]]);
    t.tHead.rows[0].cells[0].click();
    expect(column(t, 1)).toEqual(["a", "c", "b"]);
  });
});
