// Step 5: the page is built with Vite into a folder that can be published as is.

import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "vite";

let outDir;
let html;
const assets = () => readdirSync(join(outDir, "assets"));
const js = () => assets().filter((f) => f.endsWith(".js"));
const read = (file) => readFileSync(join(outDir, "assets", file), "utf8");

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "rudof-demo-build-"));
  await build({ logLevel: "silent", build: { outDir, emptyOutDir: true } });
  html = readFileSync(join(outDir, "index.html"), "utf8");
}, 60_000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe("vite build", () => {
  it("writes index.html", () => {
    expect(html).toContain("<title>rudof online demo</title>");
  });

  it("bundles the scripts, with no bare imports left", () => {
    expect(js().length).toBeGreaterThan(0);
    for (const file of js()) expect(read(file)).not.toMatch(/from\s*["']@codemirror\//);
  });

  it("includes CodeMirror", () => {
    expect(js().some((file) => read(file).includes("cm-editor"))).toBe(true);
  });

  it("puts the languages in their own files, loaded when needed", () => {
    // The files loaded with the page: its script and the ones it preloads
    const eager = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
    const lazy = js().filter((file) => !eager.includes(file));
    expect(eager.length).toBeGreaterThan(0);
    // XML (Lezer) and the legacy SPARQL mode are not loaded with the page…
    expect(eager.some((file) => read(file).includes("MismatchedCloseTag"))).toBe(false);
    expect(eager.some((file) => /isblank/i.test(read(file)))).toBe(false);
    // …but when they are imported
    expect(lazy.some((file) => read(file).includes("MismatchedCloseTag"))).toBe(true);
    expect(lazy.some((file) => /isblank/i.test(read(file)))).toBe(true);
  });

  it("loads the YAML parser of manifests only when the page has a manifest", () => {
    const eager = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
    const yaml = (file) => read(file).includes("YAMLParseError");
    expect(eager.some(yaml)).toBe(false);
    expect(js().some(yaml)).toBe(true);
  });

  it("uses relative paths, so the page works in any folder", () => {
    expect(html).not.toMatch(/(src|href)="\/(?!\/)/);
  });

  it("keeps loading rudof and PlantUML from jsDelivr", () => {
    const code = js().map(read).join("\n");
    expect(code).toContain("https://cdn.jsdelivr.net/npm/@rudof/rudof@");
    expect(code).toContain("https://cdn.jsdelivr.net/npm/@plantuml/core@");
  });

  it("copies the stylesheet and the logo", () => {
    expect(assets().some((f) => f.endsWith(".css"))).toBe(true);
    expect(assets().some((f) => f.endsWith(".svg")) || existsSync(join(outDir, "images", "logo.svg"))).toBe(true);
  });
});
