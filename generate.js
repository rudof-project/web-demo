// Generate: synthetic data from a ShEx, SHACL or PGSchema schema (rudof
// generate), optionally with errors and the report of what a correct validator
// of the schema's language must flag. The data is validated with the schema
// it came from as soon as it is generated.

import { makeTableTools } from "./table-tools.js";

// The format of the schema editor (the values of #gen-language) → the
// language rudof generate reads, and the extension of the examples
export const GENERATE_LANGUAGES = { turtle: "shacl", shexc: "shex", pgschema: "pgschema" };
const EXTENSIONS = { turtle: "ttl", shexc: "shex", pgschema: "pgs" };
// The other way round: the language → the format of its examples
export const GENERATE_TARGETS = { shacl: "turtle", shex: "shexc", pgschema: "pgschema" };

// The examples say the same thing in the three languages, over the RDF
// encoding of the property graph, so they generate the same graph.
export const GENERATE_EXAMPLES = [
  ["references", "Persons, organisations and cities (references)"],
  ["keys", "Keys and values (required, optional, lists, dates)"],
  ["facets", "Value facets (pattern, ranges)"],
  ["labels", "Several labels (Person & Employee)"],
  ["lubm", "LUBM university (12 node types, 35 edge types)"],
  ["ldbc-snb", "LDBC Social Network (11 node types, cycles)"],
  ["custom", "Your own schema (a template)"],
];
const FILES = import.meta.glob("./examples/generate/*", { query: "?raw", import: "default" });

const CUSTOM = {
  turtle: `prefix : <http://example.org/>
prefix sh: <http://www.w3.org/ns/shacl#>
prefix xsd: <http://www.w3.org/2001/XMLSchema#>

:PersonShape a sh:NodeShape ; sh:targetClass :Person ;
  sh:property [ sh:path :name ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
  sh:property [ sh:path :age ; sh:datatype xsd:integer ; sh:minInclusive 18 ; sh:maxCount 1 ] ;
  sh:property [ sh:path :worksFor ; sh:node :OrgShape ; sh:minCount 1 ; sh:maxCount 1 ] .

:OrgShape a sh:NodeShape ; sh:targetClass :Org ;
  sh:property [ sh:path :label ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] .
`,
  shexc: `prefix : <http://example.org/>
prefix xsd: <http://www.w3.org/2001/XMLSchema#>

:Person {
  a [:Person] ;
  :name xsd:string ;
  :age xsd:integer MinInclusive 18 ? ;
  :worksFor @:Org
}
:Org {
  a [:Org] ;
  :label xsd:string
}
`,
  pgschema: `CREATE NODE TYPE ( PersonType : Person {
    name: STRING,
    OPTIONAL age: INTEGER CHECK >= 18
}) ;
CREATE NODE TYPE ( OrgType : Org {
    label: STRING
}) ;
CREATE EDGE TYPE (:@PersonType) -[WorksForType : worksFor]-> (:@OrgType)
`,
};

// The schema of an example in a format of the editor, or null when there is
// none (the template exists in the three languages)
export async function exampleSchema(example, format) {
  if (example === "custom") return CUSTOM[format] ?? null;
  const file = FILES[`./examples/generate/${example}.${EXTENSIONS[format]}`];
  return file ? await file() : null;
}

// The kinds of data, each a generator configuration (TOML, version 2). A
// property graph (from a PGSchema, or from an example written over its RDF
// encoding) also gets the report of its RDF copy, under PGSchema's closed
// records and required keys.
export const SCENARIOS = {
  valid: { label: "Valid data", config: () => `version = 2\n` },
  dense: {
    label: "Dense: every optional property, maximal cardinality",
    config: () => `version = 2\n\n[defaults]\nfill = 1.0\ncardinality = "max"\n`,
  },
  sparse: {
    label: "Sparse: optional properties on 10% of the nodes",
    config: () => `version = 2\n\n[defaults]\nfill = 0.1\n`,
  },
  coherence: {
    label: "Coherence 0.85 (searched over the fill)",
    config: () => `version = 2\n\n[targets]\ncoherence = 0.85\ntolerance = 0.01\n`,
  },
  errors: {
    label: "With errors (20%) and their report",
    config: (pg) =>
      `version = 2\n\n[violations]\nrate = 0.2\n` +
      (pg
        ? `\n# The RDF copy keeps PGSchema's closed records and required keys\n[violations.rdf]\nclosed = true\nkeys_required = true\n\n[output]\nformats = ["pg", "turtle"]\n`
        : ""),
  },
};

export function scenarioConfig(scenario, example, format) {
  return SCENARIOS[scenario].config(example !== "custom" || format === "pgschema");
}

const strip = (t) => (t ?? "").trim().replace(/^<(.*)>$/s, "$1");
const local = (t) => strip(t).replace(/^.*[/#]/, "");
const jsonl = (s) =>
  (s ?? "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

// The node/shape associations of a ShapeMap written by the generator
function associations(shapemap) {
  return shapemap
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.includes("@"))
    .map((a) => {
      const at = a.lastIndexOf("@");
      return { node: strip(a.slice(0, at)), shape: strip(a.slice(at + 1)) };
    });
}

// The generated data validated with the schema it came from: the failing
// nodes (and, for a property graph, edges), and the entries of the report
function validateGenerated(rudofModule, generated, language, schema) {
  if (language === "pgschema") {
    const rudof = new rudofModule.Rudof();
    try {
      rudof.readData(generated.propertyGraph, "pg");
      rudof.readPgschema(schema);
      rudof.readTypemap(generated.typeMap);
      const report = rudof.validatePgschema();
      return {
        validator: "PGSchema",
        failing: new Set(report.violations.map((e) => e.nodeId)),
        entries: report.entries.map((e) => ({ id: e.nodeId, type: e.typeName, conforms: e.conforms, details: e.details })),
      };
    } finally {
      rudof.free();
    }
  }
  if (language === "shacl") {
    const report = rudofModule.validateShacl(generated.data, schema);
    const violations = report.entries.filter((e) => e.severity === "Violation");
    return {
      validator: "SHACL",
      failing: new Set(violations.map((e) => strip(e.focusNode))),
      entries: violations.map((e) => ({
        id: strip(e.focusNode),
        type: local(e.sourceShape ?? ""),
        conforms: false,
        details: [e.path && `${local(e.path)}: `, e.messages.map((m) => m.text).join("; ") || local(e.constraintComponent)].join(""),
      })),
    };
  }
  const report = rudofModule.validateShex(generated.data, schema, generated.shapemap);
  return {
    validator: "ShEx",
    failing: new Set(report.violations.map((e) => strip(e.node))),
    entries: report.entries.map((e) => ({ id: strip(e.node), type: local(e.shape), conforms: e.status === "conformant", details: e.details ?? "" })),
  };
}

const plural = (n, word, words = `${word}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? word : words}`;

// Generates, validates and compares: the result of the tab (see run in demo.js)
export function generateData(rudofModule, { schema, format, config, entities, seed }) {
  if (typeof rudofModule.generate !== "function") {
    throw new Error("This version of rudof cannot generate data: generate comes with rudof 0.3.37.");
  }
  const language = GENERATE_LANGUAGES[format];
  const start = performance.now();
  const generated = rudofModule.generate(schema, language, config || undefined, entities, seed);
  const millis = performance.now() - start;
  return validateWith(rudofModule, { millis, generated, language, nodes: associations(generated.shapemap) }, language, schema);
}

// The generated data validated with a schema of one of the three languages
// (the one it came from, or the same example in another language), and what
// the validator rejects compared with the report of the generator
export function validateWith(rudofModule, result, language, schema) {
  const { generated, nodes } = result;
  const shapes = new Set(nodes.map((a) => a.shape)).size;
  const validation = validateGenerated(rudofModule, generated, language, schema);
  // What the validator must report: the property graph's report for PGSchema,
  // else the report of the RDF copy when the generator wrote one
  const labels = jsonl(language === "pgschema" ? generated.labels : (generated.rdfLabels ?? generated.labels));
  const expected = new Set(labels.filter((l) => l.kind !== "trap").map((l) => strip(l.node)));
  const what = language === "pgschema" ? ["node or edge", "nodes or edges"] : ["node", "nodes"];
  const head = `${plural(nodes.length, "node")} of ${plural(shapes, "shape")} generated`;
  let verdict;
  let kind;
  if (generated.labels) {
    const common = [...validation.failing].filter((n) => expected.has(n)).length;
    const exact = common === expected.size && common === validation.failing.size;
    verdict = exact
      ? `${head}, ${plural(expected.size, ...what)} broken: ${validation.validator} rejects exactly the ${expected.size} that the report says`
      : `${head}, ${plural(expected.size, ...what)} broken: ${validation.validator} rejects ${validation.failing.size}, ${common} of them in the report`;
    kind = exact ? "ok" : "fail";
  } else {
    verdict = validation.failing.size
      ? `${head}: ${plural(validation.failing.size, ...what)} do not conform to the schema (${validation.validator})`
      : `${head}: valid, every ${what[0]} conforms to the schema (${validation.validator})`;
    kind = validation.failing.size ? "fail" : "ok";
  }
  return { ...result, verdict, kind, labels, validation, validatedWith: language };
}

const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
};

function table(headers, rows) {
  return makeTableTools(
    el("table", { className: "report" }, el("thead", {}, el("tr", {}, ...headers.map((h) => el("th", {}, h)))), el("tbody", {}, ...rows)),
  );
}

// The view of the result chosen in #gen-result-format: a text, or a table
export function serializeGenerated(result, view) {
  const { generated, labels, validation } = result;
  switch (view) {
    case "summary": {
      const row = (what, value) => el("tr", {}, el("td", {}, what), el("td", { className: "number" }, value));
      const count = (n) => n.toLocaleString("en-US");
      const rows = [row("Nodes generated", count(result.nodes.length))];
      if (generated.propertyGraph) {
        const lines = generated.propertyGraph.split("\n").filter((l) => l.trim());
        const edges = lines.filter((l) => l.includes(")->")).length;
        rows.push(row("Property graph: nodes / edges", `${count(lines.length - edges)} / ${count(edges)}`));
      }
      if (generated.labels) {
        const broken = labels.filter((l) => l.kind !== "trap");
        rows.push(row("Report: rejected (direct, induced) / traps", `${count(broken.length)} (${count(broken.filter((l) => l.kind === "direct").length)}, ${count(broken.filter((l) => l.kind === "induced").length)}) / ${count(labels.length - broken.length)}`));
      }
      rows.push(row(`${validation.validator} rejects`, count(validation.failing.size)));
      rows.push(row("Generation time", `${Math.max(1, Math.round(result.millis)).toLocaleString("en-US")} ms`));
      const perShape = new Map();
      for (const { shape } of result.nodes) perShape.set(local(shape), (perShape.get(local(shape)) ?? 0) + 1);
      for (const [shape, n] of [...perShape].sort((a, b) => b[1] - a[1])) rows.push(row(el("span", {}, "Nodes of ", el("code", {}, shape)), count(n)));
      return table(["", ""], rows);
    }
    case "turtle":
      return generated.data;
    case "yarspg":
      return generated.propertyGraph ?? "No property graph: the data was generated from a ShEx or SHACL schema of its own.";
    case "typemap":
      return generated.typeMap ?? "No type map: the data has no property graph.";
    case "shapemap":
      return generated.shapemap.split(",").map((s) => s.trim()).join(",\n");
    case "report":
      if (!generated.labels) return "No error report: choose the kind of data “With errors (20%) and their report”.";
      return table(
        ["Node or edge", "Shape or type", "Kind", "Error", "Property"],
        labels.map((l) =>
          el(
            "tr",
            { className: l.kind === "trap" ? "ok" : "fail" },
            el("td", {}, el("code", {}, local(l.node))),
            el("td", {}, el("code", {}, local(l.shape))),
            el("td", {}, l.kind),
            el("td", {}, l.operator ?? (l.cause ? `through ${local(l.cause)}` : "")),
            el("td", {}, el("code", {}, local(l.property))),
          ),
        ),
      );
    case "validation":
      if (!validation.entries.length) return `${validation.validator}: no violations.`;
      return table(
        ["Id", "Shape or type", "Result", "Details"],
        validation.entries.map((e) =>
          el(
            "tr",
            { className: e.conforms ? "ok" : "fail" },
            el("td", {}, el("code", {}, local(e.id))),
            el("td", {}, el("code", {}, e.type)),
            el("td", { className: "verdict-cell" }, e.conforms ? "✓ conforms" : "✗ fails"),
            el("td", {}, el("div", { className: "details" }, e.details)),
          ),
        ),
      );
    default:
      return "";
  }
}

// The file of a view of the result, to download it
export function generatedFile(result, view) {
  const { generated, validation } = result;
  const labels = result.validatedWith === "pgschema" ? generated.labels : (generated.rdfLabels ?? generated.labels);
  return {
    turtle: ["data.ttl", generated.data],
    yarspg: ["data.pg", generated.propertyGraph],
    typemap: ["data.typemap", generated.typeMap],
    shapemap: ["shapemap.txt", generated.shapemap],
    report: ["labels.jsonl", labels],
    validation: ["validation.json", JSON.stringify(validation.entries, null, 2)],
  }[view] ?? ["data.ttl", generated.data];
}
