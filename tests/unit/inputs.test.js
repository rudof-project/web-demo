// The component of the inputs of RDF data, schemas and queries (inputs.js).

import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { expandInput, expandInputs, inputsOf, visualOf, INPUT_KINDS } from "../../inputs.js";
import { RDF_FORMATS, LANGUAGES } from "../../schema-convert.js";

// A page with these fields
function page(fields) {
  return new JSDOM(`<body>${fields.map((f) => `<div class="field">${f}</div>`).join("")}</body>`).window.document;
}
const head = (doc, id) => doc.getElementById(id).previousElementSibling;
const optionsOf = (select) => [...select.options].map((o) => [o.value, o.textContent]);

describe("an input of RDF data", () => {
  it("has its label, the elements of its head, and the menu of the RDF formats", () => {
    const doc = page(['<span class="hint" id="x-unused" data-head hidden>Not used</span><textarea id="x-data" data-input="rdf" data-label="RDF data">:a :b :c .</textarea>']);
    expandInputs(doc);
    const textarea = doc.getElementById("x-data");
    expect(head(doc, "x-data").className).toBe("field-head");
    expect([...head(doc, "x-data").children].map((e) => e.id || e.tagName)).toEqual(["LABEL", "x-unused", "x-data-format"]);
    expect(doc.querySelector("label").htmlFor).toBe("x-data");
    expect(doc.querySelector("label").textContent).toBe("RDF data");
    const select = doc.getElementById("x-data-format");
    expect(optionsOf(select)).toEqual(RDF_FORMATS);
    expect(select.getAttribute("aria-label")).toBe("RDF data format");
    // The textarea becomes an editor, in the format of the menu
    expect(textarea.dataset.editor).toBe("");
    expect(textarea.dataset.formatSelect).toBe("x-data-format");
    expect(textarea.spellcheck).toBe(false);
    expect(textarea.value).toBe(":a :b :c .");
    expect(visualOf(textarea)).toBe("rdf");
  });

  it("is made once, and keeps the title of its label", () => {
    const doc = page(['<textarea id="t" data-input="rdf" data-label="Targets" data-label-title="Optional"></textarea>']);
    expandInputs(doc);
    expandInputs(doc);
    expect(doc.querySelectorAll(".field-head")).toHaveLength(1);
    expect(doc.querySelector("label").title).toBe("Optional");
  });
});

describe("an input of a schema", () => {
  it("has the formats of its language", () => {
    const doc = page([
      '<textarea id="s" data-input="schema" data-language="shex" data-label="ShEx schema"></textarea>',
      '<textarea id="sh" data-input="schema" data-language="shacl" data-label="Shapes graph"></textarea>',
    ]);
    expandInputs(doc);
    expect(optionsOf(doc.getElementById("s-format"))).toEqual(LANGUAGES.shex.formats);
    expect(optionsOf(doc.getElementById("sh-format"))).toEqual(RDF_FORMATS);
    // ShEx schemas are drawn; SHACL shapes graphs not (yet)
    expect(visualOf(doc.getElementById("s"))).toBe("shex");
    expect(visualOf(doc.getElementById("sh"))).toBeUndefined();
    // The editor follows the menu, not a fixed language
    expect(doc.getElementById("s").dataset.language).toBeUndefined();
  });

  it("with only one format, has it fixed, and says its name unless its label does", () => {
    const doc = page([
      '<textarea id="p" data-input="schema" data-language="pgschema" data-label="PGSchema"></textarea>',
      '<textarea id="d" data-input="schema" data-language="dctap" data-label="DCTAP profile" data-format-tag="none"></textarea>',
      '<textarea id="q" data-input="query" data-language="sparql" data-label="SPARQL query"></textarea>',
    ]);
    expandInputs(doc);
    expect(doc.getElementById("p").dataset.language).toBe("pgschema");
    expect(head(doc, "p").querySelector(".format-tag").textContent).toBe("PGSchemaC");
    expect(doc.getElementById("d").dataset.language).toBe("dctap");
    expect(head(doc, "d").querySelector(".format-tag")).toBeNull();
    expect(doc.getElementById("q").dataset.language).toBe("sparql");
    expect(head(doc, "q").querySelector(".format-tag, select")).toBeNull();
  });

  it("whose language the page chooses, has an empty menu, or the menu it names", () => {
    const doc = page([
      '<textarea id="c" data-input="schema" data-label="First schema" data-visual="shex"></textarea>',
      '<select id="lang" data-head></select><textarea id="g" data-input="schema" data-label="Schema" data-format-select="lang"></textarea>',
    ]);
    expandInputs(doc);
    expect(doc.getElementById("c-format").options).toHaveLength(0);
    expect(doc.getElementById("c").dataset.formatSelect).toBe("c-format");
    expect(visualOf(doc.getElementById("c"))).toBe("shex");
    expect(doc.getElementById("g").dataset.formatSelect).toBe("lang");
    expect([...head(doc, "g").children].map((e) => e.id || e.tagName)).toEqual(["LABEL", "lang"]);
    expect(doc.getElementById("g-format")).toBeNull();
  });
});

describe("the inputs of a page", () => {
  it("are listed by their kinds, in their order", () => {
    const doc = page([
      '<textarea id="a" data-input="rdf"></textarea>',
      '<textarea id="b" data-input="schema" data-language="shex"></textarea>',
      '<textarea id="c" data-input="query" data-language="sparql"></textarea>',
      '<textarea id="d" data-editor></textarea>',
    ]);
    expandInputs(doc);
    expect(inputsOf(doc, ...INPUT_KINDS)).toEqual(["a", "b", "c"]);
    expect(inputsOf(doc, "schema")).toEqual(["b"]);
    // A field made later (more RDF data)
    const more = Object.assign(doc.createElement("textarea"), { id: "e" });
    Object.assign(more.dataset, { input: "rdf", label: "RDF data" });
    doc.body.append(Object.assign(doc.createElement("div"), { className: "extra-data" }));
    doc.querySelector(".extra-data").append(more);
    expandInput(more);
    expect(doc.getElementById("e-format")).not.toBeNull();
  });
});
