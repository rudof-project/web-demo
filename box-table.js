// This file reads the tables that rudof writes as text with box-drawing
// characters, for example the compact results of SHACL. It gives a header and
// rows of cells:
//
//   ╭──────────┬────────╮
//   │ Severity │ Node   │
//   ├──────────┼────────┤
//   │ Conforms │ :alice │
//   ╰──────────┴────────╯
//
// A cell can have more than one line, for two reasons:
// - The text of the cell has more than one line, for example the details of
//   ShEx and SHACL ("OR passed" and "└── Reference to …"). The parser keeps
//   these lines.
// - The text is longer than WRAP_WIDTH. rudof cuts the text at exactly that
//   width, also in a word or after a space, and continues on the next line.
//   The parser joins these lines again.
// Thus, in a column of WRAP_WIDTH, a line that fills the column continues on
// the next line. This is also true for a line that fills all of the column but
// one space (a cut after a space). Other lines end with a new line.

const BORDER = /^\s*[╭├╰┌└+]/;
const ROW = /^\s*│/;

// The width at which rudof cuts the text of the cells
export const WRAP_WIDTH = 80;

export function parseBoxTable(text) {
  const all = text.split("\n");
  const start = all.findIndex((line) => /^\s*[╭┌]/.test(line));
  if (start < 0) return undefined;
  const top = all[start];
  // Only the lines of the table: the text after it (such as the details of
  // ShEx) has lines that start like those of a table
  const bottom = all.findIndex((line, i) => i > start && /^\s*[╰└]/.test(line));
  const lines = all.slice(start, bottom < 0 ? undefined : bottom + 1);
  // The width of the text of each column: its border, without the spaces
  // around the text
  const widths = top.trim().slice(1, -1).split(/[┬+]/).map((segment) => segment.length - 2);
  const rows = [];
  // The cells of the current row. For each cell, `cut` keeps the spaces at the
  // end of its last line when rudof cut that line (these spaces are text).
  let current;
  let cut = [];
  for (const line of lines) {
    if (BORDER.test(line)) {
      if (current) rows.push(current);
      current = undefined;
      cut = [];
    } else if (ROW.test(line)) {
      const cells = line.trim().slice(1, -1).split("│");
      current ??= cells.map(() => undefined);
      cells.forEach((cell, i) => {
        // The text of the line, without the space before it
        const raw = cell.slice(1, 1 + widths[i]);
        const part = raw.trimEnd();
        if (current[i] === undefined) current[i] = part;
        else if (cut[i] !== undefined) current[i] += cut[i] + part;
        else current[i] += `\n${part}`;
        cut[i] = widths[i] >= WRAP_WIDTH && part.length >= widths[i] - 1 ? raw.slice(part.length) : undefined;
      });
    }
  }
  if (current) rows.push(current);
  // Without the empty lines at the start and the end of the cells
  const clean = rows.map((row) => row.map((cell) => (cell ?? "").replace(/^\n+|\s+$/g, "")));
  if (!clean.length) return undefined;
  const [header, ...body] = clean;
  return { header, rows: body };
}

// rudof 0.3.40 and later cut the Summary column of the table of ShEx results.
// After the table, rudof writes the full details of each association that
// fails. The first line has the node, the shape and the status. The lines of
// the details follow, with an indent of two spaces:
//
//   :bob@:P FAIL
//     :bob does not conform to :P
//     └── property :name: …
//
// A map from "node@shape" to the text of its details, without the indent.
export function parseShexDetails(text) {
  const details = new Map();
  const lines = text.split("\n");
  const end = lines.findIndex((line) => /^\s*╰/.test(line));
  if (end < 0) return new Map();
  let key;
  for (const line of lines.slice(end + 1)) {
    const head = /^(\S.*) (\S+)$/.exec(line);
    if (head) {
      key = head[1];
      details.set(key, []);
    } else if (key && line.startsWith("  ")) details.get(key).push(line.slice(2));
    else if (!line.trim()) key = undefined;
  }
  return new Map([...details].map(([k, v]) => [k, v.join("\n")]));
}
