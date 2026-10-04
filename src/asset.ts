/** Resolves a file in /public against the deploy base, so paths work on GitHub Pages too. */
export const asset = (path: string) =>
  // uploaded files (admin panel) already carry a full blob:/data:/http(s): URL
  /^(blob:|data:|https?:)/.test(path) ? path : import.meta.env.BASE_URL + path.replace(/^\//, '')
