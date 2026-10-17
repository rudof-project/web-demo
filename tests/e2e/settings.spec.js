// The settings of rudof: the gear of the header opens them, they change
// what rudof does, and the browser keeps them.

import { test, expect, open, setInput } from "./fixtures.js";

const dialog = (page) => page.locator("#settings");

async function openSettings(page) {
  await page.locator("#settings-open").click();
  await expect(dialog(page)).toBeVisible();
}

const save = (page) => dialog(page).getByRole("button", { name: "Save" }).click();

test("the gear of the header opens the settings, by sections", async ({ page }) => {
  await open(page);
  await expect(page.locator("#settings-open")).toHaveAccessibleName("Settings");
  await expect(page.locator("#settings-badge")).toBeHidden();
  await openSettings(page);
  await expect(dialog(page).locator("legend")).toContainText(["General", "ShEx validation", "UML diagrams (from ShEx)", "DCTAP", "More settings (TOML)"]);
  // Cancel and Escape close it
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toBeHidden();
  await openSettings(page);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
});

test("the settings change what rudof does, and the browser keeps them", async ({ page }) => {
  await open(page, "#schema/convert");
  await openSettings(page);
  await page.locator("#setting-shex2uml-direction").selectOption("left_to_right");
  await page.locator("#setting-shex2uml-class_skin-background_color").selectOption("light_green");
  // The configuration that rudof gets
  await dialog(page).locator("summary").click();
  await expect(dialog(page).locator(".settings-preview")).toContainText('direction = "left_to_right"');
  await save(page);
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator("#settings-badge")).toHaveText("2");

  await page.locator("#convert-to").selectOption("uml");
  await page.locator("#convert-validate").click();
  await expect(page.locator("#convert-result")).toHaveAttribute("data-kind", "ok");
  await expect(page.locator("#convert-output")).toContainText("left to right direction");
  await expect(page.locator("#convert-output")).toContainText("BackgroundColor LightGreen");

  // Kept when the page opens again; Reset to defaults forgets them
  await open(page, "#schema/convert");
  await expect(page.locator("#settings-badge")).toHaveText("2");
  await openSettings(page);
  await expect(page.locator("#setting-shex2uml-direction")).toHaveValue("left_to_right");
  await dialog(page).getByRole("button", { name: "Reset to defaults" }).click();
  await expect(page.locator("#setting-shex2uml-direction")).toHaveValue("top_to_bottom");
  await save(page);
  await expect(page.locator("#settings-badge")).toBeHidden();
});

test("ShEx validation stops after the maximum number of steps", async ({ page }) => {
  await open(page, "#validate/shex");
  await openSettings(page);
  await page.locator("#setting-shex_validator-max_steps").fill("1");
  await save(page);
  await page.locator("#shex-validate").click();
  await expect(page.locator("#shex-result")).toHaveAttribute("data-kind", "error");
  await expect(page.locator("#shex-result .output")).toContainText("limit of 1 step");
});

test("wrong settings are not saved, and say why", async ({ page }) => {
  await open(page);
  await openSettings(page);
  await page.locator("#setting-shex_validator-max_steps").fill("many");
  await save(page);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator(".settings-error")).toHaveText("Maximum number of steps: write a whole number, or leave it empty");
  await page.locator("#setting-shex_validator-max_steps").fill("");
  await setInput(page, "settings-toml", "[shex_validator]\nmax_steps = \"many\"\n");
  await save(page);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator(".settings-error")).toContainText("rudof can't use these settings");
  await setInput(page, "settings-toml", "not TOML");
  await expect(dialog(page).locator(".settings-error")).toBeVisible();
});

test("the endpoints of the settings are in the menus, with their prefixes", async ({ page }) => {
  await open(page, "#query/sparql");
  await openSettings(page);
  await setInput(
    page,
    "settings-toml",
    '[rdf.endpoints.Mine]\nname = "Mine"\nquery_url = "https://mine.example/sparql"\n\n[rdf.endpoints.Mine.prefixmap]\nmine = "http://mine.example/"\n',
  );
  await save(page);
  await expect(page.locator('#sparql-endpoint-choice option[value="https://mine.example/sparql"]')).toHaveText("Mine (mine.example)");
  await page.locator("#sparql-endpoint-choice").selectOption("https://mine.example/sparql");
  await expect(page.locator("#sparql-endpoint-prefixes summary")).toHaveText("Prefixes of Mine (1)");
  await page.locator("#sparql-endpoint-prefixes summary").click();
  await expect(page.locator("#sparql-endpoint-prefixes pre")).toHaveText("PREFIX mine: <http://mine.example/>");
});
