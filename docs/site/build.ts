import { $ } from "bun";
import { site } from "./config";
import { renderMarkdown, validateLinks } from "./site-data";
import { renderPage } from "./template";

export async function buildDocs(
  mode: "development" | "production" = "production",
) {
  const directory = `${import.meta.dir}/${mode === "development" ? ".dev" : "dist"}`;
  const started = performance.now();
  const sources = (
    await Array.fromAsync(
      new Bun.Glob("**/*.md").scan({ cwd: import.meta.dir }),
    )
  )
    .filter((path) => !path.startsWith("dist/") && !path.startsWith("public/"))
    .sort();
  const pages = await Promise.all(
    sources.map(async (source) => {
      const page = await renderMarkdown(
        source,
        await Bun.file(`${import.meta.dir}/${source}`).text(),
      );
      const git = Bun.spawn(
        ["git", "log", "-1", "--format=%cI", "--", `docs/site/${source}`],
        { cwd: `${import.meta.dir}/../..`, stdout: "pipe", stderr: "ignore" },
      );
      const updated = (await new Response(git.stdout).text()).trim();
      await git.exited;
      return { ...page, updated };
    }),
  );
  const output = new Map<string, string | Bun.BunFile>();
  for (const page of pages) {
    let html = renderPage(page, pages);
    if (mode === "development")
      html = html.replace(
        "</body>",
        `<script src="${site.base}__reload.js"></script></body>`,
      );
    output.set(
      page.path.endsWith(".html") ? page.path : `${page.path}index.html`,
      html,
    );
  }
  if (mode === "development")
    output.set(
      "__reload.js",
      `let revision; setInterval(async () => { try { const next = await (await fetch("${site.base}__revision", { cache: "no-store" })).text(); if (revision !== undefined && revision !== next) location.reload(); revision = next; } catch {} }, 1000);`,
    );
  for await (const asset of new Bun.Glob("**/*").scan({
    cwd: `${import.meta.dir}/public`,
    onlyFiles: true,
  })) {
    output.set(asset, Bun.file(`${import.meta.dir}/public/${asset}`));
  }
  const bundled = await Bun.build({
    entrypoints: [
      `${import.meta.dir}/theme.css`,
      `${import.meta.dir}/client.ts`,
    ],
    target: "browser",
    minify: true,
    publicPath: site.base,
    naming: { entry: "[name].[ext]", asset: "assets/[name]-[hash].[ext]" },
  });
  if (!bundled.success)
    throw new AggregateError(
      bundled.logs,
      "Documentation assets failed to build",
    );
  // Include bundled assets in link validation before replacing the last good build.
  for (const artifact of bundled.outputs)
    output.set(artifact.path.replace(/^\.\//, ""), "");
  await validateLinks(output);
  await $`rm -rf ${directory}`.quiet();
  for (const [path, content] of output)
    await Bun.write(`${directory}/${path}`, content);
  for (const artifact of bundled.outputs)
    await Bun.write(
      `${directory}/${artifact.path.replace(/^\.\//, "")}`,
      artifact,
    );
  await Bun.write(`${directory}/.nojekyll`, "");
  console.log(
    `Built ${pages.length} documentation pages in ${((performance.now() - started) / 1000).toFixed(2)}s`,
  );
  return pages;
}

if (import.meta.main) await buildDocs();
