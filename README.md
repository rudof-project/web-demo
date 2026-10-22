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
- The editors of Turtle (TriG, N3), ShExC and SPARQL complete prefixes
  ([`prefix-completion.js`](prefix-completion.js)): after `PREFIX` (or
  `@prefix`), the declarations of the prefixes known; in the text, their
  aliases (`wd:`), and choosing one that the text doesn't declare also adds
  its declaration, with the others, in the style of the text. The prefixes
  known are those of the text, those of the endpoint of the tab, and common
  ones ([`prefixes.js`](prefixes.js)). Ctrl+Space shows them.
- The results of conversions (RDF data, property graphs, and ShEx and SHACL
  schemas), of validations and of queries are shown in read-only editors,
  highlighted in the format chosen for the result. Results in CSV have a
  **CSV | Table** switch, to see them as a table; the browser remembers it. demo.js still writes the result in its `<pre>`, which is
  hidden, and the viewer follows it (`pre[data-viewer]`).

## Schema

The **Schema** section (between Data and Validate) converts a schema in
ShEx, SHACL, DCTAP or PGSchema, in one of its formats, to another format, to
another schema language, to a UML diagram or to a SPARQL query.
[`schema-convert.js`](schema-convert.js) has what each language converts to:

| From \ To | ShEx | SHACL | DCTAP | PGSchema | UML | SPARQL |
|---|---|---|---|---|---|---|
| ShEx | ✓ | – | – | – | ✓ | ✓ |
| SHACL | ✓ | ✓ | – | – | ✓ | ✓ |
| DCTAP | ✓ | – | ✓ | – | ✓ | ✓ |
| PGSchema | – | – | – | ✓ | – | – |

The conversions to ShEx, UML and SPARQL go through ShEx (ShExJ); SHACL,
DCTAP and PGSchema are written again as rudof reads them (DCTAP as text or
JSON, PGSchema as text: rudof 0.3.25 can't write DCTAP CSV or PGSchemaC yet).
What rudof can't do yet (–) is in the menus, marked "not in rudof yet", and
can't be chosen. A DCTAP profile has its prefixes and its table view, as in
the DCTAP tab of Validate. **Use as input** reads the result as the schema,
when it is a schema in a format the tab reads.

## ShEx imports

A ShEx schema can import other schemas (`IMPORT <iri>` in ShExC, `imports`
in ShExJ). Since rudof 0.3.31, rudof with endpoints gets them with `fetch`
(`readShexAsync`, which goes through `setFetch` too), so the page reads a
schema with imports with it ([`schema-convert.js`](schema-convert.js),
`readShexSchema`): in the ShEx tab (validations, also on endpoints, and
**Convert schema**) and in the Schema tab. Schemas without imports are read
as before (`readShex`). While rudof gets the imports, the result says
"Reading the imported schemas…". A schema with imports is read in a new
session: a session that waits can't do anything else.

- The servers of the imported schemas must allow other sites to read them
  ([CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)).
- Relative imports (`IMPORT <book.shex>`) are relative to the file of the
  schema, when it is the schema of an example of a manifest.
- What rudof writes keeps the imports (`IMPORT`, `imports`): ShEx in other
  formats, and UML diagrams, are written from the schema read, with its
  imports. Conversions that read the schema again (ShEx to SPARQL) can't get
  the imports yet.
- Only rudof with endpoints has `readShexAsync` (it needs JSPI): in Firefox
  and Safari, the page says that the imports need it.

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

In the SPARQL, ShEx, SHACL and DCTAP tabs, the **Endpoint** field runs the
query or the validation on a SPARQL endpoint instead of the RDF data of the
page. Its menu has **None** (the RDF data of the page), the endpoints that
rudof knows (Wikidata, DBpedia, UniProt, …) and **Other**, to write the URL
of any other endpoint in the field next to it.

rudof goes to the endpoint: `useEndpoint`, then `runQueryAsync`,
`validateShexAsync` or `validateShaclAsync`. ShEx asks the endpoint for the
data of each node of the shape map, and SHACL for the data of its targets.
The page describes the endpoint to rudof (`endpointConfig` in
[`endpoint.js`](endpoint.js)) with the prefixes of the schema, so the shape
map can use them: the data of an endpoint has no prefixes.

Under the field, **Prefixes of …** lists the prefixes that rudof declares
for the endpoint (in `rudof_rdf/endpoints/<name>.toml` of its repository,
which the page reads from jsDelivr for the version of rudof it loads: the
npm package doesn't have them), or that the settings give it. The editors
of the tab offer them, and the validations on the endpoint can use them in
their shape maps, with the prefixes of the schema.

**With the RDF data**, next to the field, also uses the RDF data of the tab:
rudof merges it with the data of the endpoint (`useEndpoint`, then
`readData` with `merge`), so a validation or a query sees both. SPARQL
`SERVICE` to an endpoint is not available: rudof says that the service is
not supported.

This needs rudof built with the `endpoints` feature (`@rudof/rudof/endpoints`,
in the package since rudof 0.3.27), and its WebAssembly needs JSPI
(JavaScript Promise Integration): Chrome and Edge 137 or later have it,
Firefox and Safari don't yet. So the page loads
`@rudof/rudof@<version>/endpoints/web/rudof_wasm.js` in browsers with JSPI,
and the usual `web/` build in the others, or when it can't be loaded. The
status line says "with endpoints" when it has them. When rudof with
endpoints can't be loaded in a browser with JSPI, the hint of the Endpoint
fields says why (as does the tooltip of the status line).
Without them, the page sends SPARQL queries to the endpoint itself
([`endpoint.js`](endpoint.js), with the SPARQL 1.1 protocol), and the
validations can't use endpoints.

### The queries to the endpoint

While a run waits for an endpoint, the result shows its queries: how many
were sent, answered, waiting and failed, the time of the run (in the head of
the result), the limits of the requests, **Stop**, and a table of the
queries, the last one first. The table has, for each query, when it was sent,
the status of the answer, how long it took, its size, the nodes it asks about
(rudof asks about several nodes of a shape map in one query, with `VALUES`)
and the query. A click on a query shows all of it, the endpoint and the start
of the answer (at most 4000 characters; JSON indented). **Stop** aborts the
queries that wait, and stops the run. After the result, the switch
**Result | Queries (n)** of the result goes from one to the other, also when
the run fails or is stopped.

rudof has no logs in WebAssembly, so the page gets the requests from the
function that rudof uses to send them (`setFetch`):
[`endpoint-log.js`](endpoint-log.js) sends them with `fetch` and logs them. The
query of the SPARQL tab that the page sends itself (without rudof with
endpoints) is shown too. rudof counts the requests of a session
(`requestCount`), but can't say it while the session waits, so the page says
it after the run, when it differs from the list (the list can have the
queries of other tabs that run at the same time).

### The limits of the requests

rudof 0.3.29 waits between two requests to an endpoint, so that public
endpoints such as Wikidata don't block it, and asks about the nodes of a shape
map in batches. The **Endpoints** section of the settings (also **Options**,
next to the Endpoint field) changes this, in `[rdf]` of the configuration:

- **Milliseconds between two requests** (`min_request_interval_ms`): 1100 by
  default, 0 for `localhost`. 0 doesn't wait. rudof still waits longer when
  an endpoint answers `429 Too Many Requests`, and sends a query again when
  the answer is 429, 502, 503 or 504, at most 3 times.
- **Requests at the same time** (`max_concurrent_requests`, 1 by default):
  when rudof gets the nodes of a shape map before it validates them.
- **Nodes in one query** (`max_nodes_per_query`, 20 by default; 1 sends a
  query for each node).
- **How SHACL gets the data of an endpoint** (`[shacl] fetch_strategy`,
  rudof 0.3.30): node by node, when the validation needs it (`on-demand`,
  the default), or shape by shape before the validation (`by-shape`), with
  the data of many focus nodes in one query: far fewer requests when there
  are many focus nodes. With `by-shape`, **nodes in one query**
  (`prefetch_batch_size`, 50 by default) and **the depth of the data fetched
  before** (`prefetch_max_rounds`, 16 shape references by default, from the
  shapes with targets; deeper data is fetched when the validation needs it).
- **How validations get the data of the nodes**: SPARQL queries (the
  default), or the RDF of the IRIs of the nodes (`dereference`, the strategy
  of `useEndpoint`), which needs servers that allow other sites to read them
  (CORS), and https IRIs. The SPARQL tab always queries the endpoint.

The endpoints that rudof knows have their own limits in their TOML files
(such as `min_request_interval_ms = 1100` of Wikidata), and so can the
endpoints of the settings (`[rdf.endpoints.<name>]`). The page gives them to
rudof with the description of the endpoint (`endpointConfig`), so they win
over the settings, as in rudof: Wikidata keeps 1100 ms when the settings say
0. The result shows the limits of each run (and, in the SHACL tab, how SHACL
gets the data).

SELECT results show in the table (with the prefixes of the query), as JSON
or as CSV. The graphs of CONSTRUCT and DESCRIBE can be written in every RDF
format.

The endpoint must allow other sites to query it
([CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)), as Wikidata
does, and the page (https) can't query an `http:` endpoint.

The browser tests run with both builds of rudof: with endpoints (from
`endpoints/web/` of the package) and without them. To test another build of
rudof with endpoints, such as one built from the rudof repository, give its
folder in `RUDOF_ENDPOINTS_DIR`:

```sh
RUDOF_ENDPOINTS_DIR=<folder with rudof_wasm.js and rudof_wasm_bg.wasm> npm run test:e2e
```

## Header and theme

The header of the demo and of the help page ([`header.js`](header.js)) has
**Examples** (the examples of the
[ISWC 2026 tutorial](./?manifestURL=https%3A%2F%2Fraw.githubusercontent.com%2Fvalidatingrdf%2FTutorial%2Frefs%2Fheads%2Fmaster%2FISWC_2026%2Fmanifest.yml),
and how to write a manifest of your own), **Help**, and **About** (the
manual of rudof, rudof and this demo on GitHub, the npm package, and the
versions: the rudof that the page loads, and the version of the demo, in
[`VERSION`](VERSION), with its commit, which the build takes from
`GITHUB_SHA` or from git). Examples and About are
`<details>` menus, which open without JavaScript too.

Next to them, the theme (the sun or the moon): **As the system**,
**Light** or **Dark**. The browser keeps it, and an inline script in the
`<head>` of the pages applies it before they are drawn. The dark colors are
those of `:root[data-theme="dark"]` in [`demo.css`](demo.css), and of the
system when no theme is chosen; a unit test checks that both are the same.

## Settings

The gear of the header opens the settings of rudof
([`settings.js`](settings.js), [`settings-dialog.js`](settings-dialog.js)):
the [configuration of rudof](https://github.com/rudof-project/rudof/blob/master/docs/src/references/config.md)
that applies to every operation of the page. The dialog has the settings
that change what rudof does in the browser, by sections:

| Section | Settings |
|---------|----------|
| General | the base IRI, the indentation of JSON and JSON-LD results |
| Endpoints | the time between two requests, the requests at the same time, the nodes in one query, how SHACL gets the data of an endpoint (node by node or shape by shape), and how validations get the data of the nodes ([see above](#the-limits-of-the-requests)) |
| ShEx validation | the maximum number of steps, the negation requirement |
| UML diagrams | direction, lines, shadows, labels for IRIs and the properties of the labels, colors |
| RDF diagrams | the colors of IRIs, blank nodes and literals (RDF data converted to a diagram) |
| SPARQL queries (from ShEx) | the variable of the focus node |
| SHACL to ShEx | target classes as `rdf:type`, blank-node shapes embedded |
| DCTAP | delimiter, quote, flexible rows, delimiter of value shapes, base of datatypes |

**More settings (TOML)** takes any other setting, over those of the form,
such as endpoints (`[rdf.endpoints.<name>]` with `name`, `query_url`, a
`[prefixmap]` and the limits of their requests), which are added to the
Endpoint menus with their prefixes.
**The configuration that rudof gets** shows the result. Settings that rudof
can't read are not saved, and the dialog says why. The browser keeps the
settings that differ from the defaults (not the permalinks), and the gear
shows how many there are; **Reset to defaults** forgets them.

The configuration of each operation (the base IRI of the page, the prefixes
of a DCTAP profile, the options of SHACL, the description of an endpoint)
gets the settings over it (`configWithSettings`), merged as TOML tables with
[smol-toml](https://www.npmjs.com/package/smol-toml).

## More RDF data

Under the RDF data of the RDF, ShEx, SHACL, DCTAP and SPARQL tabs, **+ Add
RDF data** adds another editor of RDF data, with its own format
([`extra-data.js`](extra-data.js)). rudof merges all of them (`readData` with
`merge`) before it converts, validates or queries them, also with the data
of an endpoint. **Remove** removes one. Permalinks have them as `data-2`,
`data-2-format`, `data-3`… An example of a manifest, and **Use as input**
of the RDF tab, replace them.

## Results

The results of ShEx, SHACL, DCTAP and PGSchema validations are shown as a
table by default (the **Table** result format): a row for each node and
shape, with its result and its details. For ShEx, SHACL and DCTAP, the table
is the `details` text of rudof, read back by
[`box-table.js`](box-table.js). The other formats are as rudof writes them.

The tables of results (validations, SPARQL solutions, CSV results) work as
in a spreadsheet ([`table-tools.js`](table-tools.js)):

- Clicking the name of a column sorts the rows by it: in ascending order,
  then descending, then in their order again. Numbers are sorted as numbers.
- The ▾ button next to the name opens the filter of the column: its values
  (in the rows that the other filters show) with how many rows have each
  one, a search box, **(Select all)**, the sort orders and **Clear filter**.
  The filters of all the columns apply together, the button of a filtered
  column is marked, and a line under the table says how many rows it
  shows.

### SHACL options

Next to the **Validate** button of the SHACL tab:

- **Recursion**: what rudof does with shapes that refer to themselves, in a
  cycle (`recursion_semantics`, whose values are `none`, `lfp` and `gfp`
  since rudof 0.3.28; `cautious` and `brave` are their old names):
  - **No recursion** refuses a shapes graph with a cycle.
  - **LFP: Conservative Mode** (least fixed point, the default) is *false
    unless proven*: a node in a cycle conforms only when this can be shown
    without assuming that it conforms.
  - **GFP: Permissive Mode** (greatest fixed point) is *true unless
    disproven*: a node in a cycle conforms unless something shows that it
    does not.

  The options and the ⓘ next to the menu say this in their tooltips.
  Permalinks with the old names (`recursion=cautious`, `recursion=brave`)
  still work.
- **Show**: the **Errors** (the violations and other results), the
  **Evidences** (why the nodes conform), and whether the evidences are only
  those **of shapes**, or also those of each constraint. By default, the
  errors and the evidences of shapes.

The **Shapes graph** is optional: when it is empty, rudof takes the shapes
from the RDF data (`readShacl` without shapes), and the verdict says so.
The same goes for SHACL examples of manifests without `schema`.

Under the shapes graph, the optional **Target declarations** are RDF triples
that say which nodes the shapes apply to (such as
`:PersonShape sh:targetNode :alice .`), in their own format. When they are
not empty, rudof reads the shapes graph (or the RDF data, without a shapes
graph) and the target declarations as RDF data in a session of their own,
merges them, and reads the merged graph as the shapes. The verdict says
"(with the target declarations)". In manifests, SHACL examples give them with
`targets` or `targetsURL`, and `targetsFormat` (Turtle by default, or the
format of the file extension). In permalinks, they are `targets` and
`targets-format`.

They are the `[shacl]` section of the configuration of rudof
(`recursion_semantics`, `store_errors`, `store_evidences` and
`evidence_shapes_only`). Without the errors, the verdict doesn't count them.

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

A manifest can also put its examples in sections, which can have sections
too. An item with `section` is a section: its title, an optional `comment`
and `examples`, a list of examples and sections. A manifest without sections
is a list of examples, as before, and keeps the menu of examples (grouped by
`schemaLabel`). A manifest with sections shows them as a tree
(`parseSections` in `manifest.js`, `showSections` in `demo.js`): the titles of
the sections, closed, with the number of their examples; a click on a title
opens the section (`<details>`), with its comment, and another click closes
it. The examples are numbered in the order of the manifest, depth first, so
`&example=<n>` still names one, and the demo opens its sections.

```yaml
- section: Knowledge Graphs
  comment: Examples about Knowledge Graphs
  examples:
  - comment: Tim Berners-Lee in RDF (Turtle)
    dataURL: ex01.ttl
    action: data
  - section: RDF 1.2
    examples:
    - comment: RDF 1.2 (annotated triples)
      dataURL: ex05_annotated.ttl
      action: data
- comment: An example out of the sections
  dataURL: ex02.ttl
  action: data
```

Optional keys say what to do with an example. Without them, an entry is a
ShEx validation, as in the manifests of shex.js:

| Key | Values | Default |
|-----|--------|---------|
| `action` | `data` (load the data in the Data tab), `validate` (validate it in the Validate tab), `query` (run a query on it in the Query tab), `schema` (show the schema in the Schema tab, to convert it) | `validate` |
| `dataFormat` | an RDF format (`turtle`, `ntriples`, `rdfxml`, `jsonld`, `trig`, `n3`, `nquads`), or `yars-pg` for property graphs | `turtle` |
| `schemaFormat` | `shex` (ShExC), `shexj` or `json` (ShExJ), an RDF format (ShExR, or SHACL shapes; `json` is JSON-LD for SHACL), `pgschema`, or `csv` (DCTAP) | `shex` |
| `validationEngine` | `shex`, `shacl` or `pgschema` | `pgschema` for property graphs or `pgschema` schemas, otherwise `shex` |
| `query`, `queryURL` | the query, for `action: query` | |
| `queryFormat` | `sparql` | `sparql` |
| `queryEngine` | `sparql` | `sparql` |
| `endpoint` | the SPARQL endpoint the query or the validation (ShEx, SHACL, DCTAP) runs on, instead of the data (then the data is optional). Validations need a browser with JSPI | |
| `typeMap`, `typeMapURL` | the type map of PGSchema (or `queryMap`) | |
| `schemaLanguage` (or `schemaEngine`) | `shex`, `shacl`, `pgschema` or `dctap`: the language of the schema. DCTAP profiles go to the DCTAP tab, which validates them with ShEx. With `action: schema`, the language of the Schema tab | `dctap` for CSV schemas (`schemaFormat: csv` or `.csv` files) |
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
- schemaURL: ex11_researcher.shex
  action: schema                      # opens the schema in the Schema tab
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
validations on an `endpoint` in browsers without JSPI, validations that read
their data as they go (`neighborhood:` of shex.js) without an `endpoint`,
queries on property graphs, and formats that the tab can't read (such as
TriX).
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
| Convert (Schema) | `schema-language`, `schema-format`, `schema`, `prefixes`, `picklist`, `to`, `to-format` |
| RDF      | `data`, `data-format`, `result-format` |
| Property graph | `data`, `result-format` |
| ShEx     | `schema`, `data`, `shape-map`, `endpoint`, `endpoint-data`, `schema-format`, `data-format`, `result-format`, `schema-result-format` |
| SHACL    | `shapes`, `data`, `endpoint`, `endpoint-data`, `shapes-format`, `data-format`, `mode`, `recursion`, `errors`, `evidences`, `evidences-shapes`, `result-format`, `schema-result-format` |
| DCTAP    | `dctap`, `prefixes`, `picklist`, `data`, `endpoint`, `endpoint-data`, `shape-map`, `data-format`, `engine`, `result-format`, `schema-result-format` |
| PGSchema | `schema`, `data`, `type-map`, `result-format` |
| SPARQL   | `data`, `data-format`, `query`, `endpoint`, `endpoint-data`, `result-format` |

The RDF data added to a tab are `data-2`, `data-2-format`… (see [More RDF data](#more-rdf-data)). Checkboxes (such as `errors` of SHACL) are `true` or `false`. `manifestURL` and `example` are kept. A URL without a fragment opens the tab
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
