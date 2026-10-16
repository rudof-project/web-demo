// YARS-PG, the syntax of property graphs: its grammar (yars-pg.grammar,
// compiled by @lezer/generator when the page is built), its highlighting
// (highlight.js), and what the editor needs to fold and indent it.

import { LRLanguage, LanguageSupport, foldNodeProp, foldInside, indentNodeProp, delimitedIndent } from "@codemirror/language";
import { parser } from "./yars-pg.grammar";
import { highlighting } from "./highlight.js";

// The lists between brackets, which can go on over lines
const LISTS = "Labels PropList ListValue SetValue StructValue MetaProp PropListSchema TypeArguments MetaPropSchema";

const closing = { Labels: "}", SetValue: "}", StructValue: "}", PropList: "]", ListValue: "]", PropListSchema: "]", TypeArguments: ")", MetaProp: ">", MetaPropSchema: ">" };

export const yarspgLanguage = LRLanguage.define({
  name: "yarspg",
  parser: parser.configure({
    props: [
      highlighting,
      foldNodeProp.add({ [LISTS]: foldInside, BlockComment: (node) => ({ from: node.from + 2, to: node.to - 2 }) }),
      indentNodeProp.add(
        Object.fromEntries(Object.entries(closing).map(([name, close]) => [name, delimitedIndent({ closing: close })])),
      ),
    ],
  }),
  languageData: {
    // rudof reads // comments (YARS-PG has # too)
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
    closeBrackets: { brackets: ["(", "[", "{", '"'] },
  },
});

export function yarspg() {
  return new LanguageSupport(yarspgLanguage);
}
