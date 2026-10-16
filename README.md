# rudof demo

This repo contains the source code of the Web demo based on rudof-lib WebAssembly features

The demo converts RDF data and property graphs between formats, validates them
with ShEx, SHACL, DCTAP or PGSchema, and queries RDF data with SPARQL, all in the
browser. rudof ([`@rudof/rudof`](https://www.npmjs.com/package/@rudof/rudof))
and PlantUML are loaded from jsDelivr when the page runs; everything else is
built from this repo.

## Building the page

You need Node.js 22 (22.12 or later) and npm.

```sh
npm ci              # install the dependencies, as in package-lock.json
npm run dev         # serve the page at http://localhost:5173, reloaded on every change
npm run build       # build the page into dist/
npm run preview     # serve dist/ at http://localhost:4173
```

`dist/` is a static site: its paths are relative, so it can be published in
any folder of any web server, as is.

## Editors

The inputs of the demo are [CodeMirror 6](https://codemirror.net/) editors,
set up by [`codemirror-setup.js`](codemirror-setup.js):

- Each `<textarea data-editor>` of [`index.html`](index.html) is replaced by an
  editor when the page loads. The textarea stays, hidden, and stands for the
  editor, so [`demo.js`](demo.js) reads and sets `textarea.value` as before.
- The format of the text is fixed with `data-language="sparql"`, or chosen in a
  select of the page with `data-format-select="<id of the select>"`.
- The language of each format is in [`languages/index.js`](languages/index.js),
  and is loaded the first time it is needed. Turtle (also TriG, N-Triples,
  N-Quads and N3), ShExC and shape maps have their own parsers in
  [`languages/`](languages/); RDF/XML, JSON-LD, ShExJ and SPARQL use the
  CodeMirror packages.
- Property graphs, their schemas and type maps have
  [Lezer](https://lezer.codemirror.net/) grammars, each language in its own
  folder:
  - [`languages/yars-pg/`](languages/yars-pg/): YARS-PG
    (`yars-pg.grammar`). It reads the syntax of rudof (`pg.rustemo` of
    rudof's `pgschema` crate) and YARS-PG 5
    ([`YARSpg.ebnf`](https://github.com/lszeremeta/yarspg/blob/main/other-notations/YARSpg.ebnf)):
    metadata, variables, graphs, undirected edges, sets, structs,
    meta-properties and schemas.
  - [`languages/pgschema/`](languages/pgschema/): PGSchemaC
    (`pgschema.grammar`, from `pgs.rustemo`) and type maps
    (`typemap.grammar`, from `map.rustemo`).

  Each folder has the grammar, `highlight.js` (the highlighting tag of each
  node of the grammar) and `index.js` (the CodeMirror language, with folding
  and indentation). [`@lezer/generator`](https://www.npmjs.com/package/@lezer/generator)
  compiles the grammars when the page is built and tested (the `lezer()`
  plugin of `vite.config.js` and `vitest.config.js`). Text that does not
  follow the grammar is still shown; the highlighting goes on after it.
- The editors have line numbers, undo history, search (Ctrl+F), bracket
  matching and closing, and take the colors of the page, light or dark.
  Ctrl+Enter still validates.
- The results of conversions (RDF data, property graphs, and ShEx and SHACL
  schemas), of validations and of queries are shown in read-only editors,
  highlighted in the format chosen for the result. Results in CSV have a
  **CSV | Table** switch, to see them as a table; the browser remembers it. demo.js still writes the result in its `<pre>`, which is
  hidden, and the viewer follows it (`pre[data-viewer]`).

## DCTAP

The DCTAP tab of Validate reads a
[DCTAP](https://www.dublincore.org/specifications/dctap/) profile in CSV
(spreadsheets can be saved as CSV). The names of the profile are prefixed
names (`foaf:name`) or names without prefix (`Person`), so the tab also has
**Prefixes of the profile**, in Turtle syntax: `PREFIX foaf: <…>`, and
`BASE <…>` for the names without prefix. The basic prefixes of rudof (`rdf`,
`rdfs`, `xsd`, `sh`, `dc`) are always there. The values of picklists are
separated by spaces, as in DCTAP, or by `|`, as rudof does by default.
[`dctap.js`](dctap.js) turns the prefixes into the configuration of rudof
(TOML).

- **Validate** converts the profile to ShEx and validates the data with it,
  for the shape map. rudof can't convert DCTAP to SHACL yet: the SHACL
  option of **Validate with** is there for when it can.
- **Convert the profile to** ShEx (ShExC, ShExJ or ShExR), a UML diagram, a
  SPARQL query, or DCTAP as rudof reads it (text or JSON). SHACL will come
  with rudof.

The profile is highlighted by column ([`languages/dctap/`](languages/dctap/)):
the header names the column of each cell. The **CSV | Table** switch of the
profile shows it as a table ([`table-view.js`](table-view.js), with
[`csv.js`](csv.js)), whose cells can be edited: Enter goes to the cell below,
**Add row** and × add and delete rows, and each change is written back to
the CSV, which stays the input. The browser remembers the view.

## SPARQL endpoints

In the Query tab, the **Endpoint** field runs the query on a SPARQL endpoint
(Wikidata, DBpedia and UniProt are suggested) instead of the RDF data of the
page. Leave it empty to query the data.

rudof compiled to WebAssembly can't reach endpoints: its HTTP client waits
for each answer, which a browser page can't do. So
[`endpoint.js`](endpoint.js) sends the query itself, with the SPARQL 1.1
protocol (GET, or POST for long queries), and gives the results in the form
of the results of rudof. SELECT results show in the table (with the prefixes
of the query), as JSON (as the endpoint gave them) or as CSV. The graphs of
CONSTRUCT and DESCRIBE are read with rudof, so they can be written in every
RDF format.

The endpoint must allow other sites to query it
([CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)), as Wikidata
does, and the page (https) can't query an `http:` endpoint. Validation on
endpoints is not possible yet: the validators of rudof read the data as they
go, and that needs a change in rudof.

## Layout

[`layout.js`](layout.js) lets you arrange the boxes of every tab (Data,
Validate and Query):

- **Layout** menu, next to Permalink: the two boxes of a row side by side or
  one above the other, in their order or swapped (for example the result
  left of the data, or the schema above the data). The browser remembers the
  choice. On narrow screens the boxes are always one above the other.
- **Splitter**: side by side, drag the line between the two boxes to change
  their widths, or focus it (Tab) and use the arrow keys. A double click
  makes the widths equal again. The browser remembers the widths of each tab.
- **Heights**: drag the handle at the bottom right corner of an editor or a
  result.
- **Full screen**: the button at the top right of each editor and each
  result shows it on the whole window of the browser. The button again, or
  Esc, gives the normal size back. Ctrl+Enter still runs the tab.

## Examples

[`examples/`](examples/) has examples of every input format (RDF/XML, Turtle,
TriG, N-Triples, N-Quads, N3, JSON-LD, SPARQL, ShExC and ShExJ), to try the
editors with. The tests check that rudof accepts all of them.

## Manifests

The **Help** page of the demo ([`help.html`](help.html)) explains how to run
the examples of a manifest and documents the format of manifests, with an
example for each action and validation engine.

The page can list the examples of a manifest, a YAML file such as the one of
shex.js, and load the example chosen into the editors:

```
https://rudof-project.github.io/web-demo/?manifestURL=https://shex.js.org/doc/tests-manifest.yaml
```

[`manifest.js`](manifest.js) reads the manifest (it is loaded, with its YAML
parser, only when the page has a `manifestURL`). Each entry is an example, in
the vocabulary of shex.js:

```yaml
- schemaLabel: clinical observation   # the examples are grouped by schema
  schemaURL: ClinObs.shex             # or the schema itself: schema: |
  dataLabel: the least an Observation can be
  data: |                             # or dataURL:
    <Obs1> :subject <Patient2> .
  queryMap: <Obs1>@START              # the shape map, or queryMapURL:
  status: conformant                  # or nonconformant
  comment: Shown in the list of examples
```

Optional keys say what to do with an example. Without them, an entry is a
ShEx validation, as in the manifests of shex.js:

| Key | Values | Default |
|-----|--------|---------|
| `action` | `data` (load the data in the Data tab), `validate` (validate it in the Validate tab), `query` (run a query on it in the Query tab) | `validate` |
| `dataFormat` | an RDF format (`turtle`, `ntriples`, `rdfxml`, `jsonld`, `trig`, `n3`, `nquads`), or `yars-pg` for property graphs | `turtle` |
| `schemaFormat` | `shex` (ShExC), `shexj` or `json` (ShExJ), an RDF format (ShExR, or SHACL shapes; `json` is JSON-LD for SHACL), `pgschema`, or `csv` (DCTAP) | `shex` |
| `validationEngine` | `shex`, `shacl` or `pgschema` | `pgschema` for property graphs or `pgschema` schemas, otherwise `shex` |
| `query`, `queryURL` | the query, for `action: query` | |
| `queryFormat` | `sparql` | `sparql` |
| `queryEngine` | `sparql` | `sparql` |
| `endpoint` | the SPARQL endpoint the query runs on, instead of the data (then the data is optional) | |
| `typeMap`, `typeMapURL` | the type map of PGSchema (or `queryMap`) | |
| `schemaLanguage` (or `schemaEngine`) | `shex`, `shacl`, `pgschema` or `dctap`: the language of the schema. DCTAP profiles go to the DCTAP tab, which validates them with ShEx | `dctap` for CSV schemas (`schemaFormat: csv` or `.csv` files) |
| `prefixes`, `prefixesURL` | the prefixes of a DCTAP profile, as Turtle declarations (`PREFIX`, `BASE`) | |
| `picklistSeparator` | `space` or `"\|"`: the separator of the values of picklists in DCTAP | `space` |

```yaml
- dataLabel: Tim Berners Lee in RDF (SPARQL query)
  dataURL: ex01.ttl
  dataFormat: turtle
  queryURL: ex01.sparql
  action: query
- dataLabel: Tim Berners Lee as a property graph
  dataURL: ex02.pg
  dataFormat: yars-pg
  action: data
```

URLs are relative to the manifest. Without a format, the format of a file is
taken from its extension (`.shex`, `.json`, `.ttl`, `.nt`, `.jsonld`, `.pg`…),
and the one of inline text is the default (or JSON-LD and ShExJ for text that
starts with `{`). The list shows the `comment` of each example (or its
`dataLabel`, if it has no comment). Choosing an example opens the tab of its
action and loads its inputs; press the button of the tab (**Validate**,
**Run query**, **Convert**) to run it. When an
example is validated as loaded, the verdict says whether the result is the
one of its `status`. Examples that the demo can't run are listed but can't be
loaded; **Why … examples can't be run**, below the list, says why, with a
hint to change each entry and the entry as the demo read it. They are
those that read their data from a SPARQL endpoint or Wikidata as they are
validated (`neighborhood:`), queries on property graphs, and formats that
the tab can't read (such as TriX).
`&example=<n>` loads the n-th example (from 1) when the page opens; the URL
gets it when an example is chosen, so it can be shared. Choosing an example
also puts its inputs in the URL (see [Permalinks](#permalinks)); the
**Reload the examples** link, next to the list, opens the page again with
only `?manifestURL=…`.

The manifest and its files are read by the browser, so their server must allow
other sites to read them ([CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS));
GitHub Pages and raw.githubusercontent.com do. The tab of each action and
validation engine, and the formats it reads, are in `TARGETS` of
`manifest.js`.

## Permalinks

After each operation (converting, validating, running a query, changing a
result format, choosing a tab or an example), the query of the URL gets the
inputs and options of the tab shown, and the fragment names the tab:

```
?schema=PREFIX%20…&data=PREFIX%20…&shape-map=%3CObs1%3E%40START%0A&schema-format=shexc&…#validate/shex
```

The **Permalink** button writes the inputs as they are now in the URL, and
copies it. Opening the URL puts the inputs and options back in their tab.
[`permalink.js`](permalink.js) has the parameters of each tab:

| Tab      | Parameters |
|----------|------------|
| RDF      | `data`, `data-format`, `result-format` |
| Property graph | `data`, `result-format` |
| ShEx     | `schema`, `data`, `shape-map`, `schema-format`, `data-format`, `result-format`, `schema-result-format` |
| SHACL    | `shapes`, `data`, `shapes-format`, `data-format`, `mode`, `result-format`, `schema-result-format` |
| DCTAP    | `dctap`, `prefixes`, `picklist`, `data`, `shape-map`, `data-format`, `engine`, `result-format`, `schema-result-format` |
| PGSchema | `schema`, `data`, `type-map`, `result-format` |
| SPARQL   | `data`, `data-format`, `query`, `endpoint`, `result-format` |

`manifestURL` and `example` are kept. A URL without a fragment opens the tab
of its parameters (ShEx for `shape-map` or `schema`), so links in the style of
shex.js (`?schema=…&data=…&shape-map=…`) open the ShEx tab. When a URL has an
`example` and inputs too, the inputs of the URL are used: they are the example
as it was edited.

The inputs are sent to the server of the page with the URL, and servers limit
the length of URLs (often to about 8 KB), so very long inputs may not fit in
a permalink.

## Tests

```sh
npm test            # unit tests (Vitest, with jsdom)
npm run test:e2e    # the built page in Chromium (Playwright)
```

The browser tests build the page and serve it with `npm run preview`. rudof is
served to the page from `node_modules`, so they don't need the network. The
first time, install Chromium with:

```sh
npx playwright install --with-deps chromium
```

or use a Chromium you already have:

```sh
CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

`demo.js` loads the rudof version of `package.json` (the one the tests use),
so updating rudof is only a change of `package.json` and `package-lock.json`
(`npm install --save-dev --save-exact @rudof/rudof@<version>`).

## Publishing

The [GitHub Actions workflow](.github/workflows/gh-pages.yml) runs the tests
and builds the page on every push and pull request, and publishes `dist/` to
the `gh-pages` branch on every push to `main`.

[`update-rudof.yml`](.github/workflows/update-rudof.yml) updates `@rudof/rudof`
to its latest release on npm once a day (or when run by hand from the Actions
tab): it tests the update, pushes it to `main` and publishes the page. To
update the page as soon as rudof is released, rudof's release workflow can
send it a `repository_dispatch`, once the package is on npm:

```yaml
- uses: peter-evans/repository-dispatch@v3
  with:
    token: ${{ secrets.WEB_DEMO_TOKEN }}  # may write to rudof-project/web-demo
    repository: rudof-project/web-demo
    event-type: rudof-released
```
