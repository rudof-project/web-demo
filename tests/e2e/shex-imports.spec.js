// ShEx schemas that import other schemas (IMPORT <iri>): rudof with
// endpoints gets them with fetch (readShexAsync, rudof 0.3.31). Without it,
// the page says that the imports need it.

import { test, expect, open, setInput, hasEndpointsBuild } from "./fixtures.js";

const BOOK = `prefix :       <http://www.validatingrdf.com/examples/>
prefix xsd:    <http://www.w3.org/2001/XMLSchema#>
prefix schema: <http://schema.org/>

:Book {
 schema:name   xsd:string ;
 schema:author @:Person
}
:Person { schema:name xsd:string }`;

// The example of the ISWC 2026 tutorial
const AUDIOBOOK = (iri) => `prefix :       <http://www.validatingrdf.com/examples/>
prefix xsd:    <http://www.w3.org/2001/XMLSchema#>
prefix schema: <http://schema.org/>

import <${iri}>

:AudioBook @:Book AND {
 schema:name          MaxLength 20 ;
 schema:readBy        @:Person     ;
}`;

const DATA = `prefix :       <http://example.org/>
prefix schema: <http://schema.org/>

:item24 schema:name         "Weaving the Web" ;
        schema:author       :timbl            ;
        schema:readBy       :timbl            .

:timbl  schema:name         "Tim Berners-Lee" .`;

const BOOK_IRI = "https://www.validatingrdf.com/examples/book.shex";
const result = (page, prefix) => page.locator(`#${prefix}-result:not([data-kind="running"])`);

// The servers of the schemas: the requests they get
async function schemas(page) {
  const requests = [];
  await page.route(/^https:\/\/(www\.validatingrdf\.com|manifests\.example)\//, (route) => {
    const url = route.request().url();
    requests.push(url);
    const files = {
      [BOOK_IRI]: BOOK,
      "https://manifests.example/book.shex": BOOK,
      "https://manifests.example/audiobook.shex": AUDIOBOOK("book.shex"),
      "https://manifests.example/data.ttl": DATA,
      "https://manifests.example/m.yaml": "- comment: An audio book\n  schemaURL: audiobook.shex\n  dataURL: data.ttl\n  queryMap: ':item24@<http://www.validatingrdf.com/examples/AudioBook>'\n  status: conformant\n",
    };
    if (!(url in files)) return route.fulfill({ status: 404, body: "Not found", headers: { "access-control-allow-origin": "*" } });
    return route.fulfill({ body: files[url], headers: { "access-control-allow-origin": "*" } });
  });
  return requests;
}

async function shex(page, schema) {
  await open(page, "#validate/shex");
  await setInput(page, "shex-schema", schema);
  await setInput(page, "shex-data", DATA);
  await setInput(page, "shex-shapemap", ":item24@<http://www.validatingrdf.com/examples/AudioBook>");
}

test.describe("with rudof with endpoints", () => {
  test.skip(!hasEndpointsBuild, "no rudof with endpoints in node_modules or RUDOF_ENDPOINTS_DIR");

  test("ShEx validates with the shapes of the imported schemas", async ({ page }) => {
    const requests = await schemas(page);
    await shex(page, AUDIOBOOK(BOOK_IRI));
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 1 node validated", { timeout: 30_000 });
    expect(requests).toContain(BOOK_IRI);
    // Again: the result is that of the new session
    await setInput(page, "shex-data", DATA.replace("Weaving the Web", "Weaving the World Wide Web, the book"));
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex").locator(".verdict")).toHaveText(/^Does not conform/, { timeout: 30_000 });
    await expect(page.locator("#shex-result table.report")).toContainText("MaxLength");
  });

  test("the imports of a schema of a manifest are relative to its file", async ({ page }) => {
    const requests = await schemas(page);
    await open(page, `?manifestURL=${encodeURIComponent("https://manifests.example/m.yaml")}&example=1`);
    await expect(page.locator("#shex-schema")).toHaveJSProperty("value", AUDIOBOOK("book.shex"));
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex").locator(".verdict")).toHaveText("Conforms: 1 node validated (as the manifest expects)", { timeout: 30_000 });
    expect(requests).toContain("https://manifests.example/book.shex");
  });

  test("a schema with imports converts to ShExJ and to a UML diagram", async ({ page }) => {
    await schemas(page);
    await shex(page, AUDIOBOOK(BOOK_IRI));
    await page.locator("#shex-schema-result-format").selectOption("shexj");
    await page.locator("#shex-schema-validate").click();
    await expect(page.locator("#shex-schema-result")).toHaveAttribute("data-kind", "ok", { timeout: 30_000 });
    await expect(page.locator("#shex-schema-output")).toContainText(`"imports"`);
    await expect(page.locator("#shex-schema-output")).toContainText(BOOK_IRI);
    // A UML diagram (rudof can't draw AND yet: a schema without it)
    await setInput(page, "shex-schema", `prefix : <http://www.validatingrdf.com/examples/>\nprefix schema: <http://schema.org/>\nimport <${BOOK_IRI}>\n:AudioBook { schema:readBy @:Person }`);
    await page.locator("#shex-schema-result-format").selectOption("plantuml");
    await page.locator("#shex-schema-validate").click();
    await expect(page.locator("#shex-schema-result")).toHaveAttribute("data-kind", "ok", { timeout: 30_000 });
    expect(await page.locator("#shex-schema-output").evaluate((pre) => pre.textContent)).toContain("AudioBook");
    // The Schema tab
    await open(page, "#schema/convert");
    await page.locator("#convert-language").selectOption("shex");
    await page.locator("#convert-format").selectOption("shexc");
    await setInput(page, "convert-schema", AUDIOBOOK(BOOK_IRI));
    await page.locator("#convert-to").selectOption("shex");
    await page.locator("#convert-result-format").selectOption("shexj");
    await page.locator("#convert-validate").click();
    await expect(page.locator("#convert-result")).toHaveAttribute("data-kind", "ok", { timeout: 30_000 });
    await expect(page.locator("#convert-output")).toContainText(`"imports"`);
  });

  test("an import that can't be read is an error that names it", async ({ page }) => {
    await schemas(page);
    await shex(page, AUDIOBOOK("https://www.validatingrdf.com/examples/none.shex"));
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex")).toHaveAttribute("data-kind", "error", { timeout: 30_000 });
    await expect(page.locator("#shex-output")).toContainText("none.shex");
  });
});

test.describe("without rudof with endpoints", () => {
  test.use({ rudofEndpoints: false });

  test("the page says that the imports need rudof with endpoints", async ({ page }) => {
    await schemas(page);
    await shex(page, AUDIOBOOK(BOOK_IRI));
    await page.locator("#shex-validate").click();
    await expect(result(page, "shex")).toHaveAttribute("data-kind", "error");
    await expect(page.locator("#shex-output")).toContainText("This schema imports other schemas (IMPORT). rudof can get them only in browsers with JSPI");
  });
});
