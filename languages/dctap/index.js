// DCTAP profiles in CSV (https://www.dublincore.org/specifications/dctap/):
// a stream parser that highlights each cell by its column, as the first line
// (the header) names it. Shape ids and value shapes are types, property ids
// are properties, mandatory and repeatable are booleans, node types are
// keywords, labels and constraints are strings, and notes are comments.
// (https://codemirror.net/docs/ref/#language.StreamParser)

import { COLUMNS } from "../../dctap.js";

const SEPARATOR = /^[,\t]/;

// The header is in the style of keywords
function cellStyle(state) {
  if (state.line === 0) return "keyword";
  const column = state.header[state.column];
  return COLUMNS[column] ?? null;
}

// The style of the next token
function token(stream, state) {
  if (stream.sol() && !state.quoted) {
    state.line += 1;
    state.column = 0;
  }
  // A quoted cell, which can go on over lines; "" is a quote
  if (state.quoted) {
    while (!stream.eol()) {
      if (stream.match('""')) continue;
      if (stream.next() === '"') {
        state.quoted = false;
        break;
      }
    }
    return cellStyle(state) ?? "string";
  }
  if (stream.match(SEPARATOR)) {
    state.column += 1;
    return "punctuation";
  }
  if (stream.peek() === '"') {
    stream.next();
    state.quoted = true;
    return token(stream, state);
  }
  const cell = stream.match(/^[^,\t"]+/);
  if (!cell) {
    stream.next();
    return null;
  }
  if (state.line === 0) state.header[state.column] = cell[0].trim().toLowerCase();
  return cellStyle(state);
}

export const dctap = {
  name: "dctap",
  startState: () => ({ line: -1, column: 0, header: [], quoted: false }),
  token,
  languageData: { closeBrackets: { brackets: ['"'] } },
};
