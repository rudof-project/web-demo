// The page (index.html) as text, for the unit tests that read its inputs.

import { readFileSync } from "node:fs";
import { exampleText } from "../../inputs.js";

export const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

const unescape = (text) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// The text of a textarea of the page: its example (data-example), or its text
export function textarea(id) {
  const [, attributes, text] = html.match(new RegExp(`<textarea id="${id}"([^>]*)>([\\s\\S]*?)</textarea>`));
  const example = attributes.match(/data-example="([^"]+)"/);
  return example ? exampleText(example[1]) : unescape(text);
}
