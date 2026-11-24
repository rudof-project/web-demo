// Helpers for the DOM, which all the modules of the page use.

// Makes an element of `doc` with a tag, properties (Object.assign) and
// children. Use this function in modules that the unit tests run with jsdom.
export function elementIn(doc, tag, props = {}, ...children) {
  const element = Object.assign(doc.createElement(tag), props);
  element.append(...children);
  return element;
}

// Makes an element of the document of the page.
export function el(tag, props = {}, ...children) {
  return elementIn(document, tag, props, ...children);
}
