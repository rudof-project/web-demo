// The settings of rudof (settings.js): their values, the configuration they
// make, which rudof reads, and how the browser keeps them.

import { describe, it, expect } from "vitest";
import { parse } from "smol-toml";
import { Rudof, RudofConfig } from "@rudof/rudof";
import {
  SETTINGS,
  ALL_SETTINGS,
  settingValue,
  settingsConfig,
  configWithSettings,
  settingsEndpoints,
  mergeConfig,
  loadSettings,
  saveSettings,
  changedCount,
  emptySettings,
  SETTINGS_KEY,
} from "../../settings.js";
import { BASE_CONFIG, dctapConfig } from "../../dctap.js";

const setting = (key) => ALL_SETTINGS.find((s) => s.key === key);

// A storage of the browser, in memory
function memoryStorage() {
  const items = new Map();
  return {
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => items.set(k, String(v)),
    removeItem: (k) => items.delete(k),
    items,
  };
}

describe("SETTINGS", () => {
  it("has sections of settings with unique keys, labels and defaults", () => {
    const keys = ALL_SETTINGS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const section of SETTINGS) expect(section.title).toBeTruthy();
    for (const s of ALL_SETTINGS) {
      expect(s.label, s.key).toBeTruthy();
      expect(["boolean", "number", "text", "iri", "char", "select"]).toContain(s.type);
      if (s.type === "select") expect(s.options.map(([v]) => v)).toContain(s.default);
    }
  });

  it("are all read by rudof, with values that are not the defaults", () => {
    const values = {};
    for (const s of ALL_SETTINGS) {
      values[s.key] = s.type === "boolean" ? !s.default : s.type === "select" ? s.options.at(-1)[0] : s.type === "number" ? 10 : s.type === "char" ? ";" : s.type === "iri" ? "http://example.org/" : "x";
    }
    const toml = configWithSettings(BASE_CONFIG, { values, toml: "" });
    expect(() => new Rudof(RudofConfig.fromToml(toml))).not.toThrow();
  });
});

describe("settingValue", () => {
  it("reads numbers, characters and IRIs, and says what is wrong", () => {
    expect(settingValue(setting("shex_validator.max_steps"), "100")).toBe(100);
    expect(settingValue(setting("shex_validator.max_steps"), " ")).toBe("");
    expect(() => settingValue(setting("shex_validator.max_steps"), "abc")).toThrow(/whole number/);
    expect(() => settingValue(setting("tap.delimiter"), ";;")).toThrow(/one character/);
    expect(settingValue(setting("tap.delimiter"), ";")).toBe(";");
    expect(() => settingValue(setting("base_iri"), "not an iri")).toThrow(/not an IRI/);
    expect(settingValue(setting("base_iri"), " http://example.org/ ")).toBe("http://example.org/");
    expect(settingValue(setting("rdf.pretty_json"), false)).toBe(false);
  });
});

describe("settingsConfig", () => {
  it("has only the settings that are not the defaults", () => {
    expect(settingsConfig(emptySettings())).toEqual({});
    expect(settingsConfig({ values: { "rdf.pretty_json": true, "shex_validator.max_steps": "" }, toml: "" })).toEqual({});
    expect(settingsConfig({ values: { "shex_validator.max_steps": 5 }, toml: "" })).toEqual({ shex_validator: { max_steps: 5 } });
  });

  it("gives the base IRI to the sections that read IRIs", () => {
    expect(settingsConfig({ values: { base_iri: "http://example.org/" }, toml: "" })).toEqual({
      rdf: { base_iri: "http://example.org/" },
      shex: { base_iri: "http://example.org/" },
      service: { base_iri: "http://example.org/" },
    });
  });

  it("writes the three colors of shapes together", () => {
    expect(settingsConfig({ values: { "shex2uml.class_skin.border_color": "red" }, toml: "" }).shex2uml.class_skin).toEqual({
      background_color: "light_blue",
      border_color: "red",
      arrow_color: "black",
    });
  });

  it("puts the TOML over the fields", () => {
    const config = settingsConfig({ values: { "shex2uml.direction": "left_to_right" }, toml: '[shex2uml]\nline_type = "polyline"\ndirection = "top_to_bottom"\n' });
    expect(config.shex2uml).toEqual({ direction: "top_to_bottom", line_type: "polyline" });
  });
});

describe("configWithSettings", () => {
  it("puts the settings over the configuration of an operation", () => {
    const dctap = dctapConfig("PREFIX : <http://example.org/>");
    const toml = configWithSettings(dctap, { values: { base_iri: "http://other.example/", "tap.delimiter": ";" }, toml: "" });
    const config = parse(toml);
    expect(config.rdf.base_iri).toBe("http://other.example/");
    expect(config.tap.delimiter).toBe(";");
    // What the operation sets and the settings don't
    expect(config.tap2shex.prefixmap[""]).toBe("http://example.org/");
    expect(() => RudofConfig.fromToml(toml)).not.toThrow();
  });

  it("changes what rudof does", () => {
    const toml = configWithSettings(BASE_CONFIG, { values: { "shex2sparql.this_variable_name": "node" }, toml: "" });
    const rudof = new Rudof(RudofConfig.fromToml(toml));
    rudof.readShex("prefix : <http://example.org/>\n:P { :name . }");
    expect(rudof.convertSchemas(rudof.serializeCurrentShex("shexj"), "shex", "sparql", "shexj", "internal")).toContain("?node :name");
  });

  it("merges tables, and replaces values", () => {
    expect(mergeConfig({ a: { b: 1, c: 2 }, d: [1] }, { a: { c: 3 }, d: [2] })).toEqual({ a: { b: 1, c: 3 }, d: [2] });
  });
});

describe("settingsEndpoints", () => {
  it("are the endpoints of the TOML, with their prefixes", () => {
    const toml = '[rdf.endpoints.Mine]\nname = "My endpoint"\nquery_url = "https://mine.example/sparql"\n[rdf.endpoints.Mine.prefixmap]\nmine = "http://mine.example/"\n[rdf.endpoints.Bad]\nname = "No URL"\n';
    expect(settingsEndpoints({ values: {}, toml })).toEqual([["My endpoint", "https://mine.example/sparql", [["mine", "http://mine.example/"]]]]);
    expect(settingsEndpoints(emptySettings())).toEqual([]);
  });
});

describe("the settings that the browser keeps", () => {
  it("keeps only what differs from the defaults, and forgets the rest", () => {
    const storage = memoryStorage();
    saveSettings(storage, { values: { "rdf.pretty_json": true, "shex2uml.direction": "left_to_right" }, toml: "" });
    expect(JSON.parse(storage.getItem(SETTINGS_KEY))).toEqual({ values: { "shex2uml.direction": "left_to_right" }, toml: "" });
    expect(loadSettings(storage)).toEqual({ values: { "shex2uml.direction": "left_to_right" }, toml: "" });
    expect(changedCount(loadSettings(storage))).toBe(1);
    saveSettings(storage, emptySettings());
    expect(storage.items.has(SETTINGS_KEY)).toBe(false);
  });

  it("are the defaults when the browser has none, or can't read them", () => {
    expect(loadSettings(undefined)).toEqual(emptySettings());
    const storage = memoryStorage();
    storage.setItem(SETTINGS_KEY, "not JSON");
    expect(loadSettings(storage)).toEqual(emptySettings());
    storage.setItem(SETTINGS_KEY, JSON.stringify({ values: { unknown: 1 }, toml: "x = 1" }));
    expect(loadSettings(storage)).toEqual({ values: {}, toml: "x = 1" });
  });
});
