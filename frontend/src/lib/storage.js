// localStorage that never throws. Reading or writing it can fail outright: Safari with all cookies blocked raises a
// SecurityError on access, a full quota raises on write, and some embedded browsers have none. An unguarded call in a
// component or effect would then take the whole app down on load, over something the app can live without (staying
// signed in between visits). Callers get `null` / `false` and carry on for the visit.

export function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to remove if storage is unavailable.
  }
}
