// @vitest-environment jsdom
// Step 4: the editors are configured with line numbers, history, search,
// brackets, syntax highlighting and a theme that follows the page's colors.

import { describe, it, expect, afterEach } from "vitest";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { undo, redo } from "@codemirror/commands";
import { highlightingFor, indentUnit } from "@codemirror/language";
import { searchPanelOpen, openSearchPanel } from "@codemirror/search";
import { tags } from "@lezer/highlight";
import { createEditor, editorSetup } from "../../codemirror-setup.js";

function editor(value = "") {
  const area = Object.assign(document.createElement("textarea"), { id: "input", value });
  document.body.append(area);
  return createEditor(area);
}

// The keys bound in an editor, as written in its keymaps (e.g. "Mod-z").
function boundKeys(view) {
  return view.state.facet(keymap).flat().flatMap((b) => [b.key, b.mac, b.win, b.linux].filter(Boolean));
}

// Types text as the user would, through the input handlers (closeBrackets…).
function type(view, text) {
  const { from, to } = view.state.selection.main;
  const handled = view.state
    .facet(EditorView.inputHandler)
    .some((handler) => handler(view, from, to, text, () => view.state.update({ changes: { from, to, insert: text } })));
  if (!handled) view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
}

afterEach(() => document.body.replaceChildren());

describe("editorSetup", () => {
  it("is an extension that can be used in any editor state", () => {
    expect(() => EditorState.create({ extensions: editorSetup() })).not.toThrow();
  });
});

describe("editor configuration", () => {
  it("shows line numbers", () => {
    const view = editor("a\nb\nc");
    expect(view.dom.querySelector(".cm-lineNumbers")).not.toBeNull();
  });

  it("highlights the active line", () => {
    const view = editor("a");
    expect(view.dom.querySelector(".cm-activeLine")).not.toBeNull();
  });

  it("wraps long lines, as the textareas did", () => {
    const view = editor("a");
    expect(view.contentDOM.classList.contains("cm-lineWrapping")).toBe(true);
  });

  it("undoes and redoes changes", () => {
    const view = editor("abc");
    view.dispatch({ changes: { from: 3, insert: "def" } });
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("abc");
    expect(redo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("abcdef");
  });

  it("binds the usual keys: undo, search, indentation", () => {
    const view = editor();
    const keys = boundKeys(view);
    for (const key of ["Mod-z", "Mod-f", "Mod-g", "Tab", "Mod-/"]) expect(keys).toContain(key);
    // Shift-Tab is the shift of the Tab binding
    expect(view.state.facet(keymap).flat().find((b) => b.key === "Tab").shift).toBeTypeOf("function");
  });

  it("leaves Ctrl+Enter to the demo, which validates with it", () => {
    expect(boundKeys(editor())).not.toContain("Mod-Enter");
  });

  it("opens a search panel", () => {
    const view = editor("alice bob alice");
    expect(openSearchPanel(view)).toBe(true);
    expect(searchPanelOpen(view.state)).toBe(true);
  });

  it("closes brackets and quotes", () => {
    const view = editor("");
    type(view, "{");
    expect(view.state.doc.toString()).toBe("{}");
    view.dispatch({ changes: { from: 0, to: 2 } });
    type(view, '"');
    expect(view.state.doc.toString()).toBe('""');
  });

  it("indents with two spaces", () => {
    const view = editor("");
    expect(view.state.facet(indentUnit)).toBe("  ");
    expect(view.state.tabSize).toBe(2);
  });

  it("has a highlighting style for the common tokens", () => {
    const view = editor("");
    for (const tag of [tags.keyword, tags.string, tags.comment, tags.number, tags.variableName, tags.url]) {
      expect(highlightingFor(view.state, [tag]), String(tag)).toBeTruthy();
    }
  });

  it("uses the colors and font of the page", () => {
    editor("");
    const css = [...document.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    for (const variable of ["--surface", "--text", "--border", "--accent", "--mono"]) {
      expect(css).toContain(`var(${variable})`);
    }
  });

  it("keeps a textarea class (short, medium) as the editor's height", () => {
    const area = Object.assign(document.createElement("textarea"), { className: "short" });
    document.body.append(area);
    const view = createEditor(area);
    expect(view.dom.classList.contains("short")).toBe(true);
  });

  it("can take more extensions", () => {
    const area = Object.assign(document.createElement("textarea"), { value: "abc" });
    document.body.append(area);
    const view = createEditor(area, { extensions: EditorState.readOnly.of(true) });
    expect(view.state.readOnly).toBe(true);
  });
});
