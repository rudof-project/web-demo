// Turtle, and the syntaxes built on it or contained in it: TriG (graphs),
// N3 (variables, formulae and rules), N-Triples and N-Quads.

import { rdfParser } from "./tokens.js";

export const turtle = rdfParser({
  name: "turtle",
  keywords: ["PREFIX", "BASE", "GRAPH"],
  // and the words of N3
  exactKeywords: ["a", "is", "of", "has"],
  special(stream) {
    // N3 variables
    if (stream.match(/^\?[\w\u00C0-\uFFFF]+/)) return "variableName";
    if (stream.match(/^(=>|<=)/)) return "operator";
    return undefined;
  },
});
