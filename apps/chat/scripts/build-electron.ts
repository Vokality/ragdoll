const electronDirectory = `${import.meta.dir}/../electron`;
const outputDirectory = `${import.meta.dir}/../dist/electron`;

const builds = await Promise.all([
  Bun.build({
    entrypoints: [`${electronDirectory}/main.ts`],
    outdir: outputDirectory,
    target: "node",
    format: "esm",
    external: ["electron"],
    naming: "main.js",
  }),
  Bun.build({
    entrypoints: [`${electronDirectory}/preload.ts`],
    outdir: outputDirectory,
    target: "node",
    format: "cjs",
    external: ["electron"],
    naming: "preload.cjs",
  }),
]);

for (const build of builds) {
  if (!build.success) {
    for (const log of build.logs) console.error(log);
    throw new Error("Electron build failed");
  }
}
