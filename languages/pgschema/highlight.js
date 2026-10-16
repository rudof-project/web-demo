// The highlighting of PGSchemaC (pgschema.grammar) and of type maps
// (typemap.grammar): the tags of @lezer/highlight for the nodes of their
// grammars. The names of types are types, labels are tags, keys are
// properties, and the words of the syntax (CREATE, STRING, CHECK…) are
// keywords. Node ids of type maps are variables, as in YARS-PG.

import { styleTags, tags as t } from "@lezer/highlight";

const comments = { LineComment: t.lineComment, BlockComment: t.blockComment };

export const pgschemaHighlighting = styleTags({
  ...comments,
  "CREATE NODE EDGE GRAPH TYPE IMPORTS": t.definitionKeyword,
  "STRICT LOOSE OPTIONAL": t.modifier,
  "STRING INTEGER DATE BOOL ANY": t.keyword,
  "CHECK REGEX AND OR NOT": t.operatorKeyword,
  "TRUE FALSE": t.bool,
  "TypeName/Identifier": t.definition(t.typeName),
  'TypeRef/Identifier TypeRef/"@"': t.typeName,
  "SingleLabel/Identifier": t.tagName,
  "Key/Identifier": t.propertyName,
  String: t.string,
  Number: t.number,
  'CompareOp "&" "|" "||" "?" "+" "*"': t.operator,
  "OpenArrow CloseArrow": t.operator,
  '"(" ")"': t.paren,
  '"[" "]"': t.squareBracket,
  '"{" "}"': t.brace,
  '"," ":" ";"': t.punctuation,
});

export const typemapHighlighting = styleTags({
  ...comments,
  "NodeId/Identifier": t.variableName,
  "TypeName/Identifier": t.typeName,
  'Not/"!"': t.operator,
  '"," ":"': t.punctuation,
});
