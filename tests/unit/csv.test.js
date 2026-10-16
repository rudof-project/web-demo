// CSV (csv.js): rows of cells, with quoted cells, and back to text.

import { describe, it, expect } from "vitest";
import { parseCsv, serializeCsv } from "../../csv.js";

describe("parseCsv", () => {
  it("reads rows and cells, with empty cells", () => {
    expect(parseCsv("a,b,c\n1,,3\n")).toEqual([["a", "b", "c"], ["1", "", "3"]]);
  });

  it("reads quoted cells, with commas, quotes and line breaks", () => {
    expect(parseCsv('x,"a, b","say ""hi""","two\nlines"')).toEqual([["x", "a, b", 'say "hi"', "two\nlines"]]);
  });

  it("reads Windows line breaks", () => {
    expect(parseCsv("a,b\r\nc,d\r\n")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("keeps a last empty cell, and gives no row for empty text", () => {
    expect(parseCsv("a,")).toEqual([["a", ""]]);
    expect(parseCsv("")).toEqual([]);
  });
});

describe("serializeCsv", () => {
  it("writes the cells, in quotes when they need them", () => {
    expect(serializeCsv([["a", "b, c", 'x"y', "two\nlines", " pad", ""]])).toBe('a,"b, c","x""y","two\nlines"," pad",');
  });

  it("gives back the text it read", () => {
    const text = 'shapeID,propertyID,note\nPerson,:name,"Name, given and family"\nPerson,:knows,';
    expect(serializeCsv(parseCsv(text))).toBe(text);
  });
});
