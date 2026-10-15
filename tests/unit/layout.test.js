// @vitest-environment jsdom
// The layout of the boxes: side by side or one above the other, the widths
// of the boxes side by side, and full screen.

import { describe, it, expect, beforeEach } from "vitest";
import { setupLayout, setLayout, setSplit, splitOf, setMaximized, maximizedBox, LAYOUTS, DEFAULT_LAYOUT } from "../../layout.js";

const PAGE = `
  <label>Layout <select id="layout"></select></label>
  <section id="panel-rdf">
    <div class="inputs two">
      <div class="field" id="input">
        <div class="field-head"><label>RDF data</label><select></select></div>
        <textarea></textarea>
      </div>
      <div class="field" id="output">
        <div class="field-head"><label>Converted to</label></div>
        <div class="result"><div class="result-head"><span class="verdict"></span><span class="timing"></span></div></div>
      </div>
    </div>
    <div class="result" id="result"><div class="result-head"><span class="verdict"></span></div></div>
  </section>`;

const $ = (id) => document.getElementById(id);
const grid = () => document.querySelector(".inputs.two");
const key = (name) => new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true });

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = PAGE;
  delete document.body.dataset.layout;
});

describe("layouts", () => {
  it("starts side by side, and fills the menu of layouts", () => {
    setupLayout();
    expect(document.body.dataset.layout).toBe(DEFAULT_LAYOUT);
    expect([...$("layout").options].map((o) => o.value)).toEqual(Object.keys(LAYOUTS));
  });

  it("changes the layout with the menu, and remembers it", () => {
    setupLayout();
    $("layout").value = "stacked-swapped";
    $("layout").dispatchEvent(new Event("change"));
    expect(document.body.dataset.layout).toBe("stacked-swapped");
    document.body.innerHTML = PAGE;
    setupLayout();
    expect(document.body.dataset.layout).toBe("stacked-swapped");
    expect($("layout").value).toBe("stacked-swapped");
  });

  it("does not accept unknown layouts", () => {
    expect(setLayout(document.body, "diagonal")).toBe(DEFAULT_LAYOUT);
  });
});

describe("splitters", () => {
  it("puts a splitter between the two boxes of a row", () => {
    setupLayout();
    const splitter = grid().querySelector(".splitter");
    expect(splitter.previousElementSibling.id).toBe("input");
    expect(splitter.nextElementSibling.id).toBe("output");
    expect(splitter.getAttribute("role")).toBe("separator");
    expect(splitOf(grid())).toBe(50);
  });

  it("does not add a second splitter", () => {
    setupLayout();
    setupLayout();
    expect(grid().querySelectorAll(".splitter")).toHaveLength(1);
  });

  it("sets the widths of the columns, between limits", () => {
    setupLayout();
    expect(setSplit(grid(), 70)).toBe(70);
    expect(grid().style.getPropertyValue("--left")).toBe("70fr");
    expect(grid().style.getPropertyValue("--right")).toBe("30fr");
    expect(setSplit(grid(), 2)).toBe(15);
    expect(setSplit(grid(), 99)).toBe(85);
  });

  it("changes the widths with the arrow keys, and remembers them", () => {
    setupLayout();
    const splitter = grid().querySelector(".splitter");
    splitter.dispatchEvent(key("ArrowRight"));
    splitter.dispatchEvent(key("ArrowRight"));
    expect(splitOf(grid())).toBe(60);
    document.body.innerHTML = PAGE;
    setupLayout();
    expect(splitOf(grid())).toBe(60);
  });

  it("shares the width equally again with a double click", () => {
    setupLayout();
    setSplit(grid(), 30);
    grid().querySelector(".splitter").dispatchEvent(new MouseEvent("dblclick"));
    expect(splitOf(grid())).toBe(50);
  });
});

describe("full screen", () => {
  it("has a button in the head of each field, and of each result out of a field", () => {
    setupLayout();
    expect(document.querySelectorAll(".maximize")).toHaveLength(3);
    expect($("input").querySelector(".field-head > .maximize")).not.toBeNull();
    expect($("result").querySelector(".result-head > .maximize")).not.toBeNull();
    expect($("output").querySelector(".result-head > .maximize")).toBeNull();
  });

  it("shows a box on the whole window, and back", () => {
    setupLayout();
    const button = $("input").querySelector(".maximize");
    button.click();
    expect($("input").classList).toContain("maximized");
    expect(document.body.classList).toContain("has-maximized");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("aria-label")).toMatch(/Exit full screen/);
    button.click();
    expect($("input").classList).not.toContain("maximized");
    expect(document.body.classList).not.toContain("has-maximized");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("shows one box at a time", () => {
    setupLayout();
    setMaximized($("input"), true);
    setMaximized($("result"), true);
    expect(document.querySelectorAll(".maximized")).toHaveLength(1);
    expect(maximizedBox()).toBe($("result"));
    expect($("input").querySelector(".maximize").getAttribute("aria-pressed")).toBe("false");
  });

  it("gives the normal size back with Esc, unless the editor used it", () => {
    setupLayout();
    setMaximized($("input"), true);
    const used = key("Escape");
    used.preventDefault();
    document.body.dispatchEvent(used);
    expect(maximizedBox()).toBe($("input"));
    document.body.dispatchEvent(key("Escape"));
    expect(maximizedBox()).toBeNull();
  });
});
