// The highlighting of YARS-PG: the tags of @lezer/highlight for the nodes of
// yars-pg.grammar. Node and edge ids are variables, labels are tags, keys are
// properties, and the types of schemas are types.

import { styleTags, tags as t } from "@lezer/highlight";

export const highlighting = styleTags({
  "NodeId/Identifier NodeId/Number NodeId/String EdgeId/Identifier EdgeId/Number EdgeId/String": t.variableName,
  "Label/Identifier Label/String": t.tagName,
  "Key/Identifier Key/String": t.propertyName,
  String: t.string,
  Number: t.number,
  Boolean: t.bool,
  Date: t.typeName,
  'VariableName/Identifier Variable/"$"': t.special(t.variableName),
  "GraphId/Identifier": t.namespace,
  Schema: t.keyword,
  "TypeName/Identifier": t.typeName,
  "ModifierName/Identifier": t.modifier,
  '"@<" ">"': t.meta,
  '"+"': t.meta,
  LineComment: t.lineComment,
  BlockComment: t.blockComment,
  'Arrow "-"': t.operator,
  '"="': t.definitionOperator,
  '"(" ")"': t.paren,
  '"[" "]"': t.squareBracket,
  '"{" "}"': t.brace,
  '"," ":" "/"': t.punctuation,
});
