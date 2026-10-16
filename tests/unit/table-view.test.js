// @vitest-environment jsdom
// The table view of a CSV input (table-view.js): the switch between the text
// and the table, and the table writing its changes in the text.

import { describe, it, expect, beforeEach } from "vitest";
import { setupTableView } from "../../table-view.js";
import { columnClass } from "../../dctap.js";

const CSV = "shapeID,propertyID,mandatory\nPerson,:name,true\nPerson,:knows,false\n";

function page() {
  localStorage.clear();
  document.body.innerHTML = `
    <div class="field">
      <div class="view-switch"><button data-view="csv"></button><button data-view="table"></button></div>
      <textarea id="tap"></textarea>
      <div id="table" hidden></div>
    </div>`;
  const textarea = document.getElementById("tap");
  textarea.value = CSV;
  const view = setupTableView({
    textarea,
    container: document.getElementById("table"),
    toggle: document.querySelectorAll("button[data-view]"),
    cellClass: columnClass,
  });
  return { textarea, view, table: document.getElementById("table"), buttons: document.querySelectorAll("button[data-view]") };
}

const type = (input, value) => {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("the table view", () => {
  let p;
  beforeEach(() => (p = page()));

  it("starts as CSV, and the switch shows the table", () => {
    expect(p.table.hidden).toBe(true);
    p.buttons[1].click();
    expect(p.table.hidden).toBe(false);
    expect(p.textarea.closest(".field").classList).toContain("table-view");
    expect(p.buttons[1].getAttribute("aria-pressed")).toBe("true");
    expect([...p.table.querySelectorAll("thead input")].map((i) => i.value)).toEqual(["shapeID", "propertyID", "mandatory"]);
    expect([...p.table.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("input")].map((i) => i.value))).toEqual([
      ["Person", ":name", "true"],
      ["Person", ":knows", "false"],
    ]);
  });

  it("colors the cells by the DCTAP column", () => {
    p.view.setView("table");
    const [shape, property, mandatory] = p.table.querySelector("tbody tr").children;
    expect([shape.className, property.className, mandatory.className]).toEqual(["cell-typeName", "cell-propertyName", "cell-bool"]);
  });

  it("writes the changes of the cells in the text, keeping its last line break", () => {
    p.view.setView("table");
    type(p.table.querySelector("tbody input"), "Agent, or person");
    expect(p.textarea.value).toBe('shapeID,propertyID,mandatory\n"Agent, or person",:name,true\nPerson,:knows,false\n');
  });

  it("adds and deletes rows", () => {
    p.view.setView("table");
    p.table.querySelector(".add-row").click();
    expect(p.table.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(p.textarea.value).toBe(`${CSV.trimEnd()}\n,,\n`);
    p.table.querySelector("tbody tr .row-delete").click();
    expect(p.textarea.value).toBe("shapeID,propertyID,mandatory\nPerson,:knows,false\n,,\n");
  });

  it("follows the text when it changes out of the table", () => {
    p.view.setView("table");
    p.textarea.value = "a,b\n1,2";
    p.textarea.dispatchEvent(new Event("input"));
    expect([...p.table.querySelectorAll("tbody input")].map((i) => i.value)).toEqual(["1", "2"]);
  });

  it("gives rows that are short the cells of the header", () => {
    p.textarea.value = "a,b,c\n1";
    p.view.setView("table");
    expect(p.table.querySelectorAll("tbody td input")).toHaveLength(3);
  });

  it("remembers the view", () => {
    p.view.setView("table");
    const again = page();
    expect(again.view.view()).toBe("csv"); // localStorage was cleared by page()
    again.view.setView("table");
    document.body.innerHTML = "";
    localStorage.setItem("rudof-demo-view-tap", "table");
    document.body.innerHTML = '<div class="field"><textarea id="tap"></textarea><div id="table" hidden></div></div>';
    const view = setupTableView({ textarea: document.getElementById("tap"), container: document.getElementById("table"), toggle: [] });
    expect(view.view()).toBe("table");
  });
});
