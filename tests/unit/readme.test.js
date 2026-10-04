// Step 9: the README says how to build, run and test the page, and only
// mentions commands that exist.

import { readFileSync, existsSync } from "node:fs";
import { describe, it, expect } from "vitest";

const root = new URL("../../", import.meta.url);
const readme = readFileSync(new URL("README.md", root), "utf8");
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

describe("README", () => {
  it.each(["npm ci", "npm run dev", "npm run build", "npm test", "npm run test:e2e", "npm run preview"])(
    "explains %s",
    (command) => {
      expect(readme).toContain(command);
    },
  );

  it("only mentions npm scripts that exist", () => {
    const scripts = [...readme.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) expect(pkg.scripts, script).toHaveProperty(script);
  });

  it("names the Node.js version", () => {
    const major = pkg.engines.node.match(/\d+/)[0];
    expect(readme).toMatch(new RegExp(`Node(\\.js)? ${major}`));
  });

  it("says where the built page is", () => {
    expect(readme).toContain("dist/");
  });

  it("describes the examples and the editors", () => {
    expect(readme).toContain("examples/");
    expect(readme).toContain("codemirror-setup.js");
    expect(readme).toContain("CodeMirror 6");
  });

  it("explains how to run the browser tests with an installed Chromium", () => {
    expect(readme).toContain("CHROMIUM_PATH");
    expect(readme).toContain("npx playwright install");
  });

  it("links files that exist", () => {
    const links = [...readme.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)].map((m) => m[1]);
    for (const link of links) expect(existsSync(new URL(link, root)), link).toBe(true);
  });
});
