// Step 10: a GitHub Actions workflow tests and builds the page on every push
// and pull request, and publishes it to the gh-pages branch from main.

import { readFileSync, existsSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parse } from "yaml";

const path = new URL("../../.github/workflows/gh-pages.yml", import.meta.url);
const workflow = () => parse(readFileSync(path, "utf8"));
const runs = (job) => job.steps.map((s) => s.run).filter(Boolean).join("\n");
const uses = (job) => job.steps.map((s) => s.uses).filter(Boolean);

describe("gh-pages workflow", () => {
  it("exists", () => {
    expect(existsSync(path)).toBe(true);
  });

  it("runs on pushes and pull requests", () => {
    const on = workflow().on;
    expect(on).toHaveProperty("push");
    expect(on).toHaveProperty("pull_request");
  });

  it("does not run on the pushes it makes to gh-pages, which has no tests", () => {
    expect(workflow().on.push["branches-ignore"]).toContain("gh-pages");
  });

  describe("the test job", () => {
    const job = () => workflow().jobs.test;

    it("uses the Node.js version of package.json, with the npm cache", () => {
      const setup = job().steps.find((s) => s.uses?.startsWith("actions/setup-node@"));
      expect(String(setup.with["node-version"])).toMatch(/^22/);
      expect(setup.with.cache).toBe("npm");
    });

    it("installs, runs the unit tests and builds", () => {
      expect(uses(job())).toEqual(expect.arrayContaining([expect.stringMatching(/^actions\/checkout@/)]));
      const commands = runs(job());
      expect(commands).toContain("npm ci");
      expect(commands).toContain("npm test");
      expect(commands).toContain("npm run build");
    });

    it("runs the browser tests in Chromium", () => {
      const commands = runs(job());
      expect(commands).toContain("npx playwright install --with-deps chromium");
      expect(commands).toContain("npm run test:e2e");
    });

    it("keeps the Playwright report when the browser tests fail", () => {
      const upload = job().steps.find((s) => s.uses?.startsWith("actions/upload-artifact@"));
      expect(upload.if).toMatch(/failure\(\)/);
      expect(upload.with.path).toContain("playwright-report");
    });

    it("keeps the built page for the deploy job", () => {
      const upload = job().steps.find((s) => s.uses?.startsWith("actions/upload-artifact@") && s.with.path === "dist");
      expect(upload).toBeDefined();
    });
  });

  describe("the deploy job", () => {
    const job = () => workflow().jobs.deploy;

    it("runs only when the tests pass", () => {
      expect([job().needs].flat()).toContain("test");
    });

    it("only publishes pushes to main, never pull requests", () => {
      expect(job().if).toContain("github.event_name == 'push'");
      expect(job().if).toContain("github.ref == 'refs/heads/main'");
    });

    it("publishes the built page to the gh-pages branch", () => {
      const publish = job().steps.find((s) => s.uses?.startsWith("peaceiris/actions-gh-pages@"));
      expect(publish.with.publish_branch).toBe("gh-pages");
      expect(publish.with.publish_dir).toMatch(/^(\.\/)?dist$/);
      expect(publish.with.github_token).toBe("${{ secrets.GITHUB_TOKEN }}");
    });

    it("may write to the repository, and publishes one push at a time", () => {
      expect(job().permissions.contents).toBe("write");
      expect(workflow().permissions?.contents ?? "read").toBe("read");
      expect(job().concurrency?.group ?? workflow().concurrency?.group).toBeTruthy();
    });
  });
});
