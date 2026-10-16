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

// Reads a schema in a rudof session (to check it, and to convert it after):
// source is { language, format, text, config }, where config is the
// configuration of rudof for DCTAP (its prefixes, see dctap.js).
export function readSchema(rudof, { language, format, text, config }) {
  rudof.resetAll();
  if (config) rudof.updateConfig(config);
  if (language === "shex") rudof.readShex(text, format);
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
