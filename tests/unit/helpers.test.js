// @vitest-environment jsdom
// The helpers that all the modules of the page share: dom.js, text.js and
// storage.js.

import { describe, it, expect, vi, afterEach } from "vitest";
import { el, elementIn } from "../../dom.js";
import { count } from "../../text.js";
import { storageOrNone, stored, store } from "../../storage.js";

describe("dom.js", () => {
  it("makes an element with properties and children", () => {
    const e = el("p", { className: "note", title: "A note" }, "Text ", el("code", {}, "x"));
    expect(e.outerHTML).toBe('<p class="note" title="A note">Text <code>x</code></p>');
  });

  it("makes the element in the document that it gets", () => {
    const doc = document.implementation.createHTMLDocument("");
    expect(elementIn(doc, "span", {}, "a").ownerDocument).toBe(doc);
  });
});

describe("text.js", () => {
  it("writes a count in the singular or the plural", () => {
    expect(count(1, "triple")).toBe("1 triple");
    expect(count(0, "triple")).toBe("0 triples");
    expect(count(2, "query", "queries")).toBe("2 queries");
  });

  it("writes thousands separators only when asked", () => {
    expect(count(1200, "node")).toBe("1200 nodes");
    expect(count(1200, "node", undefined, { grouped: true })).toBe("1,200 nodes");
  });
});

describe("storage.js", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps and reads a value", () => {
    store("helpers-test", "a");
    expect(stored("helpers-test")).toBe("a");
    expect(storageOrNone()).toBe(localStorage);
  });

  it("does not fail when the browser refuses the storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(stored("helpers-test")).toBeNull();
    expect(() => store("helpers-test", "b")).not.toThrow();
  });
});
