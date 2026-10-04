// CodeMirror 6 editors in place of the input textareas of the demo.
//
// Each editor is put right after its textarea, which is hidden and kept in
// sync: what is typed is written back to the textarea, so the textarea still
// holds the text of the input.

import { EditorState } from "@codemirror/state";
import {
  EditorView,
  ViewPlugin,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput, indentUnit } from "@codemirror/language";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { tags as t } from "@lezer/highlight";

// The colors and font are those of the page (demo.css), so the editors follow
// its light and dark schemes.
const theme = EditorView.theme({
  "&": {
    minHeight: "16rem",
    maxHeight: "40rem",
    resize: "vertical",
    overflow: "hidden",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    background: "var(--surface)",
    color: "var(--text)",
    font: "13px/1.45 var(--mono)",
  },
  "&.short": { minHeight: "3.5rem" },
  "&.medium": { minHeight: "7.5rem" },
  "&.cm-focused": { outline: "2px solid var(--accent)", outlineOffset: "1px" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "inherit" },
  ".cm-content": { padding: "0.6rem 0", caretColor: "var(--text)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--text)" },
  ".cm-gutters": { background: "var(--surface)", color: "var(--muted)", border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { background: "var(--cm-active-line)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    background: "var(--cm-selection)",
  },
  ".cm-selectionMatch": { background: "var(--cm-selection-match)" },
  "&.cm-focused .cm-matchingBracket": { background: "var(--cm-selection-match)", outline: "1px solid var(--muted)" },
  ".cm-panels": { background: "var(--bg)", color: "var(--text)" },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--border)" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--border)" },
  ".cm-textfield": { border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface)", color: "var(--text)" },
  ".cm-button": { backgroundImage: "none", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" },
  ".cm-searchMatch": { background: "var(--cm-search-match)" },
});

const highlighting = HighlightStyle.define([
  { tag: [t.keyword, t.definitionKeyword, t.operatorKeyword, t.modifier], color: "var(--cm-keyword)", fontWeight: "600" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--cm-string)" },
  { tag: [t.number, t.bool, t.atom, t.null], color: "var(--cm-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.meta, t.processingInstruction], color: "var(--cm-comment)", fontStyle: "italic" },
  { tag: [t.variableName, t.special(t.variableName)], color: "var(--cm-variable)" },
  { tag: [t.url, t.link], color: "var(--cm-iri)" },
  { tag: [t.namespace, t.typeName, t.className, t.labelName], color: "var(--cm-prefix)" },
  { tag: [t.propertyName, t.attributeName], color: "var(--cm-property)" },
  { tag: [t.tagName, t.angleBracket], color: "var(--cm-tag)" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "var(--muted)" },
  { tag: t.invalid, color: "var(--fail-text)" },
]);

// Ctrl+Enter (Mod-Enter) validates in the demo: the editors leave it alone.
const keys = [
  ...closeBracketsKeymap,
  ...defaultKeymap.filter((binding) => binding.key !== "Mod-Enter"),
  ...searchKeymap,
  ...historyKeymap,
  indentWithTab,
];

// What every editor of the demo has, whatever its language.
export function editorSetup() {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    EditorState.tabSize.of(2),
    indentUnit.of("  "),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    EditorView.lineWrapping,
    syntaxHighlighting(highlighting),
    theme,
    keymap.of(keys),
  ];
}

// The textarea of an editor: written when the text changes, and shown again
// when the editor is removed.
function textareaSync(textarea) {
  return [
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      textarea.value = update.state.doc.toString();
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }),
    ViewPlugin.define(() => ({
      destroy() {
        textarea.hidden = false;
      },
    })),
  ];
}

// The text of the label of an element, if it has one.
function labelOf(element) {
  return element.labels?.[0]?.textContent.trim() ?? element.getAttribute("aria-label");
}

export function createEditor(textarea, { extensions = [] } = {}) {
  const label = labelOf(textarea);
  const view = new EditorView({
    state: EditorState.create({
      doc: textarea.value,
      extensions: [
        editorSetup(),
        textareaSync(textarea),
        label ? EditorView.contentAttributes.of({ "aria-label": label }) : [],
        extensions,
      ],
    }),
  });
  view.dom.dataset.editorFor = textarea.id;
  // The height of the textarea (classes short and medium)
  view.dom.classList.add(...textarea.classList);
  textarea.after(view.dom);
  textarea.hidden = true;
  return view;
}
