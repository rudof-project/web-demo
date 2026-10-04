// The page under test, with rudof served from node_modules instead of
// jsDelivr, so that the tests don't depend on the network and use the rudof
// version of package.json (the one demo.js loads, see examples.test.js).

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test as base, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const RUDOF_WEB = join(dirname(require.resolve("@rudof/rudof/package.json")), "web");

const TYPES = { js: "text/javascript", wasm: "application/wasm" };

export const test = base.extend({
  page: async ({ page }, use) => {
    // Nothing else is loaded from outside (PlantUML is only needed by
    // diagrams). The routes added last are tried first.
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    await page.route("https://cdn.jsdelivr.net/npm/@rudof/rudof@*/web/**", async (route) => {
      const file = new URL(route.request().url()).pathname.split("/web/")[1];
      const body = await readFile(join(RUDOF_WEB, file));
      await route.fulfill({ body, contentType: TYPES[file.split(".").pop()] ?? "application/octet-stream" });
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e));
    await use(page);
    expect(errors, "errors in the page").toEqual([]);
  },
});

export { expect };

// The editor of a textarea
export const editor = (page, id) => page.locator(`.cm-editor[data-editor-for="${id}"]`);

// Opens the demo and waits for rudof
export async function open(page, fragment = "") {
  await page.goto(`./${fragment}`);
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 30_000 });
}

// Replaces the text of an input, as demo.js does: through its textarea.
export async function setInput(page, id, text) {
  await page.locator(`#${id}`).evaluate((textarea, value) => (textarea.value = value), text);
}
