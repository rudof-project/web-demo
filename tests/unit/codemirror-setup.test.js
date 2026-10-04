// @vitest-environment jsdom
// Step 3: codemirror-setup.js puts a CodeMirror editor in place of a textarea.

import { describe, it, expect, afterEach } from "vitest";
import { EditorView } from "@codemirror/view";
import { createEditor } from "../../codemirror-setup.js";

function textarea(value = "", id = "input") {
  const field = document.createElement("div");
  field.className = "field";
  const area = Object.assign(document.createElement("textarea"), { id, value });
  field.append(area);
  document.body.append(field);
  return area;
}

afterEach(() => document.body.replaceChildren());

describe("createEditor", () => {
  it("returns an EditorView", () => {
    const view = createEditor(textarea("x"));
    expect(view).toBeInstanceOf(EditorView);
  });

  it("puts the editor right after the textarea and hides the textarea", () => {
    const area = textarea("x");
    const view = createEditor(area);
    expect(area.nextElementSibling).toBe(view.dom);
    expect(area.hidden).toBe(true);
    expect(view.dom.classList.contains("cm-editor")).toBe(true);
  });

  it("starts with the text of the textarea", () => {
    const view = createEditor(textarea(":alice :knows :bob ."));
    expect(view.state.doc.toString()).toBe(":alice :knows :bob .");
  });

  it("writes what is typed back to the textarea", () => {
    const area = textarea("abc");
    const view = createEditor(area);
    view.dispatch({ changes: { from: 3, insert: "def" } });
    expect(area.value).toBe("abcdef");
  });

  it("tells listeners of the textarea that its text changed", () => {
    const area = textarea("abc");
    const view = createEditor(area);
    let events = 0;
    area.addEventListener("input", () => events++);
    view.dispatch({ changes: { from: 0, insert: "x" } });
    expect(events).toBe(1);
  });

  it("keeps the label of the textarea", () => {
    const area = textarea("", "rdf-data");
    const label = Object.assign(document.createElement("label"), { htmlFor: "rdf-data", textContent: "RDF data" });
    area.before(label);
    const view = createEditor(area);
    expect(view.contentDOM.getAttribute("aria-label")).toBe("RDF data");
  });

  it("marks the editor with the id of its textarea", () => {
    const view = createEditor(textarea("", "shex-schema"));
    expect(view.dom.dataset.editorFor).toBe("shex-schema");
  });

  it("can be removed, showing the textarea again", () => {
    const area = textarea("abc");
    const view = createEditor(area);
    view.destroy();
    expect(area.hidden).toBe(false);
    expect(document.querySelector(".cm-editor")).toBeNull();
  });
});
