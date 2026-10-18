// The header of the pages (index.html and help.html): the menus Examples and
// About (<details>, which open without JavaScript too), and the theme of the
// page: light, dark, or the one of the system.
//
// An inline script in the <head> of the pages applies the theme kept in the
// browser before the page is drawn; this module changes it.

import { devDependencies } from "./package.json";

export const THEME_KEY = "rudof-demo-theme";
export const THEMES = ["system", "light", "dark"];

// The theme kept in the browser: system when there is none
export function storedTheme(storage) {
  try {
    const theme = storage?.getItem(THEME_KEY);
    return THEMES.includes(theme) ? theme : "system";
  } catch {
    return "system";
  }
}

// Applies a theme to the page (data-theme of <html>; none for the system)
export function applyTheme(doc, theme) {
  if (theme === "light" || theme === "dark") doc.documentElement.dataset.theme = theme;
  else delete doc.documentElement.dataset.theme;
}

function keepTheme(storage, theme) {
  try {
    if (theme === "system") storage?.removeItem(THEME_KEY);
    else storage?.setItem(THEME_KEY, theme);
  } catch {
    // not kept
  }
}

// The commit of the demo, given by the build (vite.config.js)
// eslint-disable-next-line no-undef
const COMMIT = typeof __DEMO_COMMIT__ === "string" ? __DEMO_COMMIT__ : "";

export function setupHeader(doc = document, storage = safeStorage()) {
  const menus = [...doc.querySelectorAll("header details.menu")];

  // One menu open at a time; a click out of it or Escape closes it
  for (const menu of menus) {
    menu.addEventListener("toggle", () => {
      if (menu.open) for (const other of menus) if (other !== menu) other.open = false;
    });
  }
  doc.addEventListener("click", (e) => {
    for (const menu of menus) if (menu.open && !menu.contains(e.target)) menu.open = false;
  });
  doc.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    for (const menu of menus) {
      if (!menu.open) continue;
      menu.open = false;
      menu.querySelector("summary").focus();
    }
  });

  // The theme: the radio buttons of its menu
  const theme = storedTheme(storage);
  applyTheme(doc, theme);
  for (const radio of doc.querySelectorAll('input[name="theme"]')) {
    radio.checked = radio.value === theme;
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      applyTheme(doc, radio.value);
      keepTheme(storage, radio.value);
    });
  }

  // The versions, in About: rudof (demo.js says the one it loads) and the demo
  const rudof = doc.getElementById("about-rudof-version");
  if (rudof && !rudof.textContent.trim()) rudof.textContent = devDependencies["@rudof/rudof"];
  const demo = doc.getElementById("about-demo-version");
  if (demo && COMMIT) {
    const link = Object.assign(doc.createElement("a"), {
      href: `https://github.com/rudof-project/web-demo/commit/${COMMIT}`,
      textContent: COMMIT,
    });
    demo.replaceChildren("commit ", link);
  }
}

function safeStorage() {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

if (typeof document !== "undefined" && document.querySelector("header.topbar")) setupHeader();
