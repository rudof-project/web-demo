// Inputs given by a URL (input-source.js).

import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { resolveUrl, formatOfUrl, fetchText, setupInputSources, setSource, setText, isUrlSource, urlOf, resolvedUrlOf, readUrlInput, urlInputsIn } from "../../input-source.js";

const WIKIDATA = [["wd", "http://www.wikidata.org/entity/"], ["es", "https://www.wikidata.org/wiki/Special:EntitySchemaText/"]];

describe("the URL of an input", () => {
  it("can be a prefixed name, with the prefixes of the endpoint", () => {
    expect(resolveUrl("es:E371", WIKIDATA)).toBe("https://www.wikidata.org/wiki/Special:EntitySchemaText/E371");
    expect(resolveUrl("  https://example.org/s.shex ", WIKIDATA)).toBe("https://example.org/s.shex");
    // A prefix that is not known: as it is
    expect(resolveUrl("foo:bar", WIKIDATA)).toBe("foo:bar");
    expect(resolveUrl(":x", [["", "https://example.org/"]])).toBe("https://example.org/x");
    expect(resolveUrl("", WIKIDATA)).toBe("");
  });

  it("says the format of its file, by its extension", () => {
    expect(formatOfUrl("https://example.org/data.nt")).toBe("ntriples");
    expect(formatOfUrl("https://example.org/schema.shex?v=2")).toBe("shexc");
    expect(formatOfUrl("https://www.wikidata.org/wiki/Special:EntitySchemaText/E371")).toBeUndefined();
    expect(formatOfUrl("es:E371")).toBeUndefined();
  });

  it("is read with fetch, and an error says why it can't be read", async () => {
    expect(await fetchText("https://e/x", async () => new Response("text"))).toBe("text");
    await expect(fetchText("https://e/x", async () => new Response("", { status: 404, statusText: "Not Found" }))).rejects.toThrow("404 Not Found");
    await expect(fetchText("https://e/x", async () => Promise.reject(new TypeError("Failed to fetch")))).rejects.toThrow(/CORS/);
  });
});

describe("the inputs given by URLs", () => {
  let doc;
  let changes;
  const files = { "https://e/data.nt": "<a> <b> <c> .", "https://www.wikidata.org/wiki/Special:EntitySchemaText/E1": "<S> {}" };
  beforeEach(() => {
    doc = new JSDOM(`<section id="tab"><div class="field"><div class="field-head"><label for="data">RDF data</label>
      <select id="data-format"><option value="turtle">Turtle</option><option value="ntriples">N-Triples</option></select></div>
      <textarea id="data" data-format-select="data-format">my data</textarea></div></section>`).window.document;
    changes = 0;
    setupInputSources(doc, ["data"], {
      prefixesOf: () => WIKIDATA,
      onChange: () => (changes += 1),
      fetch: async (url) => (url in files ? new Response(files[url]) : new Response("", { status: 404, statusText: "Not Found" })),
    });
  });
  const click = (source) => doc.querySelector(`#data-source [data-source="${source}"]`).dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles: true }));
  const type = (text) => {
    const input = doc.getElementById("data-url");
    input.value = text;
    input.dispatchEvent(new doc.defaultView.Event("input"));
  };

  it("have Text and URL next to their name, and URL shows a field instead of the editor", () => {
    expect(doc.querySelector(".field-head label + .source-switch")).not.toBeNull();
    expect(doc.getElementById("data-url-box").hidden).toBe(true);
    click("url");
    expect(isUrlSource("data")).toBe(true);
    expect(doc.getElementById("data-url-box").hidden).toBe(false);
    expect(doc.querySelector(".field").classList.contains("url-source")).toBe(true);
    expect(changes).toBe(1);
    type("es:E1");
    expect(urlOf("data")).toBe("es:E1");
    expect(resolvedUrlOf("data")).toBe("https://www.wikidata.org/wiki/Special:EntitySchemaText/E1");
    expect(doc.getElementById("data-url-hint").textContent).toBe("→ https://www.wikidata.org/wiki/Special:EntitySchemaText/E1");
    expect(urlInputsIn(doc.getElementById("tab"))).toEqual(["data"]);
    // Text gives back the text
    doc.getElementById("data").value = "read from the URL";
    click("text");
    expect(isUrlSource("data")).toBe(false);
    expect(doc.getElementById("data").value).toBe("my data");
  });

  it("are read into their textareas, with the format of their files", async () => {
    setSource(doc, "data", "url", { url: "https://e/data.nt" });
    expect(await readUrlInput(doc, "data")).toBe("https://e/data.nt");
    expect(doc.getElementById("data").value).toBe("<a> <b> <c> .");
    expect(doc.getElementById("data-format").value).toBe("ntriples");
    expect(doc.getElementById("data-url-hint").textContent).toBe("Read 13 characters from https://e/data.nt");
    // An error names the input
    setSource(doc, "data", "url", { url: "https://e/none.ttl" });
    await expect(readUrlInput(doc, "data")).rejects.toThrow("The RDF data can't be read from https://e/none.ttl: 404 Not Found");
    setSource(doc, "data", "url", { url: "" });
    await expect(readUrlInput(doc, "data")).rejects.toThrow("Write the URL of the RDF data, or choose Text.");
    // A text from the page: the input is text again
    setText(doc, "data", "new");
    expect(isUrlSource("data")).toBe(false);
    expect(doc.getElementById("data").value).toBe("new");
  });
});
