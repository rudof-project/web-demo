# rudof demo

This repo contains the source code of the Web demo based on rudof-lib WebAssembly features

The demo converts RDF data and property graphs between formats, validates them
with ShEx, SHACL or PGSchema, and queries RDF data with SPARQL, all in the
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
- The editors have line numbers, undo history, search (Ctrl+F), bracket
  matching and closing, and take the colors of the page, light or dark.
  Ctrl+Enter still validates.

## Examples

[`examples/`](examples/) has examples of every input format (RDF/XML, Turtle,
TriG, N-Triples, N-Quads, N3, JSON-LD, SPARQL, ShExC and ShExJ), to try the
editors with. The tests check that rudof accepts all of them.

## Manifests

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
  comment: Shown when the example is chosen
```

URLs are relative to the manifest, and the formats of the files are taken from
their extensions (`.shex`, `.json`, `.ttl`, `.nt`, `.jsonld`…). When an example
is validated as loaded, the verdict says whether the result is the one of its
`status`. Entries that read their data from a SPARQL endpoint or Wikidata as
they are validated (`neighborhood:`) are listed but can't be loaded.
`&example=<n>` loads the n-th example (from 1) when the page opens; the URL
gets it when an example is chosen, so it can be shared.

The manifest and its files are read by the browser, so their server must allow
other sites to read them ([CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS));
GitHub Pages and raw.githubusercontent.com do. Kinds of examples are in
`KINDS` of `manifest.js`: SHACL and PGSchema examples will be added there,
named by the `type:` of the entry.

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
| PGSchema | `schema`, `data`, `type-map`, `result-format` |
| SPARQL   | `data`, `data-format`, `query`, `result-format` |

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
