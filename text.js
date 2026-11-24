// Helpers for the text that the page shows.

// A number and a word, in the singular or the plural: "1 triple", "2
// triples". `words` is the plural, when it is not the word with an "s".
// With `grouped`, the number has thousands separators ("1,200 nodes").
export function count(n, word, words = `${word}s`, { grouped = false } = {}) {
  const number = grouped ? n.toLocaleString("en-US") : String(n);
  return `${number} ${n === 1 ? word : words}`;
}
