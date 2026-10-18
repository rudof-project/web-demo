// The header: the menus Examples and About, Help, and the theme, which the
// browser keeps.

import { test, expect, open } from "./fixtures.js";

const menu = (page, name) => page.locator("header details.menu", { has: page.locator(`summary:text-is("${name}")`) });

test("the header has Examples, Help and About, and the theme and the settings", async ({ page }) => {
  await open(page);
  await expect(page.locator("header .links > a, header .links > details:not(.menu-icon) > summary")).toHaveText(["Examples", "Help", "About"]);
  await expect(page.locator("header .menu-icon summary")).toHaveAccessibleName("Theme");
  await expect(page.locator("#settings-open")).toBeVisible();
});

test("Examples opens the examples of the ISWC 2026 tutorial", async ({ page }) => {
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.fulfill({ headers: { "access-control-allow-origin": "*" }, body: "- comment: An example\n  data: ''\n  action: data\n" }),
  );
  await open(page);
  await menu(page, "Examples").locator("summary").click();
  await page.getByRole("link", { name: /ISWC 2026 tutorial/ }).click();
  await expect(page.locator("#manifest-link")).toHaveText("https://raw.githubusercontent.com/validatingrdf/Tutorial/refs/heads/master/ISWC_2026/manifest.yml");
  await expect(page.locator("#manifest-examples option").nth(1)).toHaveText("An example");
});

test("About has the links of rudof and the demo, and their versions", async ({ page }) => {
  await open(page);
  const about = menu(page, "About");
  await about.locator("summary").click();
  await expect(about.getByRole("link", { name: "rudof manual" })).toBeVisible();
  await expect(about.getByRole("link", { name: "Source code of this demo" })).toHaveAttribute("href", "https://github.com/rudof-project/web-demo");
  await expect(about.locator("#about-rudof-version")).toHaveText(/^0\.\d+\.\d+, with endpoints$/);
  await expect(about.locator("#about-demo-version")).toHaveText("0.0.1");
  await expect(about.locator(".menu-versions dt")).toHaveText(["rudof", "This demo"]);
  // Escape closes it
  await page.keyboard.press("Escape");
  await expect(about).not.toHaveAttribute("open");
});

test("the theme is light, dark or the one of the system, and the browser keeps it", async ({ page }) => {
  await open(page);
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: "light" });
  expect(await background()).toBe("rgb(255, 255, 255)");
  await page.locator("header .menu-icon summary").click();
  await page.getByRole("radio", { name: "Dark" }).check();
  expect(await background()).toBe("rgb(21, 24, 28)");
  await open(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background()).toBe("rgb(21, 24, 28)");
  // As the system: dark when the system is dark
  await page.locator("header .menu-icon summary").click();
  await page.getByRole("radio", { name: "As the system" }).check();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background()).toBe("rgb(21, 24, 28)");
  // Light, even when the system is dark
  await page.getByRole("radio", { name: "Light" }).check();
  expect(await background()).toBe("rgb(255, 255, 255)");
});

test("the help page has the same header, and the theme", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.setItem("rudof-demo-theme", "dark"));
  await page.goto("./help.html");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("header .links > a, header .links > details:not(.menu-icon) > summary")).toHaveText(["Examples", "Help", "About"]);
  await expect(page.locator("header .brand a.subtitle")).toHaveAttribute("href", "./");
});
