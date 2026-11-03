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

// The examples of the tab, in a manifest (manifest.js, action: generate),
// which the Examples menu opens too. Each section is an example, written in
// the three languages over the RDF encoding of a property graph (they
// generate the same graph), and each entry of a section a kind of data: the
// configuration of the generator.
export const GENERATE_MANIFEST = "examples/generate/manifest.yml";

// The examples of the tab from the sections of its manifest (parseSections):
// [{ id, title, comment, kinds: [example] }], each example with its kind
export function generateCatalog(tree) {
  return tree
    .filter((item) => item.section)
    .map(({ section }) => ({ id: section.id, title: section.title, comment: section.comment, kinds: section.items.filter((item) => item.example).map((item) => item.example) }))
    .filter((section) => section.kinds.length);
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
