// PGSchema: PGSchemaC, the syntax of property graph schemas (pgschema.grammar),
// and the type maps that say which nodes and edges to validate with which
// types (typemap.grammar). The grammars are compiled by @lezer/generator when
// the page is built; highlight.js has their highlighting.

import { LRLanguage, LanguageSupport, foldNodeProp, foldInside, indentNodeProp, delimitedIndent } from "@codemirror/language";
import { parser as pgschemaParser } from "./pgschema.grammar";
import { parser as typemapParser } from "./typemap.grammar";
import { pgschemaHighlighting, typemapHighlighting } from "./highlight.js";

// The comments of rudof
const languageData = {
  commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
  closeBrackets: { brackets: ["(", "[", "{", '"'] },
};

const blockComment = (node) => ({ from: node.from + 2, to: node.to - 2 });

export const pgschemaLanguage = LRLanguage.define({
  name: "pgschema",
  parser: pgschemaParser.configure({
    props: [
      pgschemaHighlighting,
      foldNodeProp.add({ "NodeType EndpointType PropertySpec GraphType": foldInside, BlockComment: blockComment }),
      indentNodeProp.add({
        "NodeType EndpointType": delimitedIndent({ closing: ")" }),
        "PropertySpec GraphType": delimitedIndent({ closing: "}" }),
      }),
    ],
  }),
  languageData,
});

export const typemapLanguage = LRLanguage.define({
  name: "typemap",
  parser: typemapParser.configure({ props: [typemapHighlighting, foldNodeProp.add({ BlockComment: blockComment })] }),
  languageData,
});

export function pgschema() {
  return new LanguageSupport(pgschemaLanguage);
}

export function typemap() {
  return new LanguageSupport(typemapLanguage);
}
