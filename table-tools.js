// Tables of results that can be sorted and filtered by their columns, as in
// a spreadsheet.
//
// Sorting: a click on the name of a column sorts the rows by it, in
// ascending order, then in descending order, then in their order again.
// Numbers are compared as numbers, and text in the order of the language,
// with the digits in text compared as numbers (n2 before n10). Empty cells go
// last.
//
// Filtering: the button next to the name of a column opens a menu with the
// values of the column (in the rows that the filters of the other columns
// show), to choose the ones to show, a search box, and the sort orders. The
// filters of all the columns apply together, and a line under the table says
// how many rows it shows.

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

// The value a cell is sorted and filtered by: its data-sort, or its text
const cellValue = (cell) => (cell?.dataset.sort ?? cell?.textContent ?? "").trim();

export function compareValues(a, b) {
  if (a === "" || b === "") return (a === "") - (b === "");
  if (NUMBER.test(a) && NUMBER.test(b)) return Number(a) - Number(b);
  return collator.compare(a, b);
}

const NEXT = { none: "ascending", ascending: "descending", descending: "none" };
const EMPTY = "(Empty)";

function el(doc, tag, props = {}, ...children) {
  const e = Object.assign(doc.createElement(tag), props);
  e.append(...children);
  return e;
}

export function makeTableTools(table) {
  const doc = table.ownerDocument;
  const headers = [...(table.tHead?.rows[0]?.cells ?? [])];
  const body = table.tBodies[0];
  if (!headers.length || !body) return table;
  const rows = [...body.rows];
  const values = rows.map((row) => headers.map((_, i) => cellValue(row.cells[i])));
  const rowIndex = new Map(rows.map((row, i) => [row, i]));
  // The values each column shows (a Set), or undefined when it shows all
  const filters = headers.map(() => undefined);
  let menu;

  const status = el(doc, "caption", { className: "table-status" });
  status.hidden = true;
  table.append(status);

  const passes = (i, except = -1) => filters.every((filter, c) => c === except || !filter || filter.has(values[i][c]));

  function applyFilters() {
    let shown = 0;
    rows.forEach((row, i) => {
      row.hidden = !passes(i);
      if (!row.hidden) shown += 1;
    });
    headers.forEach((th, c) => th.classList.toggle("filtered", Boolean(filters[c])));
    const active = filters.some(Boolean);
    status.hidden = !active;
    status.textContent = active ? `Showing ${shown} of ${rows.length} rows` : "";
  }

  function sortBy(column, order) {
    headers.forEach((th, i) => th.setAttribute("aria-sort", i === column ? order : "none"));
    const sign = order === "descending" ? -1 : 1;
    const sorted =
      order === "none"
        ? rows
        : [...rows].sort((a, b) => {
            const va = values[rowIndex.get(a)][column];
            const vb = values[rowIndex.get(b)][column];
            // Empty cells last, in both orders
            if ((va === "") !== (vb === "")) return va === "" ? 1 : -1;
            return sign * compareValues(va, vb) || rowIndex.get(a) - rowIndex.get(b);
          });
    body.append(...sorted);
  }

  function closeMenu() {
    if (!menu) return;
    menu.remove();
    menu.button.setAttribute("aria-expanded", "false");
    menu = undefined;
    doc.removeEventListener("mousedown", outside, true);
    doc.removeEventListener("scroll", onScroll, true);
  }

  // The menu stays under its button when the page or the table scrolls (not
  // its own list), and closes when the button is out of view
  function place() {
    const view = doc.defaultView;
    const rect = menu.button.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > view.innerHeight) return closeMenu();
    // Under the button, or above it when there is no room under it
    const height = menu.offsetHeight;
    const below = rect.bottom + 4 + height <= view.innerHeight - 8 || rect.top < height + 12;
    menu.style.top = `${Math.round(Math.max(8, below ? rect.bottom + 4 : rect.top - height - 4))}px`;
    menu.style.left = `${Math.round(Math.max(8, Math.min(rect.left, view.innerWidth - menu.offsetWidth - 8)))}px`;
  }

  function onScroll(e) {
    if (menu && !menu.contains(e.target)) place();
  }

  function outside(e) {
    if (menu && !menu.contains(e.target) && e.target !== menu.button) closeMenu();
  }

  // The menu of the filter of a column
  function openMenu(column, button) {
    const same = menu?.column === column;
    closeMenu();
    if (same) return;
    // The values of the rows that the other filters show, with how many times
    const counts = new Map();
    rows.forEach((_, i) => {
      if (!passes(i, column)) return;
      const v = values[i][column];
      counts.set(v, (counts.get(v) ?? 0) + 1);
    });
    const all = [...counts.keys()].sort(compareValues);
    const chosen = new Set(filters[column] ? all.filter((v) => filters[column].has(v)) : all);

    const search = el(doc, "input", { type: "search", placeholder: "Search", className: "filter-search" });
    search.setAttribute("aria-label", `Search the values of ${headers[column].dataset.label}`);
    const selectAll = el(doc, "input", { type: "checkbox" });
    const list = el(doc, "div", { className: "filter-values" });
    const items = all.map((value) => {
      const box = el(doc, "input", { type: "checkbox", checked: chosen.has(value) });
      box.addEventListener("change", () => {
        if (box.checked) chosen.add(value);
        else chosen.delete(value);
        update();
      });
      const label = el(doc, "label", { className: "filter-value" }, box, el(doc, "span", { className: "filter-text" }, value === "" ? EMPTY : value), el(doc, "span", { className: "filter-count" }, String(counts.get(value))));
      label.title = value === "" ? EMPTY : value;
      return { value, box, label };
    });
    list.append(...items.map((item) => item.label));

    const visible = () => items.filter((item) => !item.label.hidden);
    function syncSelectAll() {
      const shown = visible();
      const on = shown.filter((item) => chosen.has(item.value)).length;
      selectAll.checked = shown.length > 0 && on === shown.length;
      selectAll.indeterminate = on > 0 && on < shown.length;
    }
    // The filter: none when every value is chosen
    function update() {
      filters[column] = chosen.size === all.length ? undefined : new Set(chosen);
      applyFilters();
      syncSelectAll();
    }
    selectAll.addEventListener("change", () => {
      for (const item of visible()) {
        item.box.checked = selectAll.checked;
        if (selectAll.checked) chosen.add(item.value);
        else chosen.delete(item.value);
      }
      update();
    });
    search.addEventListener("input", () => {
      const text = search.value.trim().toLowerCase();
      for (const item of items) item.label.hidden = Boolean(text) && !(item.value || EMPTY).toLowerCase().includes(text);
      syncSelectAll();
    });

    const action = (text, run) => {
      const b = el(doc, "button", { type: "button", className: "link" }, text);
      b.addEventListener("click", () => {
        run();
        closeMenu();
      });
      return b;
    };
    menu = el(
      doc,
      "div",
      { className: "filter-menu" },
      el(doc, "div", { className: "filter-sort" }, action("Sort A → Z", () => sortBy(column, "ascending")), action("Sort Z → A", () => sortBy(column, "descending"))),
      search,
      el(doc, "label", { className: "filter-value filter-all" }, selectAll, el(doc, "span", {}, "(Select all)")),
      list,
      el(
        doc,
        "div",
        { className: "filter-actions" },
        action("Clear filter", () => {
          filters[column] = undefined;
          applyFilters();
        }),
        action("Close", () => {}),
      ),
    );
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", `Filter of ${headers[column].dataset.label}`);
    menu.column = column;
    menu.button = button;
    menu.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeMenu();
        button.focus();
      }
    });
    // On the page, as the table may be in a box that scrolls
    doc.body.append(menu);
    place();
    button.setAttribute("aria-expanded", "true");
    syncSelectAll();
    search.focus();
    doc.addEventListener("mousedown", outside, true);
    doc.addEventListener("scroll", onScroll, true);
  }

  headers.forEach((th, column) => {
    const label = th.textContent.trim();
    th.dataset.label = label;
    th.setAttribute("aria-sort", "none");
    th.classList.add("sortable");
    const name = el(doc, "span", { className: "th-label", tabIndex: 0, title: "Sort by this column" }, ...th.childNodes);
    const next = () => sortBy(column, NEXT[th.getAttribute("aria-sort")] ?? "ascending");
    name.addEventListener("click", next);
    name.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        next();
      }
    });
    const button = el(doc, "button", { type: "button", className: "filter-button", title: `Filter by ${label}` }, "▾");
    button.setAttribute("aria-label", `Filter by ${label}`);
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      openMenu(column, button);
    });
    th.replaceChildren(name, button);
  });
  return table;
}
