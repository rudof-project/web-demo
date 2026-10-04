// The language of each format of the demo. Languages are loaded the first
// time they are needed, each from its own file of the build.

import { LanguageSupport, StreamLanguage } from "@codemirror/language";

// Format (the values of the selects, and data-language) → language, or null
// for plain text.
export const FORMATS = {
  turtle: "turtle",
  ntriples: "turtle",
  nquads: "turtle",
  trig: "turtle",
  n3: "turtle",
  rdfxml: "xml",
  jsonld: "json",
  shexj: "json",
  shexc: "shexc",
  shapemap: "shapemap",
  sparql: "sparql",
  // Property graphs: no language yet
  yarspg: null,
  pgschema: null,
  typemap: null,
};

const stream = (parser) => new LanguageSupport(StreamLanguage.define(parser));

const LOADERS = {
  turtle: async () => stream((await import("./turtle.js")).turtle),
  shexc: async () => stream((await import("./shexc.js")).shexc),
  shapemap: async () => stream((await import("./shexc.js")).shapemap),
  sparql: async () => stream((await import("@codemirror/legacy-modes/mode/sparql")).sparql),
  xml: async () => (await import("@codemirror/lang-xml")).xml(),
  json: async () => (await import("@codemirror/lang-json")).json(),
};

export function languageOf(format) {
  return FORMATS[format] ?? null;
}

const loaded = new Map();

// The extension of the language of a format ([] for plain text).
export function loadLanguage(format) {
  const name = languageOf(format);
  if (!name) return Promise.resolve([]);
  if (!loaded.has(name)) {
    const loading = LOADERS[name]();
    loading.catch(() => loaded.delete(name)); // try again next time
    loaded.set(name, loading);
  }
  return loaded.get(name);
}
