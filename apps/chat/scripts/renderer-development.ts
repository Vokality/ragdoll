import type { BunPlugin } from "bun";

// Bun executes hot updates as blob scripts. Keep that permission in the dev
// server's HTML transform so packaged HTML retains the source's strict policy.
const rendererDevelopment: BunPlugin = {
  name: "lumen-development-csp",
  setup({ onLoad }) {
    onLoad({ filter: /\.html$/ }, async ({ path }) => ({
      loader: "html",
      contents: new HTMLRewriter()
        .on('meta[http-equiv="Content-Security-Policy"]', {
          element(element) {
            const policy = element.getAttribute("content");
            if (!policy) throw new Error("Renderer security policy is missing");
            element.setAttribute(
              "content",
              policy.replace("script-src 'self'", "script-src 'self' blob:"),
            );
          },
        })
        .transform(await Bun.file(path).text()),
    }));
  },
};

export default rendererDevelopment;
