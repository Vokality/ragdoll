const root = `${import.meta.dir}/..`;
const manifests = Array.fromAsync(
  new Bun.Glob("packages/*/package.json").scan({ cwd: root }),
);

// Development needs executable modules. Declaration generation and type checks
// belong to the library build used by CI and package publication.
for (const manifest of (await manifests).sort()) {
  const directory = `${root}/${manifest.slice(0, -"/package.json".length)}`;
  const source = `${directory}/src`;
  const entrypoints = (
    await Array.fromAsync(
      new Bun.Glob("**/*.{ts,tsx}").scan({ cwd: source, absolute: true }),
    )
  ).filter((path) => !/\.(?:test|d)\.tsx?$/.test(path));
  // Keep declarations from the last checked build available to editors.
  // The normal library build cleans and regenerates them before publication.
  for await (const output of new Bun.Glob("dist/**/*").scan({
    cwd: directory,
    onlyFiles: true,
  })) {
    if (!/\.d\.ts(?:\.map)?$/.test(output))
      await Bun.file(`${directory}/${output}`).delete();
  }
  const result = await Bun.build({
    entrypoints,
    root: source,
    outdir: `${directory}/dist`,
    target: "browser",
    jsx: { development: false },
    packages: "external",
    splitting: true,
    sourcemap: "linked",
    naming: { entry: "[dir]/[name].js", chunk: "chunks/[name]-[hash].js" },
  });
  if (!result.success)
    throw new AggregateError(result.logs, `Failed to build ${manifest}`);
  console.log(`Built ${manifest.slice(0, -"/package.json".length)}`);
}
