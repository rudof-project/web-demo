// The language of each format of the demo. Languages are loaded the first
// time they are needed, each from its own file of the build.
//
// The RDF syntaxes, ShExC and shape maps are stream parsers (tokens.js,
// turtle.js, shexc.js). YARS-PG (yars-pg/) and PGSchema (pgschema/) are Lezer
// grammars (.grammar files), which @lezer/generator compiles when the page
// is built (see vite.config.js).

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
  json: "json",
  shexc: "shexc",
  shapemap: "shapemap",
  sparql: "sparql",
  // The results of validations and queries: CSV, and tables drawn with
  // characters (compact, details…), which are plain text
  csv: "csv",
  // DCTAP profiles in CSV, and DCTAP as rudof writes it in JSON
  dctap: "dctap",
  "dctap-json": "json",
  // Property graphs (YARS-PG; compact is YARS-PG written by rudof), their
  // schemas (PGSchemaC) and type maps
  yarspg: "yarspg",
  compact: "yarspg",
  pgschema: "pgschema",
  typemap: "typemap",
};

const stream = (parser) => new LanguageSupport(StreamLanguage.define(parser));

const LOADERS = {
  turtle: async () => stream((await import("./turtle.js")).turtle),
  shexc: async () => stream((await import("./shexc.js")).shexc),
  shapemap: async () => stream((await import("./shexc.js")).shapemap),
  sparql: async () => stream((await import("@codemirror/legacy-modes/mode/sparql")).sparql),
  xml: async () => (await import("@codemirror/lang-xml")).xml(),
  json: async () => (await import("@codemirror/lang-json")).json(),
  // Lezer grammars, in their own folders
  dctap: async () => stream((await import("./dctap/index.js")).dctap),
  csv: async () => stream((await import("./csv.js")).csv),
  yarspg: async () => (await import("./yars-pg/index.js")).yarspg(),
  pgschema: async () => (await import("./pgschema/index.js")).pgschema(),
  typemap: async () => (await import("./pgschema/index.js")).typemap(),
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
