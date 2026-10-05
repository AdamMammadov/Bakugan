/** Resolves a file in /public against the deploy base, so paths work on GitHub Pages too. */
export const asset = (path: string) =>
  // full blob:/data:/http(s): URLs are used as they are
  /^(blob:|data:|https?:)/.test(path) ? path : import.meta.env.BASE_URL + path.replace(/^\//, '')
