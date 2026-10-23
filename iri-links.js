// The IRIs in the tables of results, as links: <http://…>, http://…, or a
// prefixed name (wd:Q42) of the prefixes the results were written with. The
// text of the cell stays as it is (sorting and filters read it); only http
// and https IRIs are links, which open in another tab.

// The IRI that a cell names, or undefined (a literal, a blank node…)
export function iriOf(text, prefixes = []) {
  const value = String(text ?? "").trim();
  const angle = value.match(/^<([^<>"\s]+)>$/);
  let iri = angle ? angle[1] : value;
  if (!angle && !/^https?:\/\//i.test(value)) {
    const prefixed = value.match(/^([A-Za-z][\w.-]*)?:([^\s<>"{}|^`\\]*)$/);
    if (!prefixed) return undefined;
    const namespace = new Map(prefixes).get(prefixed[1] ?? "");
    if (namespace === undefined) return undefined;
    iri = namespace + prefixed[2];
  }
  return /^https?:\/\/[^\s<>"]+$/i.test(iri) ? iri : undefined;
}

// A link to an IRI, with a text
export function iriLink(doc, iri, text = iri) {
  const a = Object.assign(doc.createElement("a"), { href: iri, textContent: text, className: "iri", target: "_blank", rel: "noopener" });
  a.title = iri;
  return a;
}

// The <code> of a cell: its text, as a link when it names an IRI
export function iriCode(doc, text, prefixes) {
  const code = doc.createElement("code");
  const iri = iriOf(text, prefixes);
  code.append(iri ? iriLink(doc, iri, text) : text);
  return code;
}
