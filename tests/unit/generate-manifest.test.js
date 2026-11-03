// The examples of the Generate tab: its manifest (examples/generate/
// manifest.yml), read by manifest.js (action: generate) and generate.js.

import { readFileSync, existsSync } from "node:fs";
import { describe, it, expect } from "vitest";
import * as rudof from "@rudof/rudof";
import { parseManifest, parseSections, loadExample, GENERATE_LANGUAGES } from "../../manifest.js";
import { GENERATE_MANIFEST, GENERATE_TARGETS, generateCatalog, generateData } from "../../generate.js";

const URL_OF = new URL(`../../${GENERATE_MANIFEST}`, import.meta.url);
const fromFile = async (url) => readFileSync(new URL(url), "utf8");
const MANIFEST_URL = "https://example.org/manifest.yaml";
const one = (yaml) => parseManifest(yaml, MANIFEST_URL)[0];

describe("examples of action: generate", () => {
  it("go to the Generate tab, with the schema in each language, the configuration, the entities and the seed", () => {
    const example = one("- action: generate\n  kind: valid\n  shaclURL: s.ttl\n  shex: ':S {}'\n  config: 'version = 2'\n  entities: 20\n  seed: 1\n");
    expect(example).toMatchObject({ action: "generate", target: "generate", kind: "valid", language: "shacl", unsupported: undefined });
    expect(example.inputs).toEqual({
      shacl: { url: "https://example.org/s.ttl" },
      shex: { text: ":S {}" },
      config: { text: "version = 2" },
      entities: { text: "20" },
      seed: { text: "1" },
    });
  });

  it("open in their schemaLanguage, or the first language they have; schema: is the schema in it", () => {
    expect(one("- action: generate\n  pgschemaURL: s.pgs\n  shexURL: s.shex\n").language).toBe("shex");
    const example = one("- action: generate\n  schemaLanguage: PGSchema\n  schema: 'CREATE NODE TYPE ( T : T {} )'\n");
    expect(example.language).toBe("pgschema");
    expect(example.inputs.pgschema).toEqual({ text: "CREATE NODE TYPE ( T : T {} )" });
  });

  it("need a schema, in a language of the tab", () => {
    expect(one("- action: generate\n  config: 'version = 2'\n")).toMatchObject({ unsupported: "has no schema to generate data from", help: "example-generate" });
    expect(one("- action: generate\n  schemaLanguage: dctap\n  schema: x\n")).toMatchObject({ help: "example-generate", hint: "Write schemaLanguage: shacl, shex, pgschema." });
  });

  it("load their configuration, or version 2", async () => {
    const inputs = await loadExample(one("- action: generate\n  shex: ':S {}'\n"));
    expect(Object.fromEntries(inputs.map((i) => [i.name, i.text]))).toMatchObject({ shex: ":S {}", config: "version = 2\n", entities: "", seed: "" });
    expect(inputs.find((i) => i.name === "config").textarea).toBe("gen-config");
  });
});

describe("the manifest of the Generate tab", () => {
  const { examples, tree } = parseSections(readFileSync(URL_OF, "utf8"), URL_OF.href);
  const catalog = generateCatalog(tree);

  it("has a section for each example, with an id, and the same kinds of data in each one", () => {
    expect(catalog.map((s) => s.id)).toEqual(["person", "references", "keys", "facets", "labels", "lubm", "ldbc-snb"]);
    for (const section of catalog) {
      expect(section.comment, section.id).toBeTruthy();
      expect(section.kinds.map((e) => e.kind), section.id).toEqual(["valid", "dense", "sparse", "coherence", "errors"]);
    }
    expect(examples.every((e) => e.action === "generate" && !e.unsupported)).toBe(true);
  });

  it("has the schemas of each example in the three languages, as files next to it", () => {
    for (const example of examples) {
      for (const language of GENERATE_LANGUAGES) {
        expect(example.inputs[language]?.url, `${example.label}, ${language}`).toBeDefined();
        expect(existsSync(new URL(example.inputs[language].url)), example.inputs[language].url).toBe(true);
      }
    }
  });

  it("has the example of the other tabs first: their schemas", () => {
    const [person] = catalog;
    const files = Object.fromEntries(GENERATE_LANGUAGES.map((language) => [language, person.kinds[0].inputs[language].url.split("/examples/")[1]]));
    expect(files).toEqual({ shacl: "person/shapes.ttl", shex: "person/schema.shex", pgschema: "person/schema.pgs" });
  });

  it("generates valid data from each example, in each language", async () => {
    for (const section of catalog) {
      const valid = section.kinds.find((e) => e.kind === "valid");
      const inputs = Object.fromEntries((await loadExample(valid, fromFile)).map((i) => [i.name, i.text]));
      for (const language of GENERATE_LANGUAGES) {
        const result = generateData(rudof, { schema: inputs[language], format: GENERATE_TARGETS[language], config: inputs.config, entities: 12, seed: 7 });
        expect([section.id, language, result.kind]).toEqual([section.id, language, "ok"]);
      }
    }
  }, 120_000);
});
