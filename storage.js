// The browser storage (localStorage) of the page. The browser can refuse
// access to the storage (for example, in private windows). Then the page
// does not keep the value, and it uses the default.

// The storage, or undefined when the browser refuses access
export function storageOrNone() {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

// The value of a key, or null
export function stored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function store(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The browser does not keep the value.
  }
}
