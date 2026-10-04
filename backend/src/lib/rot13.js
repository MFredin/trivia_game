// Letter rotation by 13 — its own inverse. Only used to keep lib/bioFilter.js's built-in
// blocklist from being a plain-text list of slurs in the repository; it is obscuring, not secrecy.
export function rot13(text) {
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}
