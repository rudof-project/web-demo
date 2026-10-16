// DCTAP (https://www.dublincore.org/specifications/dctap/): tabular
// application profiles, which rudof converts to ShEx. The names of DCTAP are
// prefixed names (foaf:name) or names without prefix (Person), so rudof needs
// the prefixes and the base IRI of the profile. The demo gives them as Turtle
// declarations,
//
//   BASE <http://example.org/>
//   PREFIX foaf: <http://xmlns.com/foaf/0.1/>
//
// which this module turns into the configuration of rudof (TOML).

// The style of the cells of each column of DCTAP (in lower case, as DCTAP
// headers are read in any case): for the highlighting of profiles
// (languages/dctap) and their table view (table-view.js)
export const COLUMNS = {
  shapeid: "typeName",
  shapelabel: "string",
  propertyid: "propertyName",
  propertylabel: "string",
  mandatory: "bool",
  repeatable: "bool",
  valuenodetype: "keyword",
  valuedatatype: "typeName",
  valueconstraint: "string",
  valueconstrainttype: "keyword",
  valueshape: "typeName",
  note: "comment",
  extends: "typeName",
};

// The class of the cells of a column of a profile in its table view
export const columnClass = (header) => `cell-${COLUMNS[String(header).trim().toLowerCase()] ?? "plain"}`;

// The prefixes that rudof knows without being told (PrefixMap::basic)
export const BASIC_PREFIXES = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  sh: "http://www.w3.org/ns/shacl#",
  dc: "http://purl.org/dc/elements/1.1/",
};

// The base IRI of the rest of rudof: there is no current directory to take it
// from in a browser.
const RUDOF_BASE = "http://base/";

// The base and the prefixes of Turtle declarations (PREFIX, @prefix, BASE,
// @base, in any case), and the lines that are not declarations.
export function parsePrefixes(text) {
  const prefixes = {};
  let base;
  const errors = [];
  text.split(/\r?\n/).forEach((line, i) => {
    // A comment starts with a # out of an IRI
    const code = line.replace(/^((?:[^#<]|<[^>]*>)*)#.*$/, "$1").trim();
    if (!code) return;
    const prefix = code.match(/^@?prefix\s+([A-Za-z][\w.-]*)?:\s*<([^<>\s]*)>\s*\.?$/i);
    if (prefix) {
      prefixes[prefix[1] ?? ""] = prefix[2];
      return;
    }
    const baseIri = code.match(/^@?base\s+<([^<>\s]*)>\s*\.?$/i);
    if (baseIri) {
      base = baseIri[1];
      return;
    }
    errors.push(`line ${i + 1}: "${code}" is not a PREFIX or BASE declaration`);
  });
  return { base, prefixes, errors };
}

const toml = (value) => JSON.stringify(value);

// The configuration of rudof (TOML) for a profile with these declarations:
// the base IRI of names without prefix, the prefixes (with the basic ones of
// rudof), and the separator of the values of picklists.
export function dctapConfig(declarations, { picklistSeparator = " " } = {}) {
  const { base, prefixes, errors } = parsePrefixes(declarations);
  if (errors.length) throw new Error(`The prefixes of the DCTAP profile can't be read: ${errors.join("; ")}`);
  const all = { ...BASIC_PREFIXES, ...prefixes };
  const separator = { picklist_delimiter: picklistSeparator };
  const lines = [
    // rudof only takes its base from the current directory when it is not set
    ...["rdf", "shex", "service"].flatMap((section) => [`[${section}]`, `base_iri = ${toml(RUDOF_BASE)}`, ""]),
    "[tap]",
    ...Object.entries(separator).map(([key, value]) => `${key} = ${toml(value)}`),
    "",
    "[tap2shex]",
    `base_iri = ${toml(base ?? prefixes[""] ?? "http://example.org/")}`,
    "",
    "[tap2shex.dctap]",
    ...Object.entries(separator).map(([key, value]) => `${key} = ${toml(value)}`),
    "",
    "[tap2shex.prefixmap]",
    ...Object.entries(all).map(([alias, iri]) => `${toml(alias)} = ${toml(iri)}`),
  ];
  return `${lines.join("\n")}\n`;
}
