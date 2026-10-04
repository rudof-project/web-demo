// A tokenizer for the RDF syntaxes: Turtle (and TriG, N-Triples, N-Quads,
// N3), ShExC and shape maps share IRIs, prefixed names, blank nodes, strings,
// language tags and numbers, and differ in their keywords and a few tokens.
// It is a stream parser (https://codemirror.net/docs/ref/#language.StreamParser),
// and returns the names of the highlighting tags of @lezer/highlight.

const CHAR = "A-Za-z\\u00C0-\\uFFFF";
const NAME = `${CHAR}0-9_`;
const PREFIX = `(?:[${CHAR}](?:[${NAME}.-]*[${NAME}-])?)?:`;
const ESCAPE = "(?:%[0-9A-Fa-f]{2}|\\\\[-_~.!$&'()*+,;=/?#@%])";
const LOCAL = `(?:[${NAME}:]|${ESCAPE})(?:(?:[${NAME}.:-]|${ESCAPE})*(?:[${NAME}:-]|${ESCAPE}))?`;
const IRI = "<[^<>\"{}|^`\\\\\\s]*>";

export const IRIREF = new RegExp(`^${IRI}`);
export const PNAME_NS = new RegExp(`^${PREFIX}`);
export const PN_LOCAL = new RegExp(`^${LOCAL}`);
export const PREFIXED_NAME = `(?:${PREFIX}(?:${LOCAL})?)`;
export const BLANK_NODE = new RegExp(`^_:[${NAME}](?:[${NAME}.-]*[${NAME}-])?`);
export const LANGTAG = /^@[a-zA-Z]+(?:-[a-zA-Z0-9]+)*/;
export const NUMBER = /^[+-]?(?:\d+\.\d*[eE][+-]?\d+|\.?\d+[eE][+-]?\d+|\d*\.\d+|\d+)/;
export const SHAPE_REF = new RegExp(`^@(?:${IRI}|${PREFIXED_NAME})`);

const words = (list) => new Set(list.map((w) => w.toLowerCase()));

// A string, which may be long ("""…""" or '''…''') and go on over lines.
function string(stream, state) {
  const quote = state.string;
  const long = quote.length === 3;
  while (!stream.eol()) {
    if (stream.match(quote)) {
      state.string = null;
      return "string";
    }
    if (stream.next() === "\\") stream.next();
  }
  if (!long) state.string = null; // a short string ends with its line
  return "string";
}

// A block comment (/* … */), which may go on over lines.
function blockComment(stream, state) {
  state.comment = !stream.skipTo("*/");
  if (state.comment) stream.skipToEnd();
  else stream.match("*/");
  return "comment";
}

// A stream parser for an RDF syntax.
//   keywords: words, in any case
//   exactKeywords: words in this case only (like "a")
//   special(stream, state): the tokens of the syntax, tried first; returns a
//   style, or undefined for the common tokens.
export function rdfParser({ name, keywords = [], exactKeywords = [], special = () => undefined, blockComments = false }) {
  const keywordSet = words(keywords);
  const exactSet = new Set(exactKeywords);
  return {
    name,
    startState: () => ({ string: null, local: false, comment: false, code: false }),
    token(stream, state) {
      if (state.string) return string(stream, state);
      if (state.comment) return blockComment(stream, state);
      // The local part of a prefixed name, right after its prefix
      if (state.local) {
        state.local = false;
        if (stream.match(PN_LOCAL)) return "propertyName";
      }
      if (stream.eatSpace()) return null;

      const style = special(stream, state);
      if (style !== undefined) return style;

      if (stream.match("#")) {
        stream.skipToEnd();
        return "comment";
      }
      if (blockComments && stream.match("/*")) return blockComment(stream, state);
      if (stream.match(IRIREF)) return "url";
      const quote = stream.match(/^("""|'''|"|')/);
      if (quote) {
        state.string = quote[0];
        return string(stream, state);
      }
      if (stream.match(/^@(prefix|base)\b/)) return "keyword";
      if (stream.match(LANGTAG)) return "meta";
      if (stream.match(BLANK_NODE)) return "variableName";
      if (stream.match(NUMBER)) return "number";
      if (stream.match("^^")) return "operator";
      if (stream.match(PNAME_NS)) {
        state.local = true;
        return "namespace";
      }
      const word = stream.match(/^[A-Za-z_][\w-]*/);
      if (word) {
        if (exactSet.has(word[0]) || keywordSet.has(word[0].toLowerCase())) return "keyword";
        if (word[0] === "true" || word[0] === "false") return "bool";
        return null;
      }
      if (stream.match(/^[{}()[\]]/)) return "bracket";
      if (stream.match(/^[.,;]/)) return "punctuation";
      if (stream.match(/^[*+?|&=~^!<>/-]+/)) return "operator";
      stream.next();
      return null;
    },
    languageData: {
      commentTokens: blockComments ? { line: "#", block: { open: "/*", close: "*/" } } : { line: "#" },
    },
  };
}
