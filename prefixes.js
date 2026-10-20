// Prefixes: the aliases of IRIs (wd: for http://www.wikidata.org/entity/)
// that the editors offer, and the endpoints that rudof knows declare.
//
// rudof describes each endpoint it knows in a TOML file of its repository
// (rudof_rdf/endpoints/<name>.toml): its name, its URL and its prefixes. The
// npm package of rudof doesn't have these files, nor a function that gives
// the prefixes, so the page reads the files of the version of rudof that it
// loads, from jsDelivr.

import { parse } from "smol-toml";

// Prefixes that are used in many schemas and queries
export const COMMON_PREFIXES = [
  ["rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#"],
  ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
  ["xsd", "http://www.w3.org/2001/XMLSchema#"],
  ["owl", "http://www.w3.org/2002/07/owl#"],
  ["sh", "http://www.w3.org/ns/shacl#"],
  ["shex", "http://www.w3.org/ns/shex#"],
  ["skos", "http://www.w3.org/2004/02/skos/core#"],
  ["dc", "http://purl.org/dc/elements/1.1/"],
  ["dct", "http://purl.org/dc/terms/"],
  ["foaf", "http://xmlns.com/foaf/0.1/"],
  ["schema", "http://schema.org/"],
  ["prov", "http://www.w3.org/ns/prov#"],
  ["dcat", "http://www.w3.org/ns/dcat#"],
  ["void", "http://rdfs.org/ns/void#"],
  ["wd", "http://www.wikidata.org/entity/"],
  ["wdt", "http://www.wikidata.org/prop/direct/"],
  ["ex", "http://example.org/"],
];

// The file of an endpoint that rudof knows, by its name (Wikidata_qlever:
// wikidata_qlever.toml), in the repository of rudof at a version
export function endpointFileURL(version, name) {
  return `https://cdn.jsdelivr.net/gh/rudof-project/rudof@${version}/rudof_rdf/endpoints/${name.toLowerCase()}.toml`;
}

// The prefixes of the TOML description of an endpoint, as [alias, iri]
export function prefixesOfEndpointToml(text) {
  return prefixesOfEndpoint(parse(text));
}

const prefixesOfEndpoint = (description) => Object.entries(description.prefixmap ?? {}).filter(([, iri]) => typeof iri === "string");

// The TOML description of an endpoint: its prefixes, as [alias, iri], and
// its keys (such as min_request_interval_ms, which says how often rudof can
// send it requests)
export function endpointToml(text) {
  const description = parse(text);
  return { prefixes: prefixesOfEndpoint(description), description };
}

// The prefixes declared in a text (Turtle, TriG, N3, ShExC or SPARQL): PREFIX
// and @prefix, in any case, as [alias, iri]
export function declaredPrefixes(text) {
  return [...text.matchAll(/^\s*@?prefix\s+([A-Za-z][\w.-]*)?:\s*<([^<>\s]*)>/gim)].map((m) => [m[1] ?? "", m[2]]);
}

// The declaration of a prefix in the style of the text: `@prefix x: <…> .`
// when it has those, else `PREFIX x: <…>` (or `prefix` when the text writes
// it in lower case). SPARQL and ShExC only have PREFIX.
export function declaration(text, alias, iri, { turtle = false } = {}) {
  if (turtle && /^\s*@prefix\s/im.test(text)) return `@prefix ${alias}: <${iri}> .`;
  const keyword = /^\s*prefix\s/m.test(text) ? "prefix" : "PREFIX";
  return `${keyword} ${alias}: <${iri}>`;
}

// Where a declaration goes: after the last line of the first block of
// declarations (PREFIX, @prefix, BASE, @base, comments and empty lines), or
// at the start of the text. The position, and whether it needs a new line
// before it.
export function declarationPosition(text) {
  const lines = text.split("\n");
  let offset = 0;
  let end = -1;
  for (const line of lines) {
    if (/^\s*@?(prefix|base)\s/i.test(line)) end = offset + line.length;
    else if (line.trim() && !line.trim().startsWith("#")) break;
    offset += line.length + 1;
  }
  return end < 0 ? { at: 0, newlineBefore: false } : { at: end, newlineBefore: true };
}
