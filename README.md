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

The rudof version in `package.json` (used by the tests) must be the one
`demo.js` loads (`RUDOF_VERSION`); a test checks it.

## Publishing

The [GitHub Actions workflow](.github/workflows/gh-pages.yml) runs the tests
and builds the page on every push and pull request, and publishes `dist/` to
the `gh-pages` branch on every push to `main`.
