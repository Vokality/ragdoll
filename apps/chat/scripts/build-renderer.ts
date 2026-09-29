import { rm } from "node:fs/promises";
import { join } from "node:path";

const outputDirectory = join(import.meta.dir, "..", "dist", "renderer");

// Bun Shell rm rejects mixed-separator paths on Windows.
await rm(outputDirectory, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: [`${import.meta.dir}/../index.html`],
  outdir: outputDirectory,
  target: "browser",
  minify: true,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  naming: {
    entry: "[name].[ext]",
    chunk: "[name]-[hash].[ext]",
    asset: "[name]-[hash].[ext]",
  },
});
if (!result.success)
  throw new AggregateError(result.logs, "Renderer build failed");
console.log(`Built renderer (${result.outputs.length} files)`);
