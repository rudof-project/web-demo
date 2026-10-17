// Completion of prefixes in the editors of Turtle, TriG, N3, ShExC and
// SPARQL (CodeMirror autocompletion):
//
// - after PREFIX (or @prefix), the declarations of the prefixes known: the
//   alias and its IRI (`wd: <http://www.wikidata.org/entity/>`);
// - in the text, the aliases known (`wd:`): choosing one that the text
//   doesn't declare also adds its declaration with the others.
//
// The prefixes known in an editor are those of its text, of the endpoint of
// its tab, and common ones: the page says them (setPrefixSource).

import { autocompletion } from "@codemirror/autocomplete";
import { COMMON_PREFIXES, declaredPrefixes, declaration, declarationPosition } from "./prefixes.js";

// The formats whose editors complete prefixes; Turtle-like ones write
// @prefix … . when the text does
const FORMATS = new Set(["turtle", "trig", "n3", "shexc", "sparql"]);
const TURTLE = new Set(["turtle", "trig", "n3"]);

// The prefixes of an editor besides those of its text: [alias, iri, where]
let prefixSource = () => COMMON_PREFIXES.map(([alias, iri]) => [alias, iri, "common"]);

export function setPrefixSource(source) {
  prefixSource = source;
}

// The prefixes known in an editor: those of its text first, then the others
// by alias, without repeating an alias
export function knownPrefixes(view, text) {
  const seen = new Set();
  const all = [];
  for (const [alias, iri, where] of [...declaredPrefixes(text).map(([a, i]) => [a, i, "declared"]), ...prefixSource(view)]) {
    if (seen.has(alias)) continue;
    seen.add(alias);
    all.push({ alias, iri, where });
  }
  return all;
}

const formatOf = (view) => view.dom.dataset.format;

function inIriOrString(line) {
  // An open <…> or an odd number of quotes before the cursor
  return /<[^>\s]*$/.test(line) || (line.match(/"/g) ?? []).length % 2 === 1;
}

export function prefixCompletions(context) {
  const view = context.view;
  if (!view || !FORMATS.has(formatOf(view))) return null;
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const text = context.state.doc.toString();
  const known = knownPrefixes(view, text);
  const turtle = TURTLE.has(formatOf(view));

  // A declaration: PREFIX al|
  const declaring = before.match(/^(\s*)(@?prefix)\s+([A-Za-z][\w.-]*)?$/i);
  if (declaring) {
    const declared = new Set(declaredPrefixes(text).map(([alias]) => alias));
    const atPrefix = declaring[2].startsWith("@");
    return {
      from: context.pos - (declaring[3]?.length ?? 0),
      options: known
        .filter(({ alias, where }) => where !== "declared" && !declared.has(alias))
        .map(({ alias, iri, where }) => ({
          label: `${alias}:`,
          detail: iri,
          info: where === "endpoint" ? "a prefix of the endpoint" : undefined,
          apply: `${alias}: <${iri}>${atPrefix ? " ." : ""}`,
          type: "namespace",
          boost: where === "endpoint" ? 1 : 0,
        })),
      validFor: /^[\w.-]*$/,
    };
  }
  if (/^\s*@?(prefix|base)\b/i.test(before) || inIriOrString(before)) return null;

  // An alias in the text: wd|
  const word = context.matchBefore(/[A-Za-z][\w.-]*$/);
  if (!word && !context.explicit) return null;
  if (word && /[:?$_]$/.test(before.slice(0, word.from - line.from))) return null; // a local name or a variable
  const declared = new Set(declaredPrefixes(text).map(([alias]) => alias));
  return {
    from: word?.from ?? context.pos,
    options: known.map(({ alias, iri, where }) => ({
      label: `${alias}:`,
      detail: iri,
      info: declared.has(alias) ? undefined : `Adds the declaration of ${alias}:`,
      type: "namespace",
      boost: where === "declared" ? 2 : where === "endpoint" ? 1 : 0,
      apply: (view, completion, from, to) => {
        const changes = [{ from, to, insert: `${alias}:` }];
        let shift = 0;
        if (!declared.has(alias)) {
          const { at, newlineBefore } = declarationPosition(view.state.doc.toString());
          const insert = `${newlineBefore ? "\n" : ""}${declaration(view.state.doc.toString(), alias, iri, { turtle })}${newlineBefore ? "" : "\n"}`;
          changes.push({ from: at, insert });
          if (at <= from) shift = insert.length;
        }
        view.dispatch({ changes, selection: { anchor: from + shift + alias.length + 1 }, userEvent: "input.complete" });
      },
    })),
    validFor: /^[\w.-]*$/,
  };
}

export function prefixCompletion() {
  return autocompletion({ override: [prefixCompletions], icons: false });
}
