export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (typeof globalThis.DOMMatrix === "undefined") {
      // pdfjs-dist references DOMMatrix (browser API) in Node.js — stub it
      // @ts-expect-error polyfill for server runtime
      globalThis.DOMMatrix = class DOMMatrix {
        constructor() {
          return new Proxy(this as object, {
            get: (_t, prop) => (prop === "is2D" ? true : 0),
          });
        }
      };
    }
  }
}
