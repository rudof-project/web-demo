// The help page, opened from the header of the demo.

import { test, expect, open } from "./fixtures.js";

test("the Help link of the header opens the help page, which links back", async ({ page }) => {
  await open(page);
  await page.locator("header .links").getByRole("link", { name: "Help" }).click();
  await expect(page).toHaveURL(/help\.html$/);
  await expect(page.locator("h1")).toHaveText("Manifests of examples");
  await expect(page.locator("#example-shacl")).toBeVisible();
  // The styles of the demo are there
  await expect(page.locator("pre.manifest-example").first()).toHaveCSS("border-top-style", "solid");
  await page.locator("header .links").getByRole("link", { name: "Demo" }).click();
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 30_000 });
});
