# rudof demo

This repository contains the source code of the web demo of rudof. The demo
uses the WebAssembly build of rudof.

The demo runs in the browser. It can do these operations:

- Convert RDF data and property graphs to different formats.
- Validate them with ShEx, SHACL, DCTAP or PGSchema.
- Generate synthetic data from a SHACL, ShEx or PGSchema schema.
- Query RDF data with SPARQL.
- Compare RDF graphs and schemas.

When the page runs, it loads rudof
([`@rudof/rudof`](https://www.npmjs.com/package/@rudof/rudof)) and PlantUML
from jsDelivr. The build makes all the other parts from this repository.

## Build the page

You need Node.js 22 (22.12 or later) and npm.

```sh
npm ci              # install the dependencies, as in package-lock.json
npm run dev         # serve the page at http://localhost:5173, reloaded on every change
npm run build       # build the page into dist/
npm run preview     # serve dist/ at http://localhost:4173
```

`dist/` is a static site. Its paths are relative, thus you can publish it
without changes in any folder of any web server.

## The inputs of RDF data, schemas and queries

The inputs for RDF data, a schema or a query are one component
([`inputs.js`](inputs.js)). Thus they look and work the same in all the tabs.
`index.html` writes only their textarea, with the type of the input, its label
and its example:

```html
<div class="field">
  <span class="hint" id="shex-data-unused" data-head hidden>Not used: …</span>
  <textarea id="shex-data" data-input="rdf" data-label="RDF data">…</textarea>
</div>
```

`inputs.js` runs before `codemirror-setup.js` makes the editors. It makes the
head of each input. The head has the label, the elements of the field with
`data-head`, and the menu of the formats (`<id>-format`) or the name of the
only format. Then each input gets **Text | URL** (see below). The RDF data and
the ShEx schemas also get **Visualize**, which draws them.

- `data-input="rdf"`: RDF data, in the RDF formats (`RDF_FORMATS` of
  [`schema-convert.js`](schema-convert.js)). These inputs are the RDF data of
  the RDF, ShEx, SHACL, DCTAP and SPARQL tabs and the target declarations of
  SHACL. The two inputs of Compare and the RDF data added to a tab (**+ Add
  RDF data**) are also RDF inputs.
- `data-input="schema"`: a schema, in the formats of its language.
  `data-language` is `shex`, `shacl`, `dctap` or `pgschema` (`LANGUAGES` of
  `schema-convert.js`). These inputs are the schemas of the Validate tabs.
  When the page sets the language (the Schema tab, Generate, Compare), the
  menu is empty and the page fills it. Or the textarea refers to its own menu
  (`data-format-select`).
- `data-input="query"`: a query (`data-language="sparql"`): the SPARQL query.

The other inputs (property graphs, shape maps, type maps, the prefixes of a
DCTAP profile, the configuration of Generate) are editors as before.

All the tabs use the same examples: the files of
[`examples/person/`](examples/person/). A textarea refers to a file with
`data-example="person/data.ttl"`, and all textareas can do this. The examples
are persons with a name and possibly a birth date. The persons know other
persons:

| File | Example of |
|------|------------|
| `data.ttl` | the RDF data of the RDF, ShEx, SHACL, DCTAP, SPARQL and Compare tabs |
| `schema.shex` | the ShEx schema of the ShEx, Schema and Compare tabs |
| `shapes.ttl`, `profile.csv`, `schema.pgs` | the same schema in SHACL, DCTAP and PGSchema |
| `shapemap.txt` | the shape map of ShEx and DCTAP |
| `data.pg`, `typemap.txt` | the same data as a property graph (Data and PGSchema), and its type map |
| `query.rq` | the SPARQL query (the first of its examples) |

All the schemas give the same result. Alice and Carol conform. Bob does not
conform, because he has two names and a birth date that is not a date. The
Generate tab uses these schemas as its first example. The build publishes
`examples/person/` with the page.

## Inputs from URLs

As in [RDFShape](https://rdfshape.weso.es/dataInfo), the RDF data, the schemas
and the queries can come from **Text** (the editor) or from a **URL**. The
switch next to their names selects the source
([`input-source.js`](input-source.js)). With URL, a field replaces the editor,
and the page reads the URL when the tab runs. The page uses `fetch`, thus the
server of the URL must let other sites read it (CORS). The text goes into the
input, and rudof reads it as other text. If the file has an extension (`.ttl`,
`.nt`, `.shex`…), the format menu gets the format of the extension. Below the
field, the page shows what it read.

- In the tabs with an endpoint, the URL can be a prefixed name with the
  prefixes of the endpoint (and the common prefixes). For example, on Wikidata
  `es:E371` is `https://www.wikidata.org/wiki/Special:EntitySchemaText/E371`,
  the EntitySchema E371. The field shows the URL of the prefixed name.
- **Text** shows the previous text of the input again, and **URL** shows the
  last URL. **Edit as text** reads the URL and puts its text in the editor.
- Permalinks have the URL of the input (`schema-url=es:E371`), not its text.
- The relative imports of a ShEx schema from a URL are relative to the URL.
- An example of a manifest, or a result used as input, puts its text in the
  input, as text.

All the inputs of RDF data, schemas and queries can come from a URL (see [The
inputs of RDF data, schemas and
queries](#the-inputs-of-rdf-data-schemas-and-queries)).

## Inputs as diagrams

**Visualize** is next to the format menu of two types of inputs:

- The inputs of RDF data: the RDF data of the RDF, ShEx, SHACL, DCTAP and
  SPARQL tabs, the target declarations of SHACL and the two inputs of Compare.
- The ShEx schemas: the schema of the ShEx tab and the two schemas of Compare.

**Visualize** shows a diagram of the input instead of its editor. rudof writes
the diagram in PlantUML (`serializeData` and `serializeCurrentShex`), and
PlantUML draws it, as for the UML diagrams of the results. Then the button
changes to **Edit**, which shows the editor again.

- The diagram of the RDF data of a tab also shows the RDF data added to the
  tab. The diagrams of the other inputs of RDF data (Compare, the target
  declarations) show only that input. For an input from a URL, the page reads
  the URL first. The page also reads the relative imports of a ShEx schema.
- **Show PlantUML source** shows the source of the diagram, and **Download
  SVG** saves the diagram.
- When the input has an error, the box shows the error.
- An example, a result used as input, or **Swap** in Compare, shows the
  editor again.

## Editors

The inputs of the demo are [CodeMirror 6](https://codemirror.net/) editors.
[`codemirror-setup.js`](codemirror-setup.js) sets them up:

- When the page loads, an editor replaces each `<textarea data-editor>` of
  [`index.html`](index.html). The textarea stays, but it is hidden. It
  represents the editor, thus [`demo.js`](demo.js) reads and sets
  `textarea.value` as before.
- `data-language="sparql"` sets a fixed format for the text. Or a select of
  the page sets the format, with `data-format-select="<id of the select>"`.
- [`languages/index.js`](languages/index.js) has the language of each format.
  The page loads a language when it needs it for the first time. Turtle (also
  TriG, N-Triples, N-Quads and N3), ShExC and shape maps have their own
  parsers in [`languages/`](languages/). RDF/XML, JSON-LD, ShExJ and SPARQL
  use the CodeMirror packages.
- Property graphs, their schemas and type maps have
  [Lezer](https://lezer.codemirror.net/) grammars, each language in its own
  folder:
    - [`languages/yars-pg/`](languages/yars-pg/): YARS-PG (`yars-pg.grammar`).
    It reads the syntax of rudof (`pg.rustemo` of the `pgschema` crate of
    rudof). It also reads YARS-PG 5
    ([`YARSpg.ebnf`](https://github.com/lszeremeta/yarspg/blob/main/other-notations/YARSpg.ebnf)):
    metadata, variables, graphs, undirected edges, sets, structs,
    meta-properties and schemas.
  - [`languages/pgschema/`](languages/pgschema/): PGSchemaC
    (`pgschema.grammar`, from `pgs.rustemo`) and type maps
    (`typemap.grammar`, from `map.rustemo`).

  Each folder has the grammar, `highlight.js` (the highlighting tag of each
  node of the grammar) and `index.js` (the CodeMirror language, with folding
  and indentation). [`@lezer/generator`](https://www.npmjs.com/package/@lezer/generator)
  compiles the grammars when the page builds and when the tests run (the
`lezer()` plugin of `vite.config.js` and `vitest.config.js`). The editor also
shows text that does not follow the grammar. The highlighting continues after
that text.
- The editors have line numbers, an undo history, search (Ctrl+F), and they
  match and close brackets. They use the colors of the page, light or dark.
  Ctrl+Enter validates.
- The editors of Turtle (TriG, N3), ShExC and SPARQL complete prefixes
  ([`prefix-completion.js`](prefix-completion.js)). After `PREFIX` (or
  `@prefix`), they show the declarations of the known prefixes. In the text,
  they show the aliases (`wd:`). If you select an alias that the text does not
  declare, the editor also adds its declaration to the other declarations, in
  the style of the text. The known prefixes are the prefixes of the text, of
  the endpoint of the tab and the common prefixes
  ([`prefixes.js`](prefixes.js)). Ctrl+Space shows them.
- Read-only editors show the results of conversions (RDF data, property
  graphs, and ShEx and SHACL schemas), of validations and of queries. They
  highlight the result in its format. Results in CSV have a **CSV | Table**
  switch to show them as a table, and the browser keeps the selection. demo.js
  writes the result in its hidden `<pre>`, and the viewer follows it
  (`pre[data-viewer]`).

## Schema

The **Schema** section (between Data and Validate) converts a schema in ShEx,
SHACL, DCTAP or PGSchema. It converts the schema to a different format, to a
different schema language, to a UML diagram or to a SPARQL query.
[`schema-convert.js`](schema-convert.js) has the conversions of each language:

| From \ To | ShEx | SHACL | DCTAP | PGSchema | UML | SPARQL |
|---|---|---|---|---|---|---|
| ShEx | ✓ | – | – | – | ✓ | ✓ |
| SHACL | ✓ | ✓ | – | – | ✓ | ✓ |
| DCTAP | ✓ | – | ✓ | – | ✓ | ✓ |
| PGSchema | – | – | – | ✓ | – | – |

The conversions to ShEx, UML and SPARQL go through ShEx (ShExJ). For SHACL,
DCTAP and PGSchema, rudof writes the schema again as it reads it: DCTAP as
text or JSON, and PGSchema as text. rudof 0.3.25 cannot write DCTAP CSV or
PGSchemaC. The menus show the conversions that rudof cannot do (–) with the
text "not in rudof yet", and you cannot select them. A DCTAP profile has its
prefixes and its table view, as in the DCTAP tab of Validate. If the result is
a schema in a format that the tab reads, **Use as input** reads the result as
the schema.

## Compare

The **Compare** section compares two RDF graphs (**Data**) or two schemas
(**Schemas**), with [`compare.js`](compare.js). rudof cannot compare property
graphs, or the schemas of SHACL, DCTAP and PGSchema. The menus show these
items, but you cannot select them.

- **Data** (rudof 0.3.36, `diffData`) tells the relation between the first RDF
  data and the second RDF data. It ignores the names of the blank nodes. The
  relation is one of these:
  - *isomorphic*: the same graph.
  - *equivalent*: each graph contains the other graph, but they are not
    isomorphic.
  - *subgraph*: the second graph contains the first graph.
  - *supergraph*: the first graph contains the second graph.
  - *different*.

  **Blank nodes** tells how rudof can map the blank nodes of a graph to the
  terms of the other graph. *injective* (the default): two blank nodes cannot
  map to the same term. *homomorphic*: two blank nodes can map to the same
  term. *entailment*: a blank node can also map to an IRI or a literal.

  - **Table** has the triples that are only in one of the graphs, as in the
    other tables of results (sorted, filtered, with links). It uses the
    prefixes of the two inputs. It also shows the blank nodes of the first
    graph that match terms in the second graph. **Report** is the report of
    rudof, and **JSON** is the return value of `diffData`.
  - rudof does not compare the names of the graphs of TriG and N-Quads.
  - When the page cannot read an input, the result tells which input.
- **Schemas** (`compareSchemas`) compares a shape of the first ShEx schema
  with a shape of the second schema, property by property. It shows the report
  of rudof. **Shape** is the shape of each schema (a prefixed name with the
  prefixes of the schema, or an IRI). When it is empty, rudof uses the first
  shape of the schema. rudof does not tell if the schemas are equivalent, or
  if one schema contains the other. For this comparison, rudof reads only
  ShExC. The menu shows ShExJ and ShExR, but you cannot select them. In rudof
  0.3.36, `compareSchemas` crashes with SHACL and ShExR (a panic, "not yet
  implemented"). Thus the page does not call it for these formats.
- **Swap** swaps the two inputs, with their formats and shapes. Permalinks
  have both inputs: `data` and `data2`, or `schema` and `schema2`, with
  `#compare/compare-data` or `#compare/compare-schemas`.

## ShEx imports

A ShEx schema can import other schemas (`IMPORT <iri>` in ShExC, `imports` in
ShExJ). Since rudof 0.3.31, rudof with endpoints gets the imports with `fetch`
(`readShexAsync`, which also goes through `setFetch`). Thus the page uses it
to read a schema with imports ([`schema-convert.js`](schema-convert.js),
`readShexSchema`). It does this in the ShEx tab (validations, also on
endpoints, and **Convert schema**) and in the Schema tab. The page reads
schemas without imports as before (`readShex`). While rudof gets the imports,
the result shows "Reading the imported schemas…". The page reads a schema with
imports in a new session, because a session that waits cannot do other work.

- The servers of the imported schemas must let other sites read them
  ([CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)).
- When the schema comes from an example of a manifest, relative imports
  (`IMPORT <book.shex>`) are relative to the file of the schema.
- The output of rudof keeps the imports (`IMPORT`, `imports`). rudof writes
  ShEx in other formats and UML diagrams from the schema that it read, with
  its imports. Conversions that read the schema again (ShEx to SPARQL) cannot
  get the imports.
- Only rudof with endpoints has `readShexAsync`, and it needs JSPI. In Firefox
  and Safari, the page tells that the imports need it.

## DCTAP

The DCTAP tab of Validate reads a
[DCTAP](https://www.dublincore.org/specifications/dctap/) profile in CSV.
Spreadsheet applications can save a sheet as CSV. The names of the profile are
prefixed names (`foaf:name`) or names without a prefix (`Person`). Thus the
tab also has **Prefixes of the profile**, in Turtle syntax: `PREFIX foaf:
<…>`, and `BASE <…>` for the names without a prefix. The basic prefixes of
rudof (`rdf`, `rdfs`, `xsd`, `sh`, `dc`) are always available. Spaces separate
the values of picklists, as in DCTAP. Or `|` separates them, as is the default
in rudof. [`dctap.js`](dctap.js) changes the prefixes into the configuration
of rudof (TOML).

- **Validate** converts the profile to ShEx and validates the data with it,
  for the shape map. rudof cannot convert DCTAP to SHACL. The SHACL option of
  **Validate with** is for a future version of rudof that can do this.
- **Convert the profile to** converts the profile to ShEx (ShExC, ShExJ or
  ShExR), a UML diagram, a SPARQL query, or DCTAP as rudof reads it (text or
  JSON). A future version of rudof will add SHACL.

The editor highlights the profile by column
([`languages/dctap/`](languages/dctap/)). The header gives the column of each
cell. The **CSV | Table** switch of the profile shows it as a table
([`table-view.js`](table-view.js), with [`csv.js`](csv.js)). You can edit the
cells. Enter moves to the cell below. **Add row** adds a row, and × deletes a
row. The table writes each change into the CSV, and the CSV is always the
input. The browser keeps the view.

## Generate

The **Generate** section (the last section, after Compare) generates synthetic
data from a schema with `generate` of rudof (since rudof 0.3.37). Then it
validates the data with the same schema immediately. It has a tab for each
schema language: **SHACL**, **ShEx** and **PGSchema**. The tabs use the same
panel (`data-panel="gen"`). The tab sets the language (`data-select`,
`data-value`), and the permalink keeps it (`#generate/gen-shex`).
[`generate.js`](generate.js) has the views of the result.

As in the tabs of Validate, the schema is the first box and **Generated data**
is the second box. **Generate** writes the generated data in the second box.
The **Generator configuration** is below the boxes, and the result is below
the configuration.

- The examples are in a manifest,
  [`examples/generate/manifest.yml`](examples/generate/manifest.yml). The
  schemas are in the same folder, and the build publishes them with the page.
  Each section is an example (with an `id`). Each entry of a section is a type
  of data (`kind`), with `action: generate`, the schema in each language
  (`shaclURL`, `shexURL`, `pgschemaURL`) and the configuration of the
  generator (`config`). The **Examples** menu (**Generate examples**) and the
  link above the boxes open the manifest. An entry opens the Generate tab with
  its schema and its configuration. An example with `action: generate` from a
  different manifest also goes to the tab. help.html documents the keys.
- At the start, the tab has the first example. This is the example of the
  other tabs (persons, [`examples/person/`](examples/person/)), in SHACL, ShEx
  and PGSchema. It is a small schema that you can change to write your own
  schema. The other examples are six models, each in the three languages:
  references, keys, facets, labels, LUBM and LDBC SNB. They use the RDF
  encoding of a property graph. Thus the three schemas generate the same
  graph, and SHACL and ShEx also get the property graph. Each type of data
  writes the configuration of the generator (TOML, version 2). You can edit it
  before **Generate**. The types are: valid data, dense or sparse data, a
  target coherence, or data **with errors** (20% of the entities have one
  broken constraint).
- The line above the boxes shows the example and the type of data of the tab.
  At the start, this is the first entry of the manifest. A permalink has the
  schema and the configuration. When it opens, the page selects the example
  with this schema and the type of data with this configuration. Thus the
  other languages of the example are also available.
- **Generated data** has the RDF data (Turtle), or the property graph
  (YARS-PG) from a PGSchema. If the data also has the other form, the menu
  shows it. The examples of SHACL and ShEx also have a property graph. You can
  edit the data. **Validate with**, **Open in** and **Download** use its text,
  and the menu keeps the text of each form. Permalinks do not have the data.
- **Show** selects the view: a summary, the type map of the property graph,
  the ShapeMap, the error report or the validation. The summary has the nodes,
  the nodes and edges of the property graph, the report, the nodes that the
  validator rejects and the nodes of each shape. With errors, the report tells
  which nodes a correct validator must reject: *direct* (the broken node) and
  *induced* (a node that refers to it). It also tells which changes keep the
  data valid (*trap*). The verdict compares the report with the nodes that the
  validator rejects. **Download** saves the visible view, or the generated
  data when the view is the summary.
- **Validate with SHACL / ShEx / PGSchema** validates the data here, with the
  schema of the example in that language. **Open in SHACL / ShEx / PGSchema**
  copies the data and that schema to the tab of Validate. PGSchema needs a
  property graph. Your own schema (a schema that you changed, or an example in
  only one language) has no other language.
- The schema, the generated data, the configuration and the result have their
  own heights, because the data can be long. Their handle, or Full screen,
  makes them bigger.

## SPARQL endpoints

In the SPARQL, ShEx, SHACL and DCTAP tabs, the **Endpoint** field runs the
query or the validation on a SPARQL endpoint instead of the RDF data of the
page. Its menu has **None** (the RDF data of the page), the endpoints that
rudof knows (Wikidata, DBpedia, UniProt, …) and **Other**. With **Other**, you
write the URL of the endpoint in the field next to the menu.

rudof connects to the endpoint with `useEndpoint`, then runs `runQueryAsync`,
`validateShexAsync` or `validateShaclAsync`. ShEx gets the data of each node
of the shape map from the endpoint. SHACL gets the data of its targets. The
page describes the endpoint to rudof with the prefixes of the schema
(`endpointConfig` in [`endpoint.js`](endpoint.js)). Thus the shape map can use
these prefixes, because the data of an endpoint has no prefixes.

Below the field, **Prefixes of …** shows the prefixes of the endpoint. They
come from the settings, or from rudof (`rudof_rdf/endpoints/<name>.toml` in
the repository of rudof). The npm package does not have these files, thus the
page reads them from jsDelivr, for the version of rudof that it loads. The
editors of the tab complete these prefixes. The validations on the endpoint
can use them in their shape maps, with the prefixes of the schema.

**With the RDF data**, next to the field, also uses the RDF data of the tab.
rudof merges it with the data of the endpoint (`useEndpoint`, then `readData`
with `merge`). Thus a validation or a query uses both. SPARQL `SERVICE` to an
endpoint is not available: rudof tells that it does not support the service.

This function needs rudof built with the `endpoints` feature
(`@rudof/rudof/endpoints`, in the package since rudof 0.3.27). Its WebAssembly
needs JSPI (JavaScript Promise Integration). Chrome and Edge 137 or later have
JSPI, but Firefox and Safari do not. Thus the page loads
`@rudof/rudof@<version>/endpoints/web/rudof_wasm.js` in browsers with JSPI. In
other browsers, or if this build does not load, the page loads the usual
`web/` build. The status line shows "with endpoints" when the page has this
build. If this build does not load in a browser with JSPI, the hint of the
Endpoint fields and the tooltip of the status line tell why. Without endpoints
in rudof, the page sends SPARQL queries to the endpoint itself
([`endpoint.js`](endpoint.js), with the SPARQL 1.1 protocol), and the
validations cannot use endpoints.

### The queries to the endpoint

While a run waits for an endpoint, the result shows its queries:

- The number of queries that are sent, answered, waiting and failed.
- The time of the run (in the head of the result).
- The limits of the requests.
- **Stop**.
- A table of the queries, with the last query first.

For each query, the table has these columns: the time of the request, the
status of the answer, the duration, the size, the nodes in the query and the
query. rudof can ask
about many nodes of a shape map in one query, with `VALUES`. A click on a
query shows all of the query, the endpoint and the start of the answer (a
maximum of 4000 characters, with indented JSON). The table shows the last 500
queries, and the page draws it again after each query. After the result, the
switch **Result | Queries (n)** of the result shows the result or the queries.
This is also true when the run fails or when you stop it.

**Stop** cancels the queries that wait, and stops the run. JavaScript cannot
stop rudof: the session continues the validation until rudof stops it. Until
then, the requests of the stopped run fail immediately and do not go to the
network. The summary shows "stopping: rudof gives up" and the number of
requests that the page did not send. If the requests did not fail, rudof would
continue to send requests to the endpoint and to read the answers in the page.
This can make the page stop. rudof stops when its requests fail (after its
retries, some seconds). A new run of the tab waits until then (a maximum of 15
s), and shows "Stopping the previous run…". If it did not wait, the page could
not identify the requests of each run.

rudof has no logs in WebAssembly. Thus the page gets the requests from the
function that rudof uses to send them (`setFetch`).
[`endpoint-log.js`](endpoint-log.js) sends the requests with `fetch` and logs
them. The page also shows the query of the SPARQL tab that it sends itself
(without rudof with endpoints). rudof counts the requests of a session
(`requestCount`), but it cannot give the count while the session waits. Thus
the page shows the count after the run, if it is different from the list. The
list can have the queries of other tabs that run at the same time.

### The limits of the requests

rudof 0.3.29 waits between two requests to an endpoint, thus public endpoints
such as Wikidata do not block it. It also asks about the nodes of a shape map
in batches. The **Endpoints** section of the settings changes these values, in
`[rdf]` of the configuration. **Options**, next to the Endpoint field, also
opens this section:

- **Milliseconds between two requests** (`min_request_interval_ms`): 1100 by
  default, 0 for `localhost`. With 0, rudof does not wait. rudof waits longer
  when an endpoint answers `429 Too Many Requests`. It sends a query again
  when the answer is 429, 502, 503 or 504, a maximum of 3 times.
- **Requests at the same time** (`max_concurrent_requests`, 1 by default):
  this applies when rudof gets the nodes of a shape map before it validates
  them.
- **Nodes in one query** (`max_nodes_per_query`, 20 by default). With 1, rudof
  sends one query for each node.
- **How SHACL gets the data of an endpoint** (`[shacl] fetch_strategy`, rudof
  0.3.30). With `on-demand` (the default), rudof gets the data node by node,
  when the validation needs it. With `by-shape`, rudof gets the data shape by
  shape before the validation, with the data of many focus nodes in one query.
  When there are many focus nodes, this sends much fewer requests. With
  `by-shape`, you can also set **nodes in one query** (`prefetch_batch_size`,
  50 by default) and **the depth of the data fetched before**
  (`prefetch_max_rounds`). The default depth is 16 shape references from the
  shapes with targets. rudof gets deeper data when the validation needs it.
- **How validations get the data of the nodes**: SPARQL queries (the default),
  or the RDF of the IRIs of the nodes (`dereference`, the strategy of
  `useEndpoint`). `dereference` needs https IRIs, and servers that let other
  sites read them (CORS). The SPARQL tab always queries the endpoint.

The endpoints that rudof knows have their own limits in their TOML files, for
example `min_request_interval_ms = 1100` of Wikidata. The endpoints of the
settings (`[rdf.endpoints.<name>]`) can also have their own limits. The page
gives these limits to rudof with the description of the endpoint
(`endpointConfig`). Thus they have priority over the settings, as in rudof.
For example, Wikidata keeps 1100 ms when the settings have 0. The result shows
the limits that apply to each run:

- In the ShEx and DCTAP tabs: the time between two queries, the requests at
  the same time and the nodes in one query.
- In the SHACL tab: the time between two queries and how SHACL gets the data.
- In the SPARQL tab (one query): the time between two queries.

The result identifies a limit that the endpoint sets: "1 query every 1.1 s at
most (set by Wikidata)". The other limits come from the settings, or from the
defaults of rudof.

The page shows SELECT results in the table (with the prefixes of the query),
as JSON or as CSV. It can write the graphs of CONSTRUCT and DESCRIBE in all
the RDF formats.

The endpoint must let other sites query it
([CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)), as Wikidata
does. The page (https) cannot query an `http:` endpoint.

The browser tests run with the two builds of rudof: with endpoints (from
`endpoints/web/` of the package) and without endpoints. To test a different
build of rudof with endpoints, for example a build from the rudof repository,
set its folder in `RUDOF_ENDPOINTS_DIR`:

```sh
RUDOF_ENDPOINTS_DIR=<folder with rudof_wasm.js and rudof_wasm_bg.wasm> npm run test:e2e
```

## Header and theme

The header of the demo and of the help page ([`header.js`](header.js)) has
three menus:

- **Examples**: the examples of the [ISWC 2026
  tutorial](./?manifestURL=https%3A%2F%2Fraw.githubusercontent.com%2Fvalidatingrdf%2FTutorial%2Frefs%2Fheads%2Fmaster%2FISWC_2026%2Fmanifest.yml),
  and how to write your own manifest.
- **Help**.
- **About**: the manual of rudof, rudof and this demo on GitHub, the npm
  package and the versions. The versions are the version of rudof that the
  page loads and the version of the demo in [`VERSION`](VERSION), with its
  commit. The build gets the commit from `GITHUB_SHA` or from git.

Examples and About are `<details>` menus, thus they also open without
JavaScript.

Next to the menus is the theme (the sun or the moon): **As the system**,
**Light** or **Dark**. The browser keeps the theme. An inline script in the
`<head>` of the pages applies it before the browser draws the page. The dark
colors are in `:root[data-theme="dark"]` of [`demo.css`](demo.css), and in the
rules for the dark theme of the system (when no theme is set). A unit test
makes sure that the two sets of colors are the same.

## Settings

The gear of the header opens the settings of rudof
([`settings.js`](settings.js), [`settings-dialog.js`](settings-dialog.js)).
The settings are the [configuration of
rudof](https://github.com/rudof-project/rudof/blob/master/docs/src/references/config.md)
for all the operations of the page. The dialog has the settings that change
the behavior of rudof in the browser, in sections:

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

**More settings (TOML)** accepts all other settings, and they replace the
values of the form. For example, you can add endpoints
(`[rdf.endpoints.<name>]` with `name`, `query_url`, a `[prefixmap]` and the
limits of their requests). The page adds these endpoints to the Endpoint menus
with their prefixes. **The configuration that rudof gets** shows the result.
The page does not save settings that rudof cannot read, and the dialog tells
why. The browser keeps the settings that are different from the defaults (the
permalinks do not have them). The gear shows the number of these settings.
**Reset to defaults** deletes them.

Each operation has its own configuration (the base IRI of the page, the
prefixes of a DCTAP profile, the options of SHACL, the description of an
endpoint). The settings replace the values of this configuration
(`configWithSettings`). The page merges them as TOML tables with
[smol-toml](https://www.npmjs.com/package/smol-toml).

## More RDF data

**+ Add RDF data** is below the RDF data of the RDF, ShEx, SHACL, DCTAP and
SPARQL tabs. It adds one more editor of RDF data, with its own format
([`extra-data.js`](extra-data.js)). rudof merges all the data (`readData` with
`merge`) before it converts, validates or queries it. This is also true with
the data of an endpoint. **Remove** removes an editor. Permalinks have the
data as `data-2`, `data-2-format`, `data-3`… An example of a manifest and
**Use as input** of the RDF tab replace these editors.

## Results

By default, the page shows the results of ShEx, SHACL, DCTAP and PGSchema
validations as a table (the **Table** result format). The table has a row for
each node and shape, with its result and its details. For ShEx, SHACL and
DCTAP, [`box-table.js`](box-table.js) makes the table from the `details` text
of rudof. Since rudof 0.3.40, this text has a table with a short summary, and
the full details of the failed nodes are after the table. The page puts the
full details in the table. The other formats show the output of rudof without
changes.

The tables of results (validations, SPARQL solutions, CSV results) work as
in a spreadsheet ([`table-tools.js`](table-tools.js)):

- A click on the name of a column sorts the rows by that column in ascending
  order. The second click sorts in descending order, and the third click shows
  the initial order. The table sorts numbers as numbers.
- The ▾ button next to the name opens the filter of the column. The filter
  shows the values of the column (in the rows that the other filters show),
  with the number of rows for each value. It also has a search box, **(Select
  all)**, the sort orders and **Clear filter**. The filters of all the columns
  apply together. The button of a filtered column has a mark, and a line below
  the table shows the number of visible rows.
- Drag the right border of the name of a column to change its width. When the
  border has the focus, the arrow keys also change the width. Then the table
  keeps the widths of its columns (`table-layout: fixed`). The table becomes
  wider, with a scroll bar, or narrower, and the table cuts the text that does
  not fit. The next table with the same columns keeps the widths until you
  reload the page. For example, this occurs when the tab runs again, or when
  you select a different result format and then the initial format. A double
  click on a border sets the initial widths again.

The IRIs of the results are links, and the links open in a new tab
([`iri-links.js`](iri-links.js)). In the tables of validations, of SPARQL
solutions and of CSV results, a cell `wd:Q5685` is a link to
`http://www.wikidata.org/entity/Q5685`. The page reads the prefixed names with
the prefixes of the inputs of the tab (its data, schema, shape map…), of its
endpoint and the common prefixes. Only http and https IRIs are links. Literals
and blank nodes are text. The sort and the filters read the text of the cells,
as before.

The other tables of the page also have these borders (`makeResizable` of
[`table-tools.js`](table-tools.js)):

- The table view of the DCTAP profile. The page draws it again when the text
  changes, and it keeps its widths. The column of the buttons has no border.
- The table of the queries to an endpoint. The page draws it again after each
  query, with the same widths. This is also true while you drag a border.

When rudof crashes (a panic or a stack overflow), the page cannot use its
WebAssembly module again. The result tells what occurred. The page loads a new
instance of rudof (the same module, from the cache), thus the tabs can run
again without a reload. The status shows "loaded again after an error". The
page cannot change the format of the previous results.

### SHACL options

Next to the **Validate** button of the SHACL tab:

- **Recursion**: how rudof validates shapes that refer to themselves in a
  cycle (`recursion_semantics`). Since rudof 0.3.28, the values are `none`,
  `lfp` and `gfp`. `cautious` and `brave` are their old names.
  - **No recursion** refuses a shapes graph with a cycle.
  - **LFP: Conservative Mode** (least fixed point, the default) is *false
    unless proven*. A node in a cycle conforms only when rudof can show this
    without the assumption that the node conforms.
  - **GFP: Permissive Mode** (greatest fixed point) is *true unless
    disproven*. A node in a cycle conforms if nothing shows that it does not
    conform.

  The tooltips of the options and of the ⓘ next to the menu give this
information. Permalinks with the old names (`recursion=cautious`,
`recursion=brave`) also work.
- **Show**: the **Errors** (the violations and other results) and the
  **Evidences** (why the nodes conform). Another option selects only the
  evidences **of shapes**, or also the evidences of each constraint. By
  default, the page shows the errors and the evidences of shapes.

The **Shapes graph** is optional. When it is empty, rudof gets the shapes from
the RDF data (`readShacl` without shapes), and the verdict tells this. This is
also true for SHACL examples of manifests without `schema`.

Below the shapes graph, the optional **Target declarations** are RDF triples
that tell the nodes for the shapes, in their own format. For example:
`:PersonShape sh:targetNode :alice .`. When they are not empty, rudof reads
the shapes graph (or the RDF data, without a shapes graph) and the target
declarations as RDF data, in a separate session. It merges them and reads the
merged graph as the shapes. The verdict shows "(with the target
declarations)". In manifests, SHACL examples give them with `targets` or
`targetsURL`, and `targetsFormat` (Turtle by default, or the format of the
file extension). In permalinks, they are `targets` and `targets-format`.

These options are the `[shacl]` section of the configuration of rudof
(`recursion_semantics`, `store_errors`, `store_evidences` and
`evidence_shapes_only`). If the errors are not selected, the verdict does not
count them.

### Read triples

**Read triples** is next to the **Validate** button of the ShEx and SHACL
tabs. It asks rudof (0.3.42 or later) for the triples that the validation
reads. It uses `validateShex(readTriples, format, subgraphs)`,
`validateShacl(mode, fetchStrategy, readTriples, format, subgraphs)` and their
`…Async` versions on endpoints. The verdict shows the number of triples that
rudof read (with duplicates) and the number of distinct triples: "Conforms · 8
triples read (7 distinct)". Below the result, **Subgraph read** (closed at the
start) shows the number of valid and invalid visited triples. It has two
buttons:

- **Visited triples valid**: the valid subgraph, the triples that the
  conformant node/shape pairs matched (`validSubgraph`, `validTriples`).
- **Visited triples invalid**: the triples visited that are not part of the
  valid subgraph (`invalidSubgraph`, `invalidTriples`).

Each button shows the number of triples in its subgraph. At the start, the
page shows the valid subgraph. The subgraph is in Turtle, as rudof gives it,
or in a different RDF format from its own menu. A separate session converts it
to the other formats, without a new validation. The page hides the subgraph
while the tab runs, after an error and without the option.

**Visualize**, next to its format menu, shows a diagram of the subgraph
instead of its text, as for the inputs of RDF data. rudof writes the subgraph
in PlantUML (`serializeData("plantuml")`) with the prefixes of the tab.
PlantUML draws it, with **Show PlantUML source** and **Download SVG**. Then
the button changes to **Text**, which shows the text again. While the diagram
is visible, each new validation draws its subgraph. The two buttons change the
diagram to the valid or the invalid subgraph.

Only the native engine of SHACL reads triples. The SPARQL engine reads the
data with queries, thus the option is disabled with this engine. In
permalinks, the option and the format are `read-triples` and
`read-triples-format`.

## Layout

With [`layout.js`](layout.js), you can arrange the boxes of all the tabs
(Data, Validate and Query):

- **Layout** menu, next to Permalink: the two boxes of a row are side by side
  or one above the other. They are in their usual order or swapped (for
  example, the result at the left of the data, or the schema above the data).
  The browser keeps the selection. On narrow screens, the boxes are always one
  above the other.
- **Splitter**: when the boxes are side by side, drag the line between them to
  change their widths. Or give the line the focus (Tab) and use the arrow
  keys. A double click makes the widths equal again. The browser keeps the
  widths of each tab.
- **Heights**: drag the handle at the bottom right corner of an editor or a
  result.
- **Full screen**: the button at the top right of each editor and each result
  shows it on all the window of the browser. A second click on the button, or
  Esc, sets the normal size again. Ctrl+Enter also runs the tab in full
  screen.

## Examples

[`examples/`](examples/) has examples of all the input formats (RDF/XML,
Turtle, TriG, N-Triples, N-Quads, N3, JSON-LD, SPARQL, ShExC and ShExJ). You
can use them to try the editors. The tests make sure that rudof accepts all of
them.

## Manifests

The **Help** page of the demo ([`help.html`](help.html)) tells how to run the
examples of a manifest. It also documents the format of manifests, with an
example for each action and validation engine.

The page can show the examples of a manifest (a YAML file, such as the
manifest of shex.js). It can load the selected example into the editors:

```
https://rudof-project.github.io/web-demo/?manifestURL=https://shex.js.org/doc/tests-manifest.yaml
```

[`manifest.js`](manifest.js) reads the manifest. The page loads it and its
YAML parser only when the URL has a `manifestURL`. Each entry is an example,
in the vocabulary of shex.js:

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

A manifest can also put its examples in sections, and sections can contain
sections. An item with `section` is a section. It has a title, an optional
`comment` and `examples` (a list of examples and sections). A manifest without
sections is a list of examples, as before. It keeps the menu of examples, in
groups by `schemaLabel`. The page shows a manifest with sections as a tree
(`parseSections` in `manifest.js`, `showSections` in `demo.js`). At the start,
the sections are closed, and each title shows the number of examples. A click
on a title opens the section (`<details>`) with its comment, and a second
click closes it. The examples have numbers in the order of the manifest, depth
first. Thus `&example=<n>` identifies one example, and the demo opens its
sections.

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

Optional keys tell what to do with an example. Without them, an entry is a
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

URLs are relative to the manifest. Without a format, the page gets the format
of a file from its extension (`.shex`, `.json`, `.ttl`, `.nt`, `.jsonld`,
`.pg`…). Inline text has the default format, or JSON-LD and ShExJ for text
that starts with `{`. The list shows the `comment` of each example, or its
`dataLabel` if it has no comment. When you select an example, the page opens
the tab of its action and loads its inputs. To run the example, push the
button of the tab (**Validate**, **Run query**, **Convert**). If the inputs
did not change, the verdict tells if the result agrees with the `status` of
the example.

The list also shows the examples that the demo cannot run, but you cannot load
them. **Why … examples cannot be run**, below the list, tells why. For each
entry, it gives a hint to change the entry, and the entry as the demo read it.
The demo cannot run these examples:

- Validations on an `endpoint` in browsers without JSPI.
- Validations that read their data during the validation (`neighborhood:` of
  shex.js) without an `endpoint`.
- Queries on property graphs.
- Formats that the tab cannot read (such as TriX).

`&example=<n>` loads the example number n (from 1) when the page opens. When
you select an example, the URL gets this parameter, thus you can share the
URL. The URL also gets the inputs of the example (see
[Permalinks](#permalinks)). The **Reload the examples** link, next to the
list, opens the page again with only `?manifestURL=…`.

The browser reads the manifest and its files. Thus their server must let other
sites read them
([CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)). GitHub Pages
and raw.githubusercontent.com let other sites read them. `TARGETS` of
`manifest.js` has the tab of each action and validation engine, and the
formats that the tab reads.

## Permalinks

After each operation, the query of the URL gets the inputs and options of the
visible tab, and the fragment gives the tab. The operations are: a conversion,
a validation, a query, a change of the result format, and the selection of a
tab or an example:

```
?schema=PREFIX%20…&data=PREFIX%20…&shape-map=%3CObs1%3E%40START%0A&schema-format=shexc&…#validate/shex
```

For an input from a URL, the permalink has the URL, in the parameter of the
input with `-url` (`schema-url=es:E371`). The **Permalink** button writes the
current inputs in the URL and copies the URL. When you open the URL, the page
puts the inputs and options back in their tab. [`permalink.js`](permalink.js)
has the parameters of each tab:

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

The parameters of the RDF data added to a tab are `data-2`, `data-2-format`…
(see [More RDF data](#more-rdf-data)). Checkboxes (such as `errors` of SHACL)
are `true` or `false`. The page keeps `manifestURL` and `example`. A URL
without a fragment opens the tab of its parameters (ShEx for `shape-map` or
`schema`). Thus links in the style of shex.js (`?schema=…&data=…&shape-map=…`)
open the ShEx tab. When a URL has an `example` and also inputs, the page uses
the inputs of the URL, because they are the example with your changes.

Servers refuse URLs that are too long (*414 URI Too Long*), and the inputs can
be long. For example, the schemas of Generate have up to 9,000 characters
(13,500 in a URL). When the query of a permalink is longer than 2,000
characters, its inputs go into one parameter, `z`. This parameter has the
query, compressed with deflate ([fflate](https://github.com/101arrowz/fflate))
and written in base64url. It is approximately ten times shorter. `manifestURL`
and `example` do not change. When you open the URL, the page expands the
inputs. If a link is cut and the page cannot expand it, the page opens without
its inputs.

The browser sends the inputs to the server of the page with the URL. Servers
limit the length of URLs, frequently to approximately 8 KB. Thus a permalink
cannot have very long inputs.

## Tests

```sh
npm test            # unit tests (Vitest, with jsdom)
npm run test:e2e    # the built page in Chromium (Playwright)
```

The browser tests build the page and serve it with `npm run preview`. The
tests give rudof to the page from `node_modules`, thus they do not need the
network. Before the first run, install Chromium with:

```sh
npx playwright install --with-deps chromium
```

Or use a Chromium that you have:

```sh
CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

`demo.js` loads the rudof version of `package.json` (the version that the
tests use). Thus, to update rudof, change only `package.json` and
`package-lock.json` (`npm install --save-dev --save-exact
@rudof/rudof@<version>`).

## Publish the page

The [GitHub Actions workflow](.github/workflows/gh-pages.yml) runs the tests
and builds the page on each push and pull request. On each push to `main`, it
also publishes `dist/` to the `gh-pages` branch.

[`update-rudof.yml`](.github/workflows/update-rudof.yml) updates
`@rudof/rudof` to its latest release on npm once a day. You can also start it
from the Actions tab. It tests the update, pushes it to `main` and publishes
the page. To update the page immediately after a release of rudof, the release
workflow of rudof can send a `repository_dispatch` to it. It must do this
after the package is on npm:

```yaml
- uses: peter-evans/repository-dispatch@v3
  with:
    token: ${{ secrets.WEB_DEMO_TOKEN }}  # can write to rudof-project/web-demo
    repository: rudof-project/web-demo
    event-type: rudof-released
```
