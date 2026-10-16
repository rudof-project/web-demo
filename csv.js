// CSV (RFC 4180, https://www.rfc-editor.org/rfc/rfc4180): rows of cells,
// separated by commas. A cell in quotes can have commas, line breaks, and
// quotes written twice ("").

// The rows of a CSV text, as arrays of cells. A last line break does not make
// an empty row.
export function parseCsv(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  let i = 0;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (c === '"') quoted = false;
      else cell += c;
      i += 1;
      continue;
    }
    if (c === '"' && cell === "") quoted = true;
    else if (c === delimiter) endCell();
    else if (c === "\n" || c === "\r") {
      endRow();
      if (c === "\r" && text[i + 1] === "\n") i += 1;
    } else cell += c;
    i += 1;
  }
  if (cell !== "" || row.length || quoted) endRow();
  return rows;
}

// A cell, in quotes if it needs them.
function csvCell(value, delimiter) {
  return value.includes(delimiter) || /["\r\n]/.test(value) || /^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// The CSV text of rows of cells.
export function serializeCsv(rows, delimiter = ",") {
  return rows.map((row) => row.map((cell) => csvCell(cell, delimiter)).join(delimiter)).join("\n");
}
