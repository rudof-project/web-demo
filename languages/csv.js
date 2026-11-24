// CSV, as the results of validations and queries are written: the header,
// quoted cells, numbers, IRIs and prefixed names, and the commas between the
// cells. (DCTAP profiles, which are CSV too, have their own language, which
// knows their columns: dctap/.)

// Reads the rest of a quoted cell on the current line. In a quoted cell, ""
// is a quote. A quote alone closes the cell (state.quoted becomes false).
export function readQuoted(stream, state) {
  while (!stream.eol()) {
    if (stream.match('""')) continue;
    if (stream.next() === '"') {
      state.quoted = false;
      return;
    }
  }
}

function token(stream, state) {
  if (stream.sol() && !state.quoted) state.line += 1;
  // A quoted cell, which can have more than one line. "" is a quote.
  if (state.quoted) {
    readQuoted(stream, state);
    return state.line === 0 ? "keyword" : "string";
  }
  if (stream.eat(",")) return "punctuation";
  if (stream.eat('"')) {
    state.quoted = true;
    return token(stream, state);
  }
  const cell = stream.match(/^[^,"]+/);
  if (!cell) {
    stream.next();
    return null;
  }
  const value = cell[0].trim();
  if (state.line === 0) return "keyword";
  if (/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) return "number";
  if (/^(true|false)$/i.test(value)) return "bool";
  if (/^(<[^>]*>|https?:\/\/\S+)$/.test(value)) return "url";
  if (/^_:\S+$/.test(value)) return "variableName";
  if (/^[\w-]*:\S+$/.test(value)) return "propertyName";
  return null;
}

export const csv = {
  name: "csv",
  startState: () => ({ line: -1, quoted: false }),
  token,
};
