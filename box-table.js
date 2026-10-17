// The tables that rudof writes as text, with box-drawing characters (such as
// the compact results of SHACL), read back as a header and rows of cells:
//
//   ╭──────────┬────────╮
//   │ Severity │ Node   │
//   ├──────────┼────────┤
//   │ Conforms │ :alice │
//   ╰──────────┴────────╯
//
// A cell can go on over several lines: a line that ends where the column ends
// was cut in a word, and goes on without a space; others with a space.

const BORDER = /^\s*[╭├╰┌└+]/;
const ROW = /^\s*│/;

export function parseBoxTable(text) {
  const lines = text.split("\n");
  const top = lines.find((line) => /^\s*[╭┌]/.test(line));
  if (!top) return undefined;
  // The width of the text of each column: its border, without the spaces
  // around the text
  const widths = top.trim().slice(1, -1).split(/[┬+]/).map((segment) => segment.length - 2);
  const rows = [];
  let current;
  for (const line of lines) {
    if (BORDER.test(line)) {
      if (current) rows.push(current);
      current = undefined;
    } else if (ROW.test(line)) {
      const cells = line.trim().slice(1, -1).split("│");
      current ??= cells.map(() => "");
      cells.forEach((cell, i) => {
        const part = cell.replace(/^ /, "").replace(/\s+$/, "");
        if (!part) return;
        if (!current[i]) current[i] = part;
        else current[i] += (current.lastLength?.[i] >= widths[i] ? "" : " ") + part;
        current.lastLength ??= [];
        current.lastLength[i] = part.length;
      });
    }
  }
  if (current) rows.push(current);
  const clean = rows.map((row) => row.map((cell) => cell.trim()));
  if (!clean.length) return undefined;
  const [header, ...body] = clean;
  return { header, rows: body };
}
