// The conversions of the Schema tab (schema-convert.js): every conversion
// that the menus offer works in rudof, and the others are marked as not
// available.

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { Rudof, RudofConfig } from "@rudof/rudof";
import { LANGUAGES, TARGETS, CONVERSIONS, DEFAULT_TARGET, canConvert, readSchema, convertSchema, sourceLabel, targetLabel, asSource } from "../../schema-convert.js";
import { dctapConfig } from "../../dctap.js";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const unescape = (text) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const textarea = (id) => unescape(html.match(new RegExp(`<textarea id="${id}"[^>]*>([\\s\\S]*?)</textarea>`))[1]);

// The examples of the page, as the Schema tab takes them
const SOURCES = {
  shex: { format: "shexc", text: textarea("shex-schema") },
  shacl: { format: "turtle", text: textarea("shacl-shapes") },
  dctap: { format: "dctap", text: textarea("dctap-schema"), config: () => RudofConfig.fromToml(dctapConfig(textarea("dctap-prefixes"))) },
  pgschema: { format: "pgschema", text: textarea("pgschema-schema") },
};

function convert(language, to, format) {
  const { config, ...rest } = SOURCES[language];
  const source = { language, ...rest, config: config?.() };
  const rudof = new Rudof();
  readSchema(rudof, source);
  return convertSchema(rudof, new Rudof(), source, { to, format });
}

const available = Object.keys(LANGUAGES).flatMap((language) =>
  CONVERSIONS[language].flatMap((to) => TARGETS[to].formats.filter(([, , ok]) => ok).map(([format]) => [language, to, format])),
);

describe("the conversions rudof can do", () => {
  it.each(available)("%s → %s (%s)", (language, to, format) => {
    const result = convert(language, to, format);
    const text = typeof result === "string" ? result : result.plantuml;
    expect(text.trim().length).toBeGreaterThan(0);
    if (to === "uml") expect(text).toMatch(/^@startuml/);
    if (to === "sparql") expect(text).toMatch(/SELECT/);
  });

  it("the ShEx of a SHACL schema and of a DCTAP profile has their shapes", () => {
    expect(convert("shacl", "shex", "shexc")).toContain("PersonShape");
    expect(convert("dctap", "shex", "shexc")).toContain(":Person");
  });

  it("ShExR reads back as ShEx", () => {
    const turtle = convert("shex", "shex", "turtle");
    const rudof = new Rudof();
    readSchema(rudof, { language: "shex", format: "turtle", text: turtle });
    expect(rudof.serializeCurrentShex("shexc")).toContain(":Person");
  });
});

describe("the conversions rudof can't do yet", () => {
  it.each([
    ["shex", "shacl"],
    ["shex", "dctap"],
    ["shacl", "dctap"],
    ["dctap", "shacl"],
    ["pgschema", "shex"],
    ["pgschema", "uml"],
  ])("%s → %s is not available", (from, to) => {
    expect(canConvert(from, to)).toBe(false);
    expect(() => convert(from, to, TARGETS[to].formats[0][0])).toThrow(/can't convert .* yet/);
  });

  it("some formats are not available", () => {
    expect(canConvert("dctap", "dctap", "dctap-csv")).toBe(false);
    expect(canConvert("pgschema", "pgschema", "pgschemac")).toBe(false);
    expect(canConvert("dctap", "dctap", "dctap-json")).toBe(true);
  });
});

describe("the menus", () => {
  it("each language converts by default to something it can", () => {
    for (const [language, [to, format]] of Object.entries(DEFAULT_TARGET)) expect(canConvert(language, to, format), language).toBe(true);
  });

  it("names the source and the target", () => {
    expect(sourceLabel({ language: "shex", format: "turtle" })).toBe("ShEx (ShExR (Turtle))");
    expect(sourceLabel({ language: "dctap", format: "dctap" })).toBe("DCTAP");
    expect(targetLabel({ to: "uml", format: "plantuml" })).toBe("UML diagram");
    expect(targetLabel({ to: "shacl", format: "ntriples" })).toBe("SHACL (N-Triples)");
  });

  it("knows which results can be the schema again", () => {
    expect(asSource({ to: "shex", format: "turtle" })).toEqual({ language: "shex", format: "turtle" });
    expect(asSource({ to: "shacl", format: "jsonld" })).toEqual({ language: "shacl", format: "jsonld" });
    expect(asSource({ to: "uml", format: "plantuml" })).toBeUndefined();
    expect(asSource({ to: "dctap", format: "internal" })).toBeUndefined();
    // ShExR in N3 is written, not read
    expect(asSource({ to: "shex", format: "n3" })).toBeUndefined();
  });
});
