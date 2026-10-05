// Manifests: YAML lists of examples, such as the one of shex.js
// (https://shex.js.org/doc/tests-manifest.yaml). The demo opened with
// ?manifestURL=<url of a manifest> lists its examples, and loads the one
// chosen into the editors.
//
// An entry gives each input of an example as text (`schema: |`) or as a URL
// (`schemaURL:`), relative to the manifest. The kind of example says which
// inputs it has, and where they go. For now there is one kind, ShEx, with the
// vocabulary of shex.js:
//
//   - schemaLabel: clinical observation     # examples are grouped by schema
//     schemaURL: ClinObs.shex               # or schema: | ...
//     dataLabel: the least an Observation can be
//     data: |                               # or dataURL: ...
//       <Obs1> :subject <Patient2> .
//     queryMap: <Obs1>@START                # or queryMapURL: ...
//     status: conformant                    # or nonconformant
//     comment: Shown when the example is chosen.
//
// SHACL and PGSchema examples will be other kinds, named with `type:`.

import { parse } from "yaml";

// The formats of the editors, by the extension of the file they are read from.
const RDF_EXTENSIONS = {
  ttl: "turtle", turtle: "turtle", nt: "ntriples", rdf: "rdfxml", xml: "rdfxml", owl: "rdfxml",
  jsonld: "jsonld", trig: "trig", n3: "n3", nq: "nquads",
};
const SHEX_EXTENSIONS = { shex: "shexc", shexc: "shexc", json: "shexj", shexj: "shexj", ttl: "turtle" };

// Each kind of example: the tab it is shown in (and the prefix of the ids of
// its validation), and its inputs: the name of the input in the manifest, the
// textarea it fills, and the select of its format with the formats of its file
// extensions (or the format of its text when it is inline) if the format can
// be chosen.
export const KINDS = {
  shex: {
    tab: "validate/shex",
    validator: "shex",
    inputs: [
      { name: "schema", textarea: "shex-schema", formatSelect: "shex-schema-format", extensions: SHEX_EXTENSIONS, inline: (text) => (/^\s*\{/.test(text) ? "shexj" : "shexc") },
      { name: "data", textarea: "shex-data", formatSelect: "shex-data-format", extensions: RDF_EXTENSIONS, inline: (text) => (/^\s*[[{]/.test(text) ? "jsonld" : "turtle") },
      { name: "queryMap", textarea: "shex-shapemap" },
    ],
  },
};

// Entries of shex.js that need something the demo doesn't have.
function unsupported(entry, kind) {
  if (!kind) return `examples of type "${entry.type}" are not supported yet`;
  if (entry.neighborhood) {
    const source = entry.endpoint ?? entry.base ?? entry.dataBase;
    return `reads its data from ${source ? `${source} ` : ""}as validation goes, which this demo can't do`;
  }
  const missing = kind.inputs.filter(({ name }) => entry[name] == null && entry[`${name}URL`] == null).map(({ name }) => name);
  if (missing.length) return `has no ${missing.join(" or ")}`;
  return undefined;
}

function text(value) {
  return value == null ? undefined : String(value);
}

// The examples of a manifest (its YAML text), with their URLs made absolute
// against the URL of the manifest. Each example has:
//   index      its position in the manifest
//   type       its kind (a key of KINDS)
//   group      what it is grouped by (the schema label)
//   label      its name in the list (the data label)
//   status     the result it should have, if the manifest says it
//   comment    the comment of the manifest
//   notes      what may differ from what the manifest expects
//   unsupported  why it can't be loaded, if it can't
//   inputs     { name: { text } or { url } } for each input it has
export function parseManifest(source, manifestURL) {
  const entries = parse(source);
  if (!Array.isArray(entries)) throw new Error("a manifest is a YAML list of examples");
  return entries.map((entry, index) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`entry ${index + 1} of the manifest is not a map of keys and values`);
    }
    const type = entry.type ?? "shex";
    const kind = KINDS[type];
    const inputs = {};
    for (const { name } of kind?.inputs ?? []) {
      if (entry[name] != null) inputs[name] = { text: text(entry[name]) };
      else if (entry[`${name}URL`] != null) inputs[name] = { url: new URL(text(entry[`${name}URL`]), manifestURL).href };
    }
    const notes = [];
    if (entry.plugins?.length) {
      const names = [].concat(entry.plugins).map((p) => String(p).split("/").pop().replace(/\.js$/, ""));
      notes.push(`Written for shex.js with ${names.join(", ")}: rudof may not run its semantic actions.`);
    }
    return {
      index,
      type,
      group: text(entry.schemaLabel ?? entry.label) ?? "",
      label: text(entry.dataLabel ?? entry.name) ?? `Example ${index + 1}`,
      status: text(entry.status),
      comment: text(entry.comment),
      notes,
      unsupported: unsupported(entry, kind),
      inputs,
    };
  });
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

const extension = (url) => new URL(url).pathname.split(".").pop().toLowerCase();

// The inputs of an example, read from their URLs if needed:
// [{ textarea, text, formatSelect, format }], in the order of KINDS.
export async function loadExample(example, fetchText = defaultFetchText) {
  if (example.unsupported) throw new Error(`This example ${example.unsupported}.`);
  const kind = KINDS[example.type];
  return Promise.all(
    kind.inputs.map(async ({ name, textarea, formatSelect, extensions, inline }) => {
      const input = example.inputs[name];
      const value = input.text ?? (await fetchText(input.url));
      const format = formatSelect ? (input.url ? extensions[extension(input.url)] : inline(value)) : undefined;
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
