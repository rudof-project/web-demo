// jsdom has no layout: CodeMirror measures text with these, which jsdom lacks.
if (typeof Range !== "undefined") {
  const empty = { length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] };
  Range.prototype.getClientRects ??= () => empty;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0);
}
