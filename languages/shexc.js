// ShExC, the compact syntax of ShEx, and the shape maps that say which nodes
// to validate with which shapes.

import { rdfParser, SHAPE_REF } from "./tokens.js";

const SHEX_KEYWORDS = [
  "PREFIX", "BASE", "IMPORT", "START", "EXTERNAL", "ABSTRACT", "EXTENDS", "RESTRICTS",
  "CLOSED", "EXTRA", "AND", "OR", "NOT",
  "IRI", "LITERAL", "BNODE", "NONLITERAL",
  "LENGTH", "MINLENGTH", "MAXLENGTH", "MININCLUSIVE", "MINEXCLUSIVE", "MAXINCLUSIVE", "MAXEXCLUSIVE",
  "TOTALDIGITS", "FRACTIONDIGITS",
];

// Semantic actions: %name{ code %}
function action(stream, state) {
  if (state.code) {
    if (stream.skipTo("%}")) {
      stream.match("%}");
      state.code = false;
    } else stream.skipToEnd();
    return "meta";
  }
  if (stream.match(/^%(?:<[^>\s]*>|[^\s{%]*)\s*\{/)) {
    state.code = true;
    return "meta";
  }
  return stream.match(/^%(?:<[^>\s]*>|[^\s{%]*)%?/) ? "meta" : undefined;
}

function shexTokens(stream, state) {
  if (state.code || stream.peek() === "%") return action(stream, state);
  if (stream.match(SHAPE_REF)) return "typeName";
  if (stream.match("//")) return "operator"; // annotations
  // Regular expressions, which can't start with / or * (comments)
  if (stream.match(/^\/(?![/*])(?:[^/\\\n]|\\.)+\/[smix]*/)) return "regexp";
  return undefined;
}

export const shexc = rdfParser({
  name: "shexc",
  keywords: SHEX_KEYWORDS,
  exactKeywords: ["a"],
  blockComments: true,
  special: shexTokens,
});

export const shapemap = rdfParser({
  name: "shapemap",
  keywords: ["FOCUS", "START"],
  exactKeywords: ["a", "_"],
  special(stream, state) {
    if (stream.match(/^@START\b/i)) return "typeName";
    return shexTokens(stream, state);
  },
});
