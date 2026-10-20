// The tables that rudof writes as text, with box-drawing characters (such as
// the compact results of SHACL), read back as a header and rows of cells:
//
//   ╭──────────┬────────╮
//   │ Severity │ Node   │
//   ├──────────┼────────┤
//   │ Conforms │ :alice │
//   ╰──────────┴────────╯
//
// A cell can go on over several lines, for two reasons:
// - The text of the cell has several lines (the details of ShEx and SHACL,
//   such as "OR passed" and "└── Reference to …"). The lines are kept.
// - The text is longer than WRAP_WIDTH: rudof cuts it at exactly that width,
//   also in a word or after a space, and goes on in the next line. These
//   lines are joined again, as they were.
// So, in a column of WRAP_WIDTH, a line that fills the column (or all of it
// but a space, where the cut was after a space) goes on in the next line;
// other lines end with a new line.

const BORDER = /^\s*[╭├╰┌└+]/;
const ROW = /^\s*│/;

// The width at which rudof cuts the text of the cells
export const WRAP_WIDTH = 80;

export function parseBoxTable(text) {
  const lines = text.split("\n");
  const top = lines.find((line) => /^\s*[╭┌]/.test(line));
  if (!top) return undefined;
  // The width of the text of each column: its border, without the spaces
  // around the text
  const widths = top.trim().slice(1, -1).split(/[┬+]/).map((segment) => segment.length - 2);
  const rows = [];
  // The cells of the row being read, and whether the last line of each cell
  // was cut by rudof (with the spaces at its end, which are text)
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
