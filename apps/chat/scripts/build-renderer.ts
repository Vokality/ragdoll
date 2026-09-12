import { $ } from "bun";

await $`rm -rf ${import.meta.dir}/../dist/renderer`.quiet();
const result = await Bun.build({
  entrypoints: [`${import.meta.dir}/../index.html`],
  outdir: `${import.meta.dir}/../dist/renderer`,
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
