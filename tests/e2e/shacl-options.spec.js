// The options of SHACL validation: the recursion semantics (no recursion,
// LFP, GFP), and the results to show (errors, evidences, evidences of
// shapes only), which rudof takes from its configuration.

import { test, expect, open, setInput } from "./fixtures.js";

// Alice and Bob know each other: whether they conform depends on the
// recursion semantics. Carol has no name.
const DATA = `prefix : <http://example.org/>
:alice a :Person ; :name "Alice" ; :knows :bob .
:bob a :Person ; :name "Bob" ; :knows :alice .
:carol a :Person .
:dave a :Person ; :name "Dave" .`;

const SHAPES = `prefix : <http://example.org/>
prefix sh: <http://www.w3.org/ns/shacl#>
:PersonShape a sh:NodeShape ; sh:targetClass :Person ;
  sh:property [ sh:path :name ; sh:minCount 1 ] ;
  sh:property [ sh:path :knows ; sh:node :PersonShape ] .`;

const verdict = (page) => page.locator("#shacl-result .verdict");
const rows = (page) => page.locator("#shacl-result table.report tbody tr");

async function validate(page) {
  await page.locator("#shacl-validate").click();
  await expect(page.locator("#shacl-result")).not.toHaveAttribute("data-kind", "running");
}

test.beforeEach(async ({ page }) => {
  await open(page, "#validate/shacl");
  await setInput(page, "shacl-data", DATA);
  await setInput(page, "shacl-shapes", SHAPES);
});

test("by default: LFP, with the errors and the evidences of shapes", async ({ page }) => {
  await expect(page.locator("#shacl-recursion")).toHaveValue("lfp");
  for (const id of ["shacl-errors", "shacl-evidences", "shacl-evidences-shapes"]) await expect(page.locator(`#${id}`)).toBeChecked();
  await validate(page);
  // LFP (conservative): a cycle is not a reason to conform
  await expect(verdict(page)).toHaveText("Does not conform: 3 violations");
  await expect(rows(page).filter({ hasText: "sh:Violation" })).toHaveCount(3);
  // The evidence that Dave conforms to the shape
  await expect(rows(page).filter({ hasText: "Conforms" })).toHaveCount(1);
  await expect(rows(page).filter({ hasText: "Conforms" })).toContainText(":dave");
  await expect(rows(page).filter({ hasText: "Conforms" })).toContainText(":PersonShape");
});

test("GFP accepts the cycle, and no recursion refuses it", async ({ page }) => {
  await page.locator("#shacl-recursion").selectOption("gfp");
  await validate(page);
  await expect(verdict(page)).toHaveText("Does not conform: 1 violation");
  await expect(rows(page).filter({ hasText: "sh:Violation" })).toContainText(":carol");

  await page.locator("#shacl-recursion").selectOption("none");
  await validate(page);
  await expect(page.locator("#shacl-result")).toHaveAttribute("data-kind", "error");
  await expect(page.locator("#shacl-result .output")).toContainText("cycles");
});

test("the evidences can be of every constraint, or none, and the errors hidden", async ({ page }) => {
  await page.locator("#shacl-recursion").selectOption("gfp");
  await page.locator("#shacl-evidences-shapes").uncheck();
  await validate(page);
  // An evidence of each constraint too
  await expect(rows(page).filter({ hasText: "Conforms" })).not.toHaveCount(3);
  await expect(rows(page).filter({ hasText: "MinCountConstraintComponent" }).filter({ hasText: "Conforms" })).not.toHaveCount(0);

  await page.locator("#shacl-evidences").uncheck();
  await expect(page.locator("#shacl-evidences-shapes")).toBeDisabled();
  await validate(page);
  await expect(rows(page).filter({ hasText: "Conforms" })).toHaveCount(0);
  await expect(rows(page)).toHaveCount(1);

  await page.locator("#shacl-evidences").check();
  await page.locator("#shacl-evidences-shapes").check();
  await page.locator("#shacl-errors").uncheck();
  await validate(page);
  await expect(verdict(page)).toHaveText("Does not conform");
  await expect(rows(page).filter({ hasText: "sh:Violation" })).toHaveCount(0);
  await expect(rows(page).filter({ hasText: "Conforms" })).toHaveCount(3);
});

test("the options are in the permalink", async ({ page }) => {
  await page.locator("#shacl-recursion").selectOption("gfp");
  await page.locator("#shacl-evidences").uncheck();
  await validate(page);
  const params = new URL(page.url()).searchParams;
  expect([params.get("recursion"), params.get("errors"), params.get("evidences"), params.get("evidences-shapes")]).toEqual(["gfp", "true", "false", "true"]);
  await open(page, `?${params}#validate/shacl`);
  await expect(page.locator("#shacl-recursion")).toHaveValue("gfp");
  await expect(page.locator("#shacl-evidences")).not.toBeChecked();
  await expect(page.locator("#shacl-evidences-shapes")).toBeDisabled();
  await expect(page.locator("#shacl-errors")).toBeChecked();
});

test("the menu of the recursion says what LFP and GFP mean", async ({ page }) => {
  const recursion = page.locator("#shacl-recursion");
  await expect(recursion.locator("option")).toHaveText(["No recursion", "LFP: Conservative Mode", "GFP: Permissive Mode"]);
  await expect(recursion.locator('option[value="lfp"]')).toHaveAttribute("title", /false unless proven/);
  await expect(recursion.locator('option[value="gfp"]')).toHaveAttribute("title", /true unless disproven/);
  // The menu says the one chosen, and the ⓘ both
  await expect(recursion).toHaveAttribute("title", /false unless proven/);
  await recursion.selectOption("gfp");
  await expect(recursion).toHaveAttribute("title", /true unless disproven/);
  await expect(page.locator("#shacl-recursion-info")).toHaveAttribute("title", /False unless proven[\s\S]*True unless disproven/);
});

test("permalinks with the old names of the recursion still work", async ({ page }) => {
  await open(page, "?recursion=brave#validate/shacl");
  await expect(page.locator("#shacl-recursion")).toHaveValue("gfp");
  await open(page, "?recursion=cautious#validate/shacl");
  await expect(page.locator("#shacl-recursion")).toHaveValue("lfp");
});

test("without a shapes graph, the shapes are taken from the RDF data", async ({ page }) => {
  await expect(page.locator("#shacl-shapes-from-data")).toBeHidden();
  await setInput(page, "shacl-data", `${SHAPES}\n${DATA}`);
  await setInput(page, "shacl-shapes", "");
  await expect(page.locator("#shacl-shapes-from-data")).toBeVisible();
  await validate(page);
  await expect(verdict(page)).toHaveText("Does not conform: 3 violations (with the shapes of the RDF data)");
  // The schema is the shapes of the data too
  await page.locator("#shacl-schema-result-format").selectOption("turtle");
  await page.locator("#shacl-schema-validate").click();
  await expect(page.locator("#shacl-schema-result")).toHaveAttribute("data-kind", "ok");
  await expect(page.locator("#shacl-schema-result .output")).toContainText("PersonShape");
});
