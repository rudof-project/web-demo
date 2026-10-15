// The layout of the boxes of the demo (the input editors and the results):
//
// - The two boxes of a row (.inputs.two) are side by side or one above the
//   other, in their order or swapped. The layout menu chooses it for all the
//   tabs, and the browser remembers it.
// - Side by side, the splitter between the boxes changes their widths: drag
//   it, or focus it and use the arrow keys. A double click shares the width
//   equally again.
// - Each box has a Full screen button, which shows it on the whole window of
//   the browser, and back. Esc also gives the normal size back.
//
// The heights of the editors and of the results change with the handle at
// their bottom right corner (CSS resize).

export const LAYOUTS = {
  side: "Side by side",
  "side-swapped": "Side by side, swapped",
  stacked: "One above the other",
  "stacked-swapped": "One above the other, swapped",
};
export const DEFAULT_LAYOUT = "side";

const LAYOUT_KEY = "rudof-demo-layout";
const SPLIT_KEY = "rudof-demo-split-";

// The browser storage may be missing or refuse access (private windows):
// then nothing is remembered.
function stored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not remembered
  }
}

// ---------------------------------------------------------------------------
// Layouts

export function setLayout(root, layout) {
  if (!(layout in LAYOUTS)) layout = DEFAULT_LAYOUT;
  root.dataset.layout = layout;
  return layout;
}

function setupLayoutSelect(doc) {
  const select = doc.getElementById("layout");
  const layout = setLayout(doc.body, stored(LAYOUT_KEY));
  if (!select) return;
  if (select.options.length === 0) {
    select.append(...Object.entries(LAYOUTS).map(([value, text]) => new Option(text, value)));
  }
  select.value = layout;
  select.addEventListener("change", () => store(LAYOUT_KEY, setLayout(doc.body, select.value)));
}

// ---------------------------------------------------------------------------
// Splitters

const MIN_SPLIT = 15;
const MAX_SPLIT = 85;
const STEP = 5;

// The width of the first column shown, in percent of the two columns.
export function setSplit(grid, percent) {
  const split = Math.round(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, percent)));
  grid.style.setProperty("--left", `${split}fr`);
  grid.style.setProperty("--right", `${100 - split}fr`);
  const splitter = grid.querySelector(":scope > .splitter");
  splitter?.setAttribute("aria-valuenow", String(split));
  return split;
}

export function splitOf(grid) {
  return Number(grid.querySelector(":scope > .splitter")?.getAttribute("aria-valuenow") ?? 50);
}

export function addSplitter(grid, key) {
  const existing = grid.querySelector(":scope > .splitter");
  if (existing) return existing;
  const [first] = grid.children;
  const splitter = Object.assign(grid.ownerDocument.createElement("div"), {
    className: "splitter",
    tabIndex: 0,
    title: "Drag to change the widths (double click: equal widths)",
  });
  splitter.setAttribute("role", "separator");
  splitter.setAttribute("aria-orientation", "vertical");
  splitter.setAttribute("aria-label", "Widths of the two boxes");
  splitter.setAttribute("aria-valuemin", String(MIN_SPLIT));
  splitter.setAttribute("aria-valuemax", String(MAX_SPLIT));
  first.after(splitter);
  const save = (split) => key && store(SPLIT_KEY + key, String(split));
  setSplit(grid, Number(key && stored(SPLIT_KEY + key)) || 50);

  splitter.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    splitter.setPointerCapture?.(e.pointerId);
    splitter.classList.add("dragging");
    const move = (event) => {
      const rect = grid.getBoundingClientRect();
      if (rect.width > 0) setSplit(grid, ((event.clientX - rect.left) / rect.width) * 100);
    };
    const end = () => {
      splitter.classList.remove("dragging");
      splitter.removeEventListener("pointermove", move);
      save(splitOf(grid));
    };
    splitter.addEventListener("pointermove", move);
    splitter.addEventListener("pointerup", end, { once: true });
    splitter.addEventListener("pointercancel", end, { once: true });
  });
  splitter.addEventListener("dblclick", () => save(setSplit(grid, 50)));
  splitter.addEventListener("keydown", (e) => {
    const split = splitOf(grid);
    const next = { ArrowLeft: split - STEP, ArrowRight: split + STEP, Home: MIN_SPLIT, End: MAX_SPLIT }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    save(setSplit(grid, next));
  });
  return splitter;
}

// ---------------------------------------------------------------------------
// Full screen

const EXPAND = "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5";
const COLLAPSE = "M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5";

function icon(doc, path) {
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const p = doc.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", path);
  svg.append(p);
  return svg;
}

function showButtonState(button, on) {
  const text = on ? "Exit full screen (Esc)" : "Full screen";
  button.setAttribute("aria-pressed", String(on));
  button.setAttribute("aria-label", text);
  button.title = text;
  button.replaceChildren(icon(button.ownerDocument, on ? COLLAPSE : EXPAND));
}

// The box shown on the whole window, if any.
export function maximizedBox(doc = document) {
  return doc.querySelector(".maximized");
}

export function setMaximized(box, on) {
  const doc = box.ownerDocument;
  const current = maximizedBox(doc);
  if (on && current && current !== box) setMaximized(current, false);
  box.classList.toggle("maximized", on);
  doc.body.classList.toggle("has-maximized", on);
  const button = box.querySelector(":scope > .field-head > .maximize, :scope > .result-head > .maximize");
  if (button) showButtonState(button, on);
  // The editor of the box gets the keyboard
  if (on) (box.querySelector(".cm-content") ?? button)?.focus();
  else button?.focus();
}

export function addMaximizeButton(box, head) {
  const existing = head.querySelector(":scope > .maximize");
  if (existing) return existing;
  const button = Object.assign(box.ownerDocument.createElement("button"), { type: "button", className: "icon maximize" });
  showButtonState(button, false);
  button.addEventListener("click", () => setMaximized(box, !box.classList.contains("maximized")));
  head.append(button);
  return button;
}

// ---------------------------------------------------------------------------

// The documents that listen to Esc
const listening = new WeakSet();

export function setupLayout(doc = document) {
  setupLayoutSelect(doc);
  for (const grid of doc.querySelectorAll(".inputs.two")) {
    if (grid.children.length === 2) addSplitter(grid, grid.closest("[id^=panel-]")?.id);
  }
  for (const field of doc.querySelectorAll(".field")) {
    const head = field.querySelector(":scope > .field-head");
    if (head) addMaximizeButton(field, head);
  }
  // The results that are not in a field of their own
  for (const result of doc.querySelectorAll(".result")) {
    if (result.closest(".field")) continue;
    const head = result.querySelector(":scope > .result-head");
    if (head) addMaximizeButton(result, head);
  }
  if (!listening.has(doc)) {
    listening.add(doc);
    doc.addEventListener("keydown", (e) => {
      const box = maximizedBox(doc);
      // Esc that the editor did not use (to close its search panel)
      if (e.key === "Escape" && box && !e.defaultPrevented) setMaximized(box, false);
    });
  }
}
