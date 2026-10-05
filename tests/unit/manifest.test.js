// Manifests: the examples of a YAML manifest (?manifestURL=…), in the
// vocabulary of shex.js (https://shex.js.org/doc/tests-manifest.yaml).

import { describe, it, expect, vi } from "vitest";
import { Rudof } from "@rudof/rudof";
import { parseManifest, groupExamples, loadExample, KINDS } from "../../manifest.js";

const MANIFEST_URL = "https://example.org/doc/tests-manifest.yaml";

// Entries as shex.js writes them
const MANIFEST = `
# the validator's own examples
- schemaLabel: clinical observation
  schemaURL: ../examples/ClinObs.shex
  dataLabel: the least an Observation can be
  data: |
    PREFIX : <http://hl7.org/fhir/>
    <Obs1> :subject <Patient2> .
  queryMap: |
    <Obs1>@START
  status: conformant
  comment: 'Everything is optional but :subject.'
- schemaLabel: clinical observation
  schemaURL: ../examples/ClinObs.shex
  dataLabel: no subject
  dataURL: ../examples/no-subject.ttl
  queryMap: <Obs1>@START
  status: nonconformant
- schemaLabel: Wikidata person
  schemaURL: ../examples/wikidata-person.shex
  dataLabel: Q42 from the query service
  neighborhood: sparql
  dataBase: http://www.wikidata.org/entity/
  endpoint: https://query.wikidata.org/sparql
  queryMap: |
    <http://www.wikidata.org/entity/Q42>@START
  status: conformant
- schemaLabel: repeated properties
  schema: |
    PREFIX : <http://hl7.org/fhir/>
    <#S1> { :p [5] }
  dataLabel: passing data
  data: |
    PREFIX : <http://hl7.org/fhir/>
    <#n1> :p 5 .
  queryMap: |
    <#n1>@<#S1>
  status: conformant
- schemaLabel: BP
  plugins:
  - ../packages/extension-map/doc/ShExMapPlugin.js
  schemaURL: ../examples/BPfhir-schema.json
  dataLabel: simple
  dataURL: ../examples/BPfhir-instance.jsonld
  queryMap: "<tag:BPfhir123>@START"
  status: conformant
`;

const CLIN_OBS = `PREFIX : <http://hl7.org/fhir/>
start = @<ObservationShape>
<ObservationShape> { :subject IRI }`;

const NO_SUBJECT = `PREFIX : <http://hl7.org/fhir/>
<Obs1> :status "final" .`;

const FILES = {
  "https://example.org/examples/ClinObs.shex": CLIN_OBS,
  "https://example.org/examples/no-subject.ttl": NO_SUBJECT,
};
const fetchText = vi.fn(async (url) => {
  if (!(url in FILES)) throw new Error(`could not read ${url}: 404`);
  return FILES[url];
});

const examples = parseManifest(MANIFEST, MANIFEST_URL);

describe("parseManifest", () => {
  it("has an example for each entry, in order", () => {
    expect(examples.map((e) => e.index)).toEqual([0, 1, 2, 3, 4]);
    expect(examples.map((e) => e.label)).toEqual([
      "the least an Observation can be",
      "no subject",
      "Q42 from the query service",
      "passing data",
      "simple",
    ]);
  });

  it("takes the group, the status and the comment of each entry", () => {
    expect(examples[0]).toMatchObject({
      type: "shex",
      group: "clinical observation",
      status: "conformant",
      comment: "Everything is optional but :subject.",
    });
    expect(examples[1].status).toBe("nonconformant");
  });

  it("keeps inline inputs as text", () => {
    expect(examples[3].inputs.schema.text).toContain("<#S1> { :p [5] }");
    expect(examples[0].inputs.data.text).toBe("PREFIX : <http://hl7.org/fhir/>\n<Obs1> :subject <Patient2> .\n");
    expect(examples[1].inputs.queryMap.text).toBe("<Obs1>@START");
  });

  it("resolves URLs against the URL of the manifest", () => {
    expect(examples[0].inputs.schema).toEqual({ url: "https://example.org/examples/ClinObs.shex" });
    expect(examples[1].inputs.data).toEqual({ url: "https://example.org/examples/no-subject.ttl" });
  });

  it("marks the entries that read their data from an endpoint as not supported", () => {
    expect(examples[2].unsupported).toMatch(/query\.wikidata\.org/);
    expect(examples.filter((e) => e.unsupported).map((e) => e.index)).toEqual([2]);
  });

  it("notes the shex.js plugins an entry was written for", () => {
    expect(examples[4].notes.join()).toMatch(/ShExMapPlugin/);
    expect(examples[0].notes).toEqual([]);
  });

  it("does not support kinds of examples it does not know", () => {
    const [example] = parseManifest("- type: something-else\n  dataLabel: x\n", MANIFEST_URL);
    expect(example.unsupported).toMatch(/something-else/);
  });

  it("does not support entries without data", () => {
    const [example] = parseManifest("- schema: '<S> {}'\n  queryMap: '<n>@<S>'\n", MANIFEST_URL);
    expect(example.unsupported).toBe("has no data");
  });

  it("rejects YAML that is not a list of entries", () => {
    expect(() => parseManifest("schemaLabel: x\n", MANIFEST_URL)).toThrow(/list/);
    expect(() => parseManifest("- just a string\n", MANIFEST_URL)).toThrow(/entry 1/);
    expect(() => parseManifest("- [unclosed\n", MANIFEST_URL)).toThrow();
  });
});

describe("groupExamples", () => {
  it("groups consecutive examples of the same schema", () => {
    expect(groupExamples(examples).map((g) => [g.name, g.examples.length])).toEqual([
      ["clinical observation", 2],
      ["Wikidata person", 1],
      ["repeated properties", 1],
      ["BP", 1],
    ]);
  });
});

describe("loadExample", () => {
  const byName = (inputs) => Object.fromEntries(inputs.map((i) => [i.name, i]));

  it("reads the inputs given by URL, and keeps the inline ones", async () => {
    const inputs = byName(await loadExample(examples[0], fetchText));
    expect(inputs.schema).toMatchObject({ textarea: "shex-schema", text: CLIN_OBS, formatSelect: "shex-schema-format", format: "shexc" });
    expect(inputs.data).toMatchObject({ textarea: "shex-data", text: examples[0].inputs.data.text, format: "turtle" });
    expect(inputs.queryMap).toMatchObject({ textarea: "shex-shapemap", text: "<Obs1>@START\n" });
    expect(inputs.queryMap.format).toBeUndefined();
  });

  it("fills every textarea of its kind", async () => {
    const inputs = await loadExample(examples[1], fetchText);
    expect(inputs.map((i) => i.textarea)).toEqual(KINDS.shex.inputs.map((i) => i.textarea));
  });

  it("chooses the formats from the file extensions", async () => {
    const files = { "https://example.org/examples/BPfhir-schema.json": "{}", "https://example.org/examples/BPfhir-instance.jsonld": "{}" };
    const inputs = byName(await loadExample(examples[4], async (url) => files[url]));
    expect(inputs.schema.format).toBe("shexj");
    expect(inputs.data.format).toBe("jsonld");
  });

  it("refuses the examples it does not support", async () => {
    await expect(loadExample(examples[2], fetchText)).rejects.toThrow(/query\.wikidata\.org/);
  });

  it("says which file could not be read", async () => {
    const broken = parseManifest("- schemaURL: missing.shex\n  data: ''\n  queryMap: ''\n", MANIFEST_URL)[0];
    await expect(loadExample(broken, fetchText)).rejects.toThrow("https://example.org/doc/missing.shex");
  });
});

describe("the examples, validated by rudof", () => {
  it.each([[0, true], [1, false], [3, true]])("example %i conforms: %s", async (index, conforms) => {
    const inputs = Object.fromEntries((await loadExample(examples[index], fetchText)).map((i) => [i.name, i]));
    const rudof = new Rudof();
    rudof.readData(inputs.data.text, inputs.data.format);
    rudof.readShex(inputs.schema.text, inputs.schema.format);
    rudof.readShapemap(inputs.queryMap.text);
    expect(rudof.validateShex().conforms).toBe(conforms);
    expect(examples[index].status).toBe(conforms ? "conformant" : "nonconformant");
  });
});
