// @vitest-environment jsdom
// Step 6: when the page loads, the marked textareas are replaced by editors,
// and the rest of the demo (demo.js) keeps using the textareas as before.

import { describe, it, expect, afterEach, vi } from "vitest";
import { setupEditors, editorFor } from "../../codemirror-setup.js";

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
