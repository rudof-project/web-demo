// The conversions of the Schema tab: a schema in ShEx, SHACL, DCTAP or
// PGSchema, in one of its formats, converted to another format of its
// language, or to another language, a UML diagram or a SPARQL query.
//
// rudof converts some languages to others (SHACL and DCTAP to ShEx), and
// draws diagrams and writes queries from ShEx. So the conversions to ShEx,
// UML and SPARQL go through ShEx (ShExJ); the others are rudof writing the
// schema it read in another format. What rudof can't do yet is in
// CONVERSIONS, marked as not available, so that the page can show it.

// The languages of schemas, and their formats to read: [value, label]
export const LANGUAGES = {
  shex: {
    label: "ShEx",
    formats: [
      ["shexc", "ShExC"],
      ["shexj", "ShExJ"],
      ["turtle", "ShExR (Turtle)"],
      ["ntriples", "ShExR (N-Triples)"],
      ["rdfxml", "ShExR (RDF/XML)"],
      ["trig", "ShExR (TriG)"],
      ["nquads", "ShExR (N-Quads)"],
    ],
  },
  shacl: {
    label: "SHACL",
    formats: [
      ["turtle", "Turtle"],
      ["ntriples", "N-Triples"],
      ["rdfxml", "RDF/XML"],
      ["jsonld", "JSON-LD"],
      ["trig", "TriG"],
      ["n3", "N3"],
      ["nquads", "N-Quads"],
    ],
  },
  dctap: { label: "DCTAP", formats: [["dctap", "CSV"]] },
  pgschema: { label: "PGSchema", formats: [["pgschema", "PGSchemaC"]] },
};

// What a schema can be converted to, and its formats: [value, label,
// available]. A format that is not available is shown, and can't be chosen.
export const TARGETS = {
  shex: {
    label: "ShEx",
    formats: [
      ["shexc", "ShExC", true],
      ["shexj", "ShExJ", true],
      ["turtle", "ShExR (Turtle)", true],
      ["ntriples", "ShExR (N-Triples)", true],
      ["rdfxml", "ShExR (RDF/XML)", true],
      ["trig", "ShExR (TriG)", true],
      ["n3", "ShExR (N3)", true],
      ["nquads", "ShExR (N-Quads)", true],
    ],
  },
  shacl: {
    label: "SHACL",
    formats: LANGUAGES.shacl.formats.map(([value, label]) => [value, label, true]),
  },
  dctap: {
    label: "DCTAP",
    formats: [
      ["internal", "As rudof reads it", true],
      ["dctap-json", "JSON", true],
      ["dctap-csv", "CSV", false],
    ],
  },
  pgschema: {
    label: "PGSchema",
    formats: [
      ["pgschema-internal", "As rudof reads it", true],
      ["pgschemac", "PGSchemaC", false],
    ],
  },
  uml: { label: "UML diagram", formats: [["plantuml", "PlantUML", true]] },
  sparql: { label: "SPARQL query", formats: [["sparql", "SPARQL", true]] },
};

// What rudof can convert each language to
export const CONVERSIONS = {
  shex: ["shex", "uml", "sparql"],
  shacl: ["shacl", "shex", "uml", "sparql"],
  dctap: ["dctap", "shex", "uml", "sparql"],
  pgschema: ["pgschema"],
};

export function canConvert(from, to, format) {
  if (!CONVERSIONS[from]?.includes(to)) return false;
  if (format === undefined) return true;
  return TARGETS[to].formats.some(([value, , available]) => value === format && available);
}

// The target that a schema is converted to when it is chosen: another
// format, or ShEx
export const DEFAULT_TARGET = { shex: ["shex", "turtle"], shacl: ["shex", "shexc"], dctap: ["shex", "shexc"], pgschema: ["pgschema", "pgschema-internal"] };

const formatLabel = (formats, value) => formats.find(([v]) => v === value)?.[1] ?? value;

export function sourceLabel({ language, format }) {
  const { label, formats } = LANGUAGES[language];
  return formats.length > 1 ? `${label} (${formatLabel(formats, format)})` : label;
}

export function targetLabel({ to, format }) {
  const { label, formats } = TARGETS[to];
  return formats.length > 1 ? `${label} (${formatLabel(formats, format)})` : label;
}

// Whether a ShEx schema imports other schemas: IMPORT <iri> in ShExC,
// "imports" in ShExJ, shex:imports in ShExR (RDF)
export function hasShexImports(text, format) {
  if (format === "shexc") return /^\s*import\s*</im.test(text);
  if (format === "shexj") {
    try {
      const imports = JSON.parse(text).imports;
      return Array.isArray(imports) && imports.length > 0;
    } catch {
      return false;
    }
  }
  return /shex:imports\b|ns\/shex#imports>/.test(text);
}

// Whether a ShExC schema imports a schema by a relative IRI, which is
// resolved against the base of the schema
export const hasRelativeImports = (text) => /^\s*import\s*<(?![a-z][\w+.-]*:)/im.test(text);

// Why the schemas that a schema imports can't be read: rudof gets them with
// readShexAsync, which only rudof with endpoints has (it needs JSPI)
export const IMPORTS_NEED_ENDPOINTS =
  "This schema imports other schemas (IMPORT). rudof can get them only in browsers with JSPI (Chrome and Edge 137 or later), with rudof with endpoints, which this page could not load.";

// Reads a ShEx schema in a rudof session: with its imports (a promise, when
// it has imports), which rudof gets with fetch. `base` resolves relative
// imports.
export function readShexSchema(rudof, text, format, base) {
  if (!hasShexImports(text, format)) return rudof.readShex(text, format);
  if (typeof rudof.readShexAsync !== "function") throw new Error(IMPORTS_NEED_ENDPOINTS);
  return rudof.readShexAsync(text, format, base);
}

// Reads a schema in a rudof session (to check it, and to convert it after):
// source is { language, format, text, config, base }, where config is the
// configuration of rudof for DCTAP (its prefixes, see dctap.js), and base the
// base of the imports of a ShEx schema. A promise when a ShEx schema has
// imports.
export function readSchema(rudof, { language, format, text, config, base }) {
  rudof.resetAll();
  if (config) rudof.updateConfig(config);
  if (language === "shex") return readShexSchema(rudof, text, format, base);
  else if (language === "shacl") rudof.readShacl(text, format);
  else if (language === "dctap") rudof.readDctap(text, "csv");
  else if (language === "pgschema") rudof.readPgschema(text);
  else throw new Error(`unknown schema language: ${language}`);
}

// The ShEx schema (ShExJ) of the schema read in rudof
function toShexj(rudof, { language, format, text }) {
  if (language === "shex") return rudof.serializeCurrentShex("shexj");
  if (language === "shacl") return rudof.convertSchemas(rudof.serializeShacl("turtle"), "shacl", "shex", "turtle", "shexj");
  if (language === "dctap") return rudof.convertSchemas(text, "dctap", "shex", "csv", "shexj");
  throw new Error(`rudof can't convert ${LANGUAGES[language].label} to ShEx yet`);
}

// The schema read in rudof (readSchema), converted: text, or { plantuml } for
// a diagram. shexSession is another rudof session, for the ShEx schema that
// the conversions to ShEx, UML and SPARQL go through.
export function convertSchema(rudof, shexSession, source, { to, format }) {
  if (!canConvert(source.language, to, format)) {
    throw new Error(`rudof can't convert ${sourceLabel(source)} to ${targetLabel({ to, format })} yet`);
  }
  if (to === "shacl") return rudof.serializeShacl(format);
  if (to === "dctap") return rudof.serializeDctap(format === "dctap-json" ? "json" : "internal");
  if (to === "pgschema") return rudof.serializePgschema("compact");
  // A ShEx schema to ShEx or UML: from the schema read (with its imports)
  if (source.language === "shex" && to === "uml") return { plantuml: rudof.serializeCurrentShex("plantuml") };
  if (source.language === "shex" && to === "shex") return rudof.serializeCurrentShex(format);
  // ShEx, and what rudof makes from ShEx
  const shexj = toShexj(rudof, source);
  if (to === "sparql") return shexSession.convertSchemas(shexj, "shex", "sparql", "shexj", "internal");
  shexSession.resetAll();
  shexSession.readShex(shexj, "shexj");
  if (to === "uml") return { plantuml: shexSession.serializeCurrentShex("plantuml") };
  return shexSession.serializeCurrentShex(format);
}

// Whether a result (to, format) can be read back as a source: its language
// and format, or undefined
export function asSource({ to, format }) {
  const language = LANGUAGES[to];
  if (!language) return undefined;
  return language.formats.some(([value]) => value === format) ? { language: to, format } : undefined;
}
