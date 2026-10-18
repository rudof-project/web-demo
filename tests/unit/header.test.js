// The header of the pages (header.js): its menus, the theme, and the
// versions in About.

import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { setupHeader, storedTheme, applyTheme, THEME_KEY } from "../../header.js";
import { devDependencies } from "../../package.json";

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");

function memoryStorage(items = {}) {
  const map = new Map(Object.entries(items));
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k), map };
}

let doc;
beforeEach(() => {
  doc = new JSDOM(read("index.html")).window.document;
});

const menu = (name) => [...doc.querySelectorAll("header details.menu")].find((d) => d.querySelector("summary").textContent.trim() === name);

describe("the theme", () => {
  it("is the one kept in the browser, or the one of the system", () => {
    expect(storedTheme(memoryStorage({ [THEME_KEY]: "dark" }))).toBe("dark");
    expect(storedTheme(memoryStorage({ [THEME_KEY]: "purple" }))).toBe("system");
    expect(storedTheme(undefined)).toBe("system");
  });

  it("is data-theme of the page, none for the system", () => {
    applyTheme(doc, "dark");
    expect(doc.documentElement.dataset.theme).toBe("dark");
    applyTheme(doc, "system");
    expect(doc.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("is chosen in its menu, and kept", () => {
    const storage = memoryStorage({ [THEME_KEY]: "light" });
    setupHeader(doc, storage);
    expect(doc.querySelector('input[name="theme"][value="light"]').checked).toBe(true);
    expect(doc.documentElement.dataset.theme).toBe("light");
    const dark = doc.querySelector('input[name="theme"][value="dark"]');
    dark.checked = true;
    dark.dispatchEvent(new doc.defaultView.Event("change"));
    expect(doc.documentElement.dataset.theme).toBe("dark");
    expect(storage.map.get(THEME_KEY)).toBe("dark");
    const system = doc.querySelector('input[name="theme"][value="system"]');
    system.checked = true;
    system.dispatchEvent(new doc.defaultView.Event("change"));
    expect(storage.map.has(THEME_KEY)).toBe(false);
  });

  it("has dark colors for data-theme=dark and for the system, the same ones", () => {
    const css = read("demo.css");
    const chosen = css.match(/:root\[data-theme="dark"\] \{([^}]*)\}/)[1];
    const system = css.match(/:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/)[1];
    const vars = (block) => block.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(vars(system)).toEqual(vars(chosen));
  });
});

describe("the menus", () => {
  it("are Examples, Help and About", () => {
    const items = [...doc.querySelectorAll("header .links > a, header .links > details:not(.menu-icon) > summary")].map((e) => e.textContent.trim());
    expect(items).toEqual(["Examples", "Help", "About"]);
  });

  it("Examples has the tutorial of ISWC 2026", () => {
    const link = [...menu("Examples").querySelectorAll("a")].find((a) => a.textContent.startsWith("ISWC 2026 tutorial"));
    const url = new URL(link.getAttribute("href"), "https://rudof-project.github.io/web-demo/");
    expect(url.pathname).toBe("/web-demo/");
    expect(url.searchParams.get("manifestURL")).toBe("https://raw.githubusercontent.com/validatingrdf/Tutorial/refs/heads/master/ISWC_2026/manifest.yml");
  });

  it("About has the manual, the projects on GitHub and the versions", () => {
    setupHeader(doc, memoryStorage());
    const hrefs = [...menu("About").querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["../index.html", "https://github.com/rudof-project/rudof", "https://github.com/rudof-project/web-demo"]));
    expect(doc.getElementById("about-rudof-version").textContent).toBe(devDependencies["@rudof/rudof"]);
    // The version of the demo is the one of the VERSION file
    expect(doc.getElementById("about-demo-version").textContent).toBe(read("VERSION").trim());
    expect(read("VERSION").trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("are open one at a time, and close with a click out of them", () => {
    setupHeader(doc, memoryStorage());
    const examples = menu("Examples");
    const about = menu("About");
    examples.open = true;
    examples.dispatchEvent(new doc.defaultView.Event("toggle"));
    about.open = true;
    about.dispatchEvent(new doc.defaultView.Event("toggle"));
    expect([examples.open, about.open]).toEqual([false, true]);
    doc.querySelector("main").dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles: true }));
    expect(about.open).toBe(false);
  });
});
