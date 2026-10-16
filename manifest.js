// Manifests: YAML lists of examples, such as the one of shex.js
// (https://shex.js.org/doc/tests-manifest.yaml). The demo opened with
// ?manifestURL=<url of a manifest> lists its examples, and loads the one
// chosen into the editors.
//
// An entry gives each input of an example as text (`schema: |`) or as a URL
// (`schemaURL:`), relative to the manifest, in the vocabulary of shex.js:
//
//   - schemaLabel: clinical observation     # examples are grouped by schema
//     schemaURL: ClinObs.shex               # or schema: | ...
//     dataLabel: the least an Observation can be
//     data: |                               # or dataURL: ...
//       <Obs1> :subject <Patient2> .
//     queryMap: <Obs1>@START                # or queryMapURL: ...
//     status: conformant                    # or nonconformant
//     comment: The name of the example in the list.
//
// and with optional keys that say what to do with it (the defaults are those
// of shex.js manifests, which don't have them):
//
//     action: validate            # data (load the data), validate or query
//     dataFormat: turtle          # an RDF format, or yars-pg (property graphs)
//     schemaFormat: shex          # shex (ShExC), shexj, json, an RDF format
//                                 # (ShExR or SHACL), or pgschema
//     validationEngine: shex      # shex, shacl or pgschema
//     query: | ...                # or queryURL: ..., for action: query
//     queryFormat: sparql
//     queryEngine: sparql
//     endpoint: https://...       # the SPARQL endpoint the query runs on,
//                                 # instead of the data
//     typeMap: n1: PersonType     # or typeMapURL: ..., for PGSchema
//
// Without a format, the format is the one of the extension of the file, or
// the default. Without a validationEngine, PGSchema validates property graphs
// and PGSchema schemas, SHACL validates shapes (shapes: or shapesURL:) and
// schemas in an RDF format without a shape map, and ShEx everything else.
// help.html documents all of it for the users of the demo.

import { parse, stringify } from "yaml";

// Names of formats in manifests, and the format of the demo each one is.
const RDF_FORMATS = {
  turtle: "turtle", ttl: "turtle", ntriples: "ntriples", nt: "ntriples", "n-triples": "ntriples",
  rdfxml: "rdfxml", "rdf/xml": "rdfxml", jsonld: "jsonld", "json-ld": "jsonld",
  trig: "trig", n3: "n3", nquads: "nquads", nq: "nquads", "n-quads": "nquads",
};
const PG_FORMATS = { "yars-pg": "pg", yarspg: "pg", pg: "pg" };
const SHEX_FORMATS = { ...RDF_FORMATS, shex: "shexc", shexc: "shexc", shexj: "shexj", json: "shexj", jsonld: "shexj", "json-ld": "shexj" };
const SHACL_FORMATS = { ...RDF_FORMATS, json: "jsonld" };
const PGSCHEMA_FORMATS = { pgschema: "pgschema", pgschemac: "pgschema", pgs: "pgschema" };
const QUERY_FORMATS = { sparql: "sparql", rq: "sparql" };

// The formats of the files, by their extension.
const RDF_EXTENSIONS = {
  ttl: "turtle", turtle: "turtle", nt: "ntriples", rdf: "rdfxml", xml: "rdfxml", owl: "rdfxml",
  jsonld: "jsonld", trig: "trig", n3: "n3", nq: "nquads",
};
const PG_EXTENSIONS = { pg: "pg", ypg: "pg", yarspg: "pg" };
const SHEX_EXTENSIONS = { shex: "shexc", shexc: "shexc", json: "shexj", shexj: "shexj", ttl: "turtle", nt: "ntriples", rdf: "rdfxml", trig: "trig", nq: "nquads" };
const SHACL_EXTENSIONS = { ...RDF_EXTENSIONS, json: "jsonld" };
const PGSCHEMA_EXTENSIONS = { pgs: "pgschema", pgschema: "pgschema" };

// The format of inline text, guessed from its first character.
const rdfOf = (text) => (/^\s*[[{]/.test(text) ? "jsonld" : "turtle");
const shexOf = (text) => (/^\s*\{/.test(text) ? "shexj" : "shexc");

// The names of the formats of an input, for the hints of the entries that
// give another one
const RDF_NAMES = "turtle, ntriples, rdfxml, jsonld, trig, n3, nquads";

const rdfData = (textarea, formatSelect) => ({ name: "data", key: "dataFormat", textarea, formatSelect, formats: RDF_FORMATS, names: RDF_NAMES, extensions: RDF_EXTENSIONS, inline: rdfOf });
const pgData = (textarea) => ({ name: "data", key: "dataFormat", textarea, formats: PG_FORMATS, names: "yars-pg", extensions: PG_EXTENSIONS });

// Where the examples go: for each tab, its id in the URL fragment (and the
// prefix of the ids of its inputs and its result), the action it is for, and
// its inputs: the name of the input in the manifest (and other names it may
// have), the textarea it fills, the key of its format in the manifest and the
// formats that key can have, the formats of the file extensions, the select of
// the format if it can be chosen, and the format of inline text.
export const TARGETS = {
  rdf: { tab: "data/rdf", action: "data", what: "RDF data", inputs: [rdfData("rdf-data", "rdf-data-format")] },
  pg: { tab: "data/pg", action: "data", what: "property graphs", inputs: [pgData("pg-data")] },
  shex: {
    tab: "validate/shex",
    action: "validate",
    what: "ShEx",
    inputs: [
      { name: "schema", key: "schemaFormat", textarea: "shex-schema", formatSelect: "shex-schema-format", formats: SHEX_FORMATS, names: `shex, shexj, json, or an RDF format for ShExR (${RDF_NAMES})`, extensions: SHEX_EXTENSIONS, inline: shexOf },
      rdfData("shex-data", "shex-data-format"),
      { name: "queryMap", textarea: "shex-shapemap" },
    ],
  },
  shacl: {
    tab: "validate/shacl",
    action: "validate",
    what: "SHACL",
    inputs: [
      { name: "schema", aliases: ["shapes"], key: "schemaFormat", textarea: "shacl-shapes", formatSelect: "shacl-shapes-format", formats: SHACL_FORMATS, names: `an RDF format (${RDF_NAMES})`, extensions: SHACL_EXTENSIONS, inline: rdfOf },
      rdfData("shacl-data", "shacl-data-format"),
    ],
  },
  pgschema: {
    tab: "validate/pgschema",
    action: "validate",
    what: "PGSchema",
    inputs: [
      { name: "schema", key: "schemaFormat", textarea: "pgschema-schema", formats: PGSCHEMA_FORMATS, names: "pgschema", extensions: PGSCHEMA_EXTENSIONS },
      pgData("pgschema-data"),
      { name: "typeMap", aliases: ["queryMap"], textarea: "pgschema-typemap" },
    ],
  },
  sparql: {
    tab: "query/sparql",
    action: "query",
    what: "SPARQL",
    // The query runs on the data, or on the endpoint when there is one
    inputs: [
      { ...rdfData("sparql-data", "sparql-data-format"), optional: true },
      { name: "query", key: "queryFormat", textarea: "sparql-query", formats: QUERY_FORMATS, names: "sparql" },
      { name: "endpoint", textarea: "sparql-endpoint", optional: true },
    ],
  },
};

export const ACTIONS = ["data", "validate", "query"];
const VALIDATION_ENGINES = ["shex", "shacl", "pgschema"];
const QUERY_ENGINES = ["sparql"];

function text(value) {
  return value == null ? undefined : String(value);
}

const lower = (value) => text(value)?.trim().toLowerCase();

const extension = (url) => new URL(url).pathname.split(".").pop().toLowerCase();

// The validation engine of an entry without validationEngine: PGSchema for
// property graphs and PGSchemaC schemas; SHACL for shapes (shapes:), and for
// schemas in an RDF format without a shape map, which ShEx needs; else ShEx.
function defaultEngine(entry, isPg, manifestURL) {
  const schema = inputOf(entry, ["schema"], manifestURL);
  const ext = schema?.url ? extension(schema.url) : undefined;
  const format = lower(entry.schemaFormat);
  if (isPg || format in PGSCHEMA_FORMATS || (format == null && ext in PGSCHEMA_EXTENSIONS)) return "pgschema";
  if (inputOf(entry, ["shapes"], manifestURL)) return "shacl";
  const rdf = format != null ? format in RDF_FORMATS : ext in RDF_EXTENSIONS;
  if (rdf && !inputOf(entry, ["queryMap"], manifestURL)) return "shacl";
  return "shex";
}

// Why an entry can't be run: the reason (after "This example"), a hint on
// how to change the entry, and the section of help.html about it.
const problem = (reason, hint, help) => ({ reason, hint, help });

// The tab of an entry, or why there is none: { target } or { problem }.
function targetOf(entry, isPg, manifestURL) {
  const action = lower(entry.action) ?? "validate";
  if (!ACTIONS.includes(action)) {
    return { problem: problem(`has an unknown action "${entry.action}"`, `Write action: ${ACTIONS.join(", action: ")}, or leave it out to validate.`, "key-action") };
  }
  if (action === "data") return { target: isPg ? "pg" : "rdf" };
  if (action === "query") {
    const engine = lower(entry.queryEngine) ?? "sparql";
    if (!QUERY_ENGINES.includes(engine)) {
      return { problem: problem(`is for the query engine "${entry.queryEngine}", which this demo doesn't have`, `Write queryEngine: ${QUERY_ENGINES.join(", ")}, or leave it out.`, "keys") };
    }
    if (isPg) {
      return { problem: problem("queries a property graph, which this demo can't do yet", "The demo runs SPARQL queries on RDF data: give the data in an RDF format (dataFormat).", "example-query") };
    }
    return { target: engine };
  }
  // shex.js named kinds of examples with `type:`
  const engine = lower(entry.validationEngine ?? entry.type) ?? defaultEngine(entry, isPg, manifestURL);
  if (!VALIDATION_ENGINES.includes(engine)) {
    return {
      problem: problem(
        `is for the validation engine "${entry.validationEngine ?? entry.type}", which this demo doesn't have`,
        `Write validationEngine: ${VALIDATION_ENGINES.join(", validationEngine: ")}, or leave it out.`,
        "keys",
      ),
    };
  }
  return { target: engine };
}

// The input `name` of an entry: { text } or { url }.
function inputOf(entry, names, manifestURL) {
  for (const name of names) {
    if (entry[name] != null) return { text: text(entry[name]) };
    if (entry[`${name}URL`] != null) return { url: new URL(text(entry[`${name}URL`]), manifestURL).href };
  }
  return undefined;
}

// Whether the data of an entry is a property graph, by its format or the
// extension of its file.
function isPgData(entry, manifestURL) {
  const format = lower(entry.dataFormat);
  if (format != null) return format in PG_FORMATS;
  const input = inputOf(entry, ["data"], manifestURL);
  return Boolean(input?.url && extension(input.url) in PG_EXTENSIONS);
}

// The examples of a manifest (its YAML text), with their URLs made absolute
// against the URL of the manifest. Each example has:
//   index      its position in the manifest
//   action     data, validate or query
//   target     the tab it goes to (a key of TARGETS)
//   group      what it is grouped by (the schema label)
//   label      its name in the list: the comment, or else the data label
//   dataLabel  the data label
//   status     the result it should have, if the manifest says it
//   comment    the comment of the manifest
//   endpoint   the endpoint of its query, if it has one
//   notes      what may differ from what the manifest expects
//   unsupported  why it can't be loaded, if it can't
//   hint       how to change the entry so that it can be loaded
//   help       the section of help.html about it (its id)
//   source     the entry, written again in YAML, when it can't be loaded
//   inputs     { name: { text } or { url } } for each input it has
//   formats    { name: format } for the inputs whose format is known before
//              they are read (from the manifest or the file extension)
export function parseManifest(source, manifestURL) {
  const entries = parse(source);
  if (!Array.isArray(entries)) throw new Error("a manifest is a YAML list of examples");
  return entries.map((entry, index) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`entry ${index + 1} of the manifest is not a map of keys and values`);
    }
    const { target, problem: noTarget } = targetOf(entry, isPgData(entry, manifestURL), manifestURL);
    const { action, inputs: specs } = TARGETS[target] ?? { action: lower(entry.action) ?? "validate", inputs: [] };
    const inputs = {};
    const formats = {};
    const problems = [];
    for (const { name, aliases = [], key, formats: known, names, extensions } of specs) {
      const input = inputOf(entry, [name, ...aliases], manifestURL);
      if (!input) continue;
      inputs[name] = input;
      if (!key) continue;
      if (entry[key] != null) {
        formats[name] = known[lower(entry[key])];
        if (!formats[name]) problems.push({ key, value: entry[key], names });
      } else if (input.url) {
        formats[name] = extensions?.[extension(input.url)];
      }
    }
    const notes = [];
    if (entry.plugins?.length) {
      const names = [].concat(entry.plugins).map((p) => String(p).split("/").pop().replace(/\.js$/, ""));
      notes.push(`Written for shex.js with ${names.join(", ")}: rudof may not run its semantic actions.`);
    }
    const why = noTarget ?? unsupported(entry, target, inputs, problems);
    return {
      index,
      action,
      target,
      group: text(entry.schemaLabel ?? entry.label) ?? "",
      label: text(entry.comment ?? entry.dataLabel ?? entry.name) ?? `Example ${index + 1}`,
      dataLabel: text(entry.dataLabel ?? entry.name),
      status: text(entry.status),
      comment: text(entry.comment),
      endpoint: text(entry.endpoint),
      notes,
      unsupported: why?.reason,
      hint: why?.hint,
      help: why?.help,
      source: why ? stringify(entry, { lineWidth: 0 }) : undefined,
      inputs,
      formats,
    };
  });
}

// What to add for each input an entry doesn't have, and where help.html says it.
const MISSING = {
  data: ["Add the data, with data: (text) or dataURL: (a file).", "format"],
  schema: ["Add the schema, with schema: (text) or schemaURL: (a file).", "format"],
  queryMap: [
    "ShEx needs a shape map, with queryMap: or queryMapURL:, such as queryMap: \":alice@:Person\". If the schema is SHACL shapes, write validationEngine: shacl.",
    "example-shex",
  ],
  typeMap: ["PGSchema needs a type map, with typeMap: or typeMapURL:, such as typeMap: \"n1: PersonType\".", "example-pgschema"],
  query: ["Add the query, with query: (text) or queryURL: (a file).", "example-query"],
};

// Entries that need something the demo doesn't have.
function unsupported(entry, target, inputs, problems) {
  if (entry.neighborhood) {
    const source = entry.endpoint ?? entry.base ?? entry.dataBase;
    return problem(
      `reads its data from ${source ? `${source} ` : ""}as validation goes, which this demo can't do`,
      "The demo reads all the data before it validates: give the data with data: or dataURL:, instead of neighborhood:.",
      "unsupported",
    );
  }
  if (problems.length) {
    const what = TARGETS[target].what;
    return problem(
      `has ${problems.map(({ key, value }) => `a ${key} "${value}"`).join(" and ")} that ${what} can't use`,
      problems.map(({ key, names }) => `The ${key} of ${what} can be ${names}.`).join(" "),
      "keys",
    );
  }
  const missing = TARGETS[target].inputs.filter(({ name, optional }) => !optional && !inputs[name]).map(({ name }) => name);
  if (missing.length) return problem(`has no ${missing.join(" or ")}`, missing.map((name) => MISSING[name][0]).join(" "), MISSING[missing[0]][1]);
  if (target === "sparql" && !inputs.data && !inputs.endpoint) {
    return problem("has no data or endpoint to query", "Add the data (data: or dataURL:), or the endpoint: the query runs on.", "example-query");
  }
  return undefined;
}

// The examples in groups of consecutive examples with the same group name.
export function groupExamples(examples) {
  const groups = [];
  for (const example of examples) {
    const current = groups.at(-1);
    if (current && current.name === example.group) current.examples.push(example);
    else groups.push({ name: example.group, examples: [example] });
  }
  return groups;
}

// The inputs of an example, read from their URLs if needed:
// [{ textarea, text, formatSelect, format }], in the order of TARGETS. The
// optional inputs that the example doesn't have are empty.
export async function loadExample(example, fetchText = defaultFetchText) {
  if (example.unsupported) throw new Error(`This example ${example.unsupported}.`);
  return Promise.all(
    TARGETS[example.target].inputs.map(async ({ name, textarea, formatSelect, inline }) => {
      const input = example.inputs[name] ?? { text: "" };
      const value = input.text ?? (await fetchText(input.url));
      const format = formatSelect ? (example.formats[name] ?? inline(value)) : undefined;
      return { name, textarea, text: value, formatSelect, format };
    }),
  );
}

export async function defaultFetchText(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    // fetch says only "Failed to fetch", whatever the reason
    throw new Error(`could not read ${url} (is it online, and does its server allow other sites to read it, with CORS?)`, { cause: e });
  }
  if (!response.ok) throw new Error(`could not read ${url}: ${response.status} ${response.statusText}`.trim());
  return response.text();
}
