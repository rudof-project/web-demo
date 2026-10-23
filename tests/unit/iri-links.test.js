// The IRIs in the tables of results, as links (iri-links.js).

import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { iriOf, iriCode } from "../../iri-links.js";

const PREFIXES = [["wd", "http://www.wikidata.org/entity/"], ["", "http://example.org/"], ["urn", "urn:x:"]];

describe("iriOf", () => {
  it("is the IRI of a prefixed name, of <…>, or of an IRI as it is", () => {
    expect(iriOf("wd:Q5685", PREFIXES)).toBe("http://www.wikidata.org/entity/Q5685");
    expect(iriOf(":alice", PREFIXES)).toBe("http://example.org/alice");
    expect(iriOf("<https://example.org/a b>", PREFIXES)).toBeUndefined();
    expect(iriOf("<https://example.org/a>", PREFIXES)).toBe("https://example.org/a");
    expect(iriOf("https://example.org/a", PREFIXES)).toBe("https://example.org/a");
  });

  it("is nothing for literals, blank nodes, unknown prefixes and IRIs that are not http", () => {
    for (const text of ['"Alice"', '"1995-03-12"^^xsd:date', "_:b0", "23", "foo:bar", "urn:a", "<urn:x:y>", "sh:Violation", ""]) {
      expect(iriOf(text, PREFIXES), text).toBeUndefined();
    }
  });
});

describe("iriCode", () => {
  it("is the text of a cell, as a link to its IRI, which opens in another tab", () => {
    const doc = new JSDOM("").window.document;
    const link = iriCode(doc, "wd:Q5685", PREFIXES).querySelector("a");
    expect([link.textContent, link.getAttribute("href"), link.target, link.rel]).toEqual(["wd:Q5685", "http://www.wikidata.org/entity/Q5685", "_blank", "noopener"]);
    const text = iriCode(doc, '"Alice"', PREFIXES);
    expect([text.textContent, text.querySelector("a")]).toEqual(['"Alice"', null]);
  });
});
