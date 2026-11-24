// The Compare tab: two RDF graphs, or two schemas, compared by rudof.
//
// RDF data (rudof 0.3.36, diffData): rudof tells the relation between the two
// graphs. It ignores the names of the blank nodes. The relation is isomorphic,
// equivalent (each graph contains the other), subgraph, supergraph or
// different. rudof also gives the triples of each graph that the other graph
// does not have. The mode tells how rudof can map the blank nodes of a graph
// to the terms of the other graph. rudof uses this map when it checks if a
// graph contains the other graph.
//
// Schemas (compareSchemas): rudof compares two shapes of two ShEx schemas,
// property by property, and writes a report. It does not say yet whether the
// schemas are equivalent, or one contains the other, and it cannot compare
// the other languages yet.

import { count } from "./text.js";
import { elementIn as el } from "./dom.js";
import { makeTableTools } from "./table-tools.js";
import { iriCode } from "./iri-links.js";

// The modes of the comparison of RDF graphs: [value, label, title]
export const DATA_MODES = [
  ["injective", "Injective", "Two blank nodes of a graph can't be mapped to the same term of the other graph"],
  ["homomorphic", "Homomorphic", "Two blank nodes of a graph can be mapped to the same term of the other graph"],
  ["entailment", "Entailment", "A blank node can be mapped to any term, also an IRI or a literal (simple entailment)"],
];

// The kinds of data and the languages of schemas that can be compared. The
// others are in the menus, and cannot be chosen.
export const DATA_KINDS = [
  ["rdf", "RDF", true],
  ["pg", "Property graph", false],
];
export const SCHEMA_LANGUAGES = [
  ["shex", "ShEx", true],
  ["shacl", "SHACL", false],
  ["dctap", "DCTAP", false],
  ["pgschema", "PGSchema", false],
];
// The formats of ShEx schemas that rudof compares: it cannot read ShExJ and
// ShExR for comparisons yet
export const SHEX_FORMATS = [
  ["shexc", "ShExC", true],
  ["shexj", "ShExJ", false],
  ["turtle", "ShExR (Turtle)", false],
];

const RELATIONS = {
  isomorphic: ["The graphs are isomorphic: they are the same graph, up to the names of their blank nodes", "ok"],
  equivalent: ["The graphs are equivalent: each one is contained in the other, but they are not isomorphic", "ok"],
  subgraph: ["The first graph is contained in the second one", "fail"],
  supergraph: ["The second graph is contained in the first one", "fail"],
  different: ["The graphs are different: neither one is contained in the other", "fail"],
};


// The verdict of a comparison of graphs (a GraphDiff of rudof), and its kind
export function dataVerdict(diff) {
  const [text, kind] = RELATIONS[diff.relation] ?? [`The graphs are ${diff.relation}`, "fail"];
  const differences = [];
  if (diff.onlyInFirst.length) differences.push(`${count(diff.onlyInFirst.length, "triple")} only in the first`);
  if (diff.onlyInSecond.length) differences.push(`${count(diff.onlyInSecond.length, "triple")} only in the second`);
  return { verdict: differences.length ? `${text} · ${differences.join(", ")}` : text, kind };
}

// The terms of a triple in N-Triples (without the final "."): subject,
// predicate and object. A triple term (<<( s p o )>>) is one term.
export function splitTriple(line) {
  const terms = [];
  let i = 0;
  const text = line.trim().replace(/\s*\.$/, "");
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i += 1;
      continue;
    }
    const start = i;
    if (text.startsWith("<<(", i)) {
      let depth = 0;
      for (; i < text.length; i++) {
        if (text.startsWith("<<(", i)) depth += 1;
        else if (text.startsWith(")>>", i) && --depth === 0) {
          i += 3;
          break;
        }
      }
    } else if (text[i] === "<") {
      i = text.indexOf(">", i) + 1 || text.length;
    } else if (text[i] === '"') {
      for (i += 1; i < text.length && text[i] !== '"'; i++) if (text[i] === "\\") i += 1;
      i += 1;
      // A language tag or a datatype
      if (text[i] === "@") while (i < text.length && !/\s/.test(text[i])) i += 1;
      else if (text.startsWith("^^<", i)) i = text.indexOf(">", i) + 1 || text.length;
    } else {
      while (i < text.length && !/\s/.test(text[i])) i += 1;
    }
    terms.push(text.slice(start, i));
  }
  return terms.length === 3 ? terms : [text, "", ""];
}

// An IRI of N-Triples (<…>) as a prefixed name, when a prefix ([alias, iri])
// has it, else as it is. The datatype of a literal too. The longest
// namespace wins, and the last prefix of the same namespace (those of the
// documents come after the common ones).
export function compactTerm(term, prefixes = []) {
  const compact = (iri) => {
    let best;
    for (const [alias, namespace] of prefixes) {
      if (namespace && iri.startsWith(namespace) && /^[A-Za-z_][\w-]*$|^$/.test(iri.slice(namespace.length)) && (!best || namespace.length >= best[1].length)) best = [alias, namespace];
    }
    return best ? `${best[0]}:${iri.slice(best[1].length)}` : `<${iri}>`;
  };
  const iri = term.match(/^<([^<>]*)>$/);
  if (iri) return compact(iri[1]);
  const typed = term.match(/^(".*")\^\^<([^<>]*)>$/s);
  if (typed) return `${typed[1]}^^${compact(typed[2])}`;
  return term;
}


// A table of the triples of each graph that the other graph does not have. You
// can sort and filter the table. Also the blank nodes of the first graph that
// match terms in the second graph. `prefixes`: those of the names of the IRIs.
export function differencesView(doc, diff, prefixes = []) {
  const box = el(doc, "div", { className: "compare-differences" });
  const rows = [
    ...diff.onlyInFirst.map((t) => ["First", t]),
    ...diff.onlyInSecond.map((t) => ["Second", t]),
  ];
  if (!rows.length) {
    box.append(el(doc, "p", { className: "hint" }, "No differences: each triple of a graph is in the other one."));
  } else {
    const cell = (term) => el(doc, "td", {}, iriCode(doc, compactTerm(term, prefixes), prefixes));
    const table = el(
      doc,
      "table",
      { className: "report compare-table" },
      el(doc, "thead", {}, el(doc, "tr", {}, ...["Only in", "Subject", "Predicate", "Object"].map((h) => el(doc, "th", {}, h)))),
      el(doc, "tbody", {}, ...rows.map(([graph, triple]) => el(doc, "tr", {}, el(doc, "td", {}, graph), ...splitTriple(triple).map(cell)))),
    );
    box.append(makeTableTools(table));
  }
  if (diff.firstToSecond.length) {
    box.append(
      el(doc, "p", { className: "hint compare-bnodes" }, `Blank nodes of the first graph matched in the second one${diff.exact ? "" : " (maybe not the best match: rudof stopped searching)"}:`),
      el(doc, "ul", { className: "compare-bnodes" }, ...diff.firstToSecond.map(([from, to]) => el(doc, "li", {}, el(doc, "code", {}, `${from} → ${compactTerm(to, prefixes)}`)))),
    );
  }
  return box;
}

// Changes a shape label to an IRI. The label is a prefixed name, an <iri> or
// an IRI, and the prefixes of its schema are [alias, iri]. Gives undefined
// when the label is empty.
export function shapeIri(label, prefixes = []) {
  const value = label.trim();
  if (!value) return undefined;
  const angle = value.match(/^<(.*)>$/);
  if (angle) return angle[1];
  if (/^[a-z][\w+.-]*:\/\//i.test(value)) return value;
  const prefixed = value.match(/^([A-Za-z][\w.-]*)?:(.*)$/);
  const namespace = prefixed && new Map(prefixes).get(prefixed[1] ?? "");
  if (namespace === undefined || namespace === null) throw new Error(`The prefix of the shape ${value} is not declared in its schema`);
  return namespace + prefixed[2];
}
