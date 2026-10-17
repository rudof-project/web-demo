// Tables of results that can be sorted by clicking a header: the first click
// sorts by that column in ascending order, the next one in descending order,
// and the next one shows the rows in their order again. Numbers are compared
// as numbers, and text in the order of the language, with the digits in
// text compared as numbers (n2 before n10). Empty cells go last.

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

// The value a cell is sorted by: its data-sort, or its text
const sortValue = (cell) => (cell?.dataset.sort ?? cell?.textContent ?? "").trim();

export function compareValues(a, b) {
  if (a === "" || b === "") return (a === "") - (b === "");
  if (NUMBER.test(a) && NUMBER.test(b)) return Number(a) - Number(b);
  return collator.compare(a, b);
}

const NEXT = { none: "ascending", ascending: "descending", descending: "none" };

export function makeSortable(table) {
  const headers = [...(table.tHead?.rows[0]?.cells ?? [])];
  const body = table.tBodies[0];
  if (!headers.length || !body) return table;
  const rows = [...body.rows];
  const sortBy = (column, order) => {
    headers.forEach((th, i) => th.setAttribute("aria-sort", i === column ? order : "none"));
    const sign = order === "descending" ? -1 : 1;
    const sorted =
      order === "none"
        ? rows
        : rows
            .map((row, i) => ({ row, i, value: sortValue(row.cells[column]) }))
            .sort((a, b) => {
              // Empty cells last, in both orders
              if ((a.value === "") !== (b.value === "")) return a.value === "" ? 1 : -1;
              return sign * compareValues(a.value, b.value) || a.i - b.i;
            })
            .map(({ row }) => row);
    body.append(...sorted);
  };
  headers.forEach((th, column) => {
    th.classList.add("sortable");
    th.tabIndex = 0;
    th.setAttribute("aria-sort", "none");
    th.title = "Sort by this column";
    const next = () => sortBy(column, NEXT[th.getAttribute("aria-sort")] ?? "ascending");
    th.addEventListener("click", next);
    th.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        next();
      }
    });
  });
  return table;
}
