// @vitest-environment jsdom
// Step 6: when the page loads, the marked textareas are replaced by editors,
// and the rest of the demo (demo.js) keeps using the textareas as before.

import { describe, it, expect, afterEach, vi } from "vitest";
import { setupEditors, editorFor, setupViewers, viewerFor } from "../../codemirror-setup.js";

function page(html) {
  document.body.innerHTML = html;
}

const FIELDS = `
  <section id="panel-shex">
    <div class="field">
      <label for="shex-data">RDF data</label>
      <textarea id="shex-data" data-editor data-language="turtle">:alice :name "Alice" .</textarea>
    </div>
    <div class="field">
      <label for="shex-shapemap">Shape map</label>
      <textarea id="shex-shapemap" class="short" data-editor data-language="shapemap">:alice@:Person</textarea>
    </div>
    <textarea id="plain">not an editor</textarea>
  </section>`;

afterEach(() => {
  for (const view of document.querySelectorAll(".cm-editor")) editorFor(view.dataset.editorFor)?.destroy();
  document.body.replaceChildren();
});

describe("setupEditors", () => {
  it("replaces each textarea marked with data-editor", () => {
    page(FIELDS);
    const editors = setupEditors();
    expect([...editors.keys()]).toEqual(["shex-data", "shex-shapemap"]);
    expect(document.querySelectorAll(".cm-editor")).toHaveLength(2);
    expect(document.getElementById("shex-data").hidden).toBe(true);
  });

  it("leaves the other textareas alone", () => {
    page(FIELDS);
    setupEditors();
    expect(document.getElementById("plain").hidden).toBe(false);
    expect(editorFor("plain")).toBeUndefined();
  });

  it("can be called again without making a second editor", () => {
    page(FIELDS);
    const first = setupEditors();
    const second = setupEditors();
    expect(document.querySelectorAll(".cm-editor")).toHaveLength(2);
    expect(second.get("shex-data")).toBe(first.get("shex-data"));
  });

  it("finds the editor of a textarea by its id", () => {
    page(FIELDS);
    const editors = setupEditors();
    expect(editorFor("shex-data")).toBe(editors.get("shex-data"));
  });
});

// What demo.js does with the textareas
describe("the textareas are still the inputs of the demo", () => {
  it("their value is the text of the editor", () => {
    page(FIELDS);
    setupEditors();
    const view = editorFor("shex-data");
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: ":bob :name \"Bob\" ." } });
    expect(document.getElementById("shex-data").value).toBe(':bob :name "Bob" .');
  });

  it("setting their value changes the editor (examples, Use as input)", () => {
    page(FIELDS);
    setupEditors();
    document.getElementById("shex-data").value = "SELECT * { ?s ?p ?o }";
    expect(editorFor("shex-data").state.doc.toString()).toBe("SELECT * { ?s ?p ?o }");
  });

  it("setting the value can be undone", async () => {
    const { undo } = await import("@codemirror/commands");
    page(FIELDS);
    setupEditors();
    const area = document.getElementById("shex-data");
    area.value = "changed";
    undo(editorFor("shex-data"));
    expect(area.value).toBe(':alice :name "Alice" .');
  });

  it("focusing them focuses the editor", () => {
    page(FIELDS);
    setupEditors();
    document.getElementById("shex-shapemap").focus();
    expect(document.activeElement).toBe(editorFor("shex-shapemap").contentDOM);
  });

  it("Ctrl+Enter in an editor reaches the panel, which validates", () => {
    page(FIELDS);
    setupEditors();
    const panel = document.getElementById("panel-shex");
    const run = vi.fn((e) => e.preventDefault());
    panel.addEventListener("keydown", (e) => e.key === "Enter" && e.ctrlKey && run(e));
    const view = editorFor("shex-data");
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true }));
    expect(run).toHaveBeenCalledOnce();
    expect(view.state.doc.toString()).toBe(':alice :name "Alice" .');
  });

  it("the textarea works as before when its editor is removed", () => {
    page(FIELDS);
    setupEditors();
    const area = document.getElementById("shex-data");
    area.value = "edited";
    editorFor("shex-data").destroy();
    expect(area.value).toBe("edited");
    area.value = "plain again";
    expect(area.value).toBe("plain again");
    expect(editorFor("shex-data")).toBeUndefined();
  });
});

describe("loading codemirror-setup.js in the page", () => {
  it("replaces the textareas when the page has them", async () => {
    page(FIELDS);
    vi.resetModules();
    const fresh = await import("../../codemirror-setup.js");
    expect(document.querySelectorAll(".cm-editor")).toHaveLength(2);
    for (const id of ["shex-data", "shex-shapemap"]) fresh.editorFor(id).destroy();
  });

  it("does nothing in a page without them", async () => {
    vi.resetModules();
    await import("../../codemirror-setup.js");
    expect(document.querySelector(".cm-editor")).toBeNull();
  });
});

// The results of conversions are shown in read-only viewers, highlighted in
// the result format. demo.js still writes them in their <pre>.
describe("setupViewers", () => {
  const RESULT = `
    <select id="result-format"><option value="turtle">Turtle</option><option value="jsonld">JSON-LD</option></select>
    <div class="result">
      <pre class="output" id="output" data-viewer="Converted data" data-format-select="result-format">:a :b :c .</pre>
    </div>`;
  const pre = () => document.getElementById("output");
  const settled = () => new Promise((resolve) => setTimeout(resolve));

  it("puts a viewer before each <pre> marked with data-viewer, with its text", () => {
    page(RESULT);
    const [view] = setupViewers();
    expect(pre().previousElementSibling).toBe(view.dom);
    expect(pre().classList).toContain("has-viewer");
    expect(view.state.doc.toString()).toBe(":a :b :c .");
    expect(view.dom.dataset.viewerFor).toBe("output");
    expect(viewerFor(pre())).toBe(view);
  });

  it("can't be edited", () => {
    page(RESULT);
    const [view] = setupViewers();
    expect(view.state.readOnly).toBe(true);
    expect(view.contentDOM.getAttribute("aria-readonly")).toBe("true");
    expect(view.contentDOM.getAttribute("aria-label")).toBe("Converted data");
  });

  it("can be called again without making a second viewer", () => {
    page(RESULT);
    const [first] = setupViewers();
    const [second] = setupViewers();
    expect(second).toBe(first);
    expect(document.querySelectorAll(".cm-viewer")).toHaveLength(1);
  });

  it("follows the text of the <pre>, and whether it is hidden", async () => {
    page(RESULT);
    const [view] = setupViewers();
    pre().textContent = '{ "@id": "a" }';
    pre().hidden = true;
    await settled();
    expect(view.state.doc.toString()).toBe('{ "@id": "a" }');
    expect(view.dom.hidden).toBe(true);
  });

  it("highlights the text in the format of the result, but not errors", async () => {
    page(RESULT);
    const [view] = setupViewers();
    expect(view.dom.dataset.format).toBe("turtle");
    document.getElementById("result-format").value = "jsonld";
    pre().textContent = "{}";
    await settled();
    expect(view.dom.dataset.format).toBe("jsonld");
    pre().closest(".result").dataset.kind = "error";
    pre().textContent = "Error: bad data";
    await settled();
    expect(view.dom.dataset.format).toBe("text");
  });
});
