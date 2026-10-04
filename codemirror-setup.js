// CodeMirror 6 editors in place of the input textareas of the demo.
//
// Each editor is put right after its textarea, which is hidden and kept in
// sync: what is typed is written back to the textarea, so the textarea still
// holds the text of the input.

import { EditorState } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

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
        textareaSync(textarea),
        label ? EditorView.contentAttributes.of({ "aria-label": label }) : [],
        extensions,
      ],
    }),
  });
  view.dom.dataset.editorFor = textarea.id;
  textarea.after(view.dom);
  textarea.hidden = true;
  return view;
}
