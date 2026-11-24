// The page under test. The tests get rudof from node_modules, not from
// jsDelivr. Thus the tests do not need the network, and they use the rudof
// version of package.json (the version that demo.js loads, see
// examples.test.js).
//
// rudof with endpoints (endpoints/web/, which demo.js loads in browsers with
// JSPI) also comes from the package. If RUDOF_ENDPOINTS_DIR is set, it comes
// from that folder. The folder has a different build of rudof with the
// `endpoints` feature, for example bindings/wasm/pkg/endpoints/web of rudof.
// Without it, the page gets 404 for it and loads web/, as it does when it
// cannot load rudof with endpoints. Tests can ask for web/ with test.use({
// rudofEndpoints: false }).
//
// The page reads the descriptions of the endpoints that rudof knows from
// jsDelivr (rudof_rdf/endpoints in the repository of rudof). rudof-endpoints/
// has copies of some of these descriptions. The tests do not find the other
// descriptions.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test as base, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const RUDOF_PACKAGE = dirname(require.resolve("@rudof/rudof/package.json"));
const RUDOF_WEB = join(RUDOF_PACKAGE, "web");
const RUDOF_ENDPOINTS = [process.env.RUDOF_ENDPOINTS_DIR, join(RUDOF_PACKAGE, "endpoints", "web")].find(
  (dir) => dir && existsSync(join(dir, "rudof_wasm.js")),
);

const RUDOF_ENDPOINT_FILES = join(dirname(new URL(import.meta.url).pathname), "rudof-endpoints");

// Whether the tests have rudof with endpoints
export const hasEndpointsBuild = Boolean(RUDOF_ENDPOINTS);

const TYPES = { js: "text/javascript", wasm: "application/wasm" };

export const test = base.extend({
  rudofEndpoints: [true, { option: true }],
  page: async ({ page, rudofEndpoints }, use) => {
    // Nothing else is loaded from outside (PlantUML is only needed by
    // diagrams). The routes added last are tried first.
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    await page.route("https://cdn.jsdelivr.net/npm/@rudof/rudof@*/web/**", async (route) => {
      const file = new URL(route.request().url()).pathname.split("/web/")[1];
      const body = await readFile(join(RUDOF_WEB, file));
      await route.fulfill({ body, contentType: TYPES[file.split(".").pop()] ?? "application/octet-stream" });
    });
    await page.route("https://cdn.jsdelivr.net/npm/@rudof/rudof@*/endpoints/web/**", async (route) => {
      if (!RUDOF_ENDPOINTS || !rudofEndpoints) return route.fulfill({ status: 404, body: "Not found" });
      const file = new URL(route.request().url()).pathname.split("/endpoints/web/")[1];
      const body = await readFile(join(RUDOF_ENDPOINTS, file));
      await route.fulfill({ body, contentType: TYPES[file.split(".").pop()] ?? "application/octet-stream" });
    });
    await page.route("https://cdn.jsdelivr.net/gh/rudof-project/rudof@*/rudof_rdf/endpoints/*", async (route) => {
      const file = join(RUDOF_ENDPOINT_FILES, new URL(route.request().url()).pathname.split("/").pop());
      if (!existsSync(file)) return route.fulfill({ status: 404, body: "Not found" });
      await route.fulfill({ body: await readFile(file), contentType: "text/plain" });
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
