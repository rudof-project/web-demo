// Step 2: the CodeMirror 6 packages are installed as dependencies of the page.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

// Each package and some of what the editors use from it.
const PACKAGES = {
  "@codemirror/state": ["EditorState", "Compartment"],
  "@codemirror/view": ["EditorView", "keymap", "lineNumbers", "drawSelection"],
  "@codemirror/commands": ["defaultKeymap", "history", "historyKeymap", "indentWithTab"],
  "@codemirror/language": ["StreamLanguage", "syntaxHighlighting", "HighlightStyle", "bracketMatching", "LanguageSupport"],
  "@codemirror/search": ["search", "searchKeymap", "highlightSelectionMatches"],
  "@codemirror/autocomplete": ["closeBrackets", "closeBracketsKeymap"],
  "@codemirror/lang-xml": ["xml"],
  "@codemirror/lang-json": ["json"],
  "@codemirror/legacy-modes/mode/sparql": ["sparql"],
  "@lezer/highlight": ["tags"],
};

const packageName = (module) => module.split("/").slice(0, 2).join("/");

describe("CodeMirror 6 packages", () => {
  it.each(Object.keys(PACKAGES).map(packageName).filter((p, i, a) => a.indexOf(p) === i))(
    "%s is a runtime dependency",
    (name) => {
      expect(pkg.dependencies?.[name], `${name} is not in dependencies`).toBeDefined();
    },
  );

  it.each(Object.entries(PACKAGES))("%s exports what the editors use", async (module, names) => {
    const exports = await import(module);
    for (const name of names) expect(exports[name], `${module} has no ${name}`).toBeDefined();
  });

  it("has a single copy of @codemirror/state and @codemirror/view", () => {
    // Two copies break CodeMirror: extensions of one are not recognized by the other.
    for (const name of ["@codemirror/state", "@codemirror/view"]) {
      const tree = JSON.parse(execFileSync("npm", ["ls", name, "--all", "--json"], { encoding: "utf8" }));
      const versions = new Set();
      const walk = (deps = {}) => {
        for (const [dep, info] of Object.entries(deps)) {
          if (dep === name) versions.add(info.version);
          walk(info.dependencies);
        }
      };
      walk(tree.dependencies);
      expect([...versions], name).toHaveLength(1);
    }
  });
});
