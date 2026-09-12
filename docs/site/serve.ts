import { buildDocs } from "./build";
import { site } from "./config";

const preview = Bun.argv.includes("--preview");
const directory = `${import.meta.dir}/${preview ? "dist" : ".dev"}`;
async function sourceVersion() {
  const files = await Array.fromAsync(
    new Bun.Glob("**/*").scan({
      cwd: import.meta.dir,
      onlyFiles: true,
    }),
  );
  return files
    .filter(
      (path) =>
        !path.startsWith("dist/") &&
        (path.endsWith(".md") ||
          path.endsWith(".css") ||
          path.startsWith("public/")),
    )
    .sort()
    .map((path) => {
      const file = Bun.file(`${import.meta.dir}/${path}`);
      return `${path}:${file.lastModified}:${file.size}`;
    })
    .join("|");
}
let version = await sourceVersion();
let revision = crypto.randomUUID();
let rebuild: Promise<void> | undefined;
async function refresh() {
  const next = await sourceVersion();
  if (next === version) return;
  await buildDocs("development");
  version = next;
  revision = crypto.randomUUID();
}
if (!preview) await buildDocs("development");
if (!(await Bun.file(`${directory}/index.html`).exists()))
  throw new Error("Run bun run docs:build before preview");
const server = Bun.serve({
  hostname: "localhost",
  port: 4174,
  routes: {
    "/": Response.redirect(site.base, 302),
    "/ragdoll": Response.redirect(site.base, 302),
    "/ragdoll/__revision": async () => {
      if (preview) return new Response("Not found", { status: 404 });
      rebuild ??= refresh().finally(() => {
        rebuild = undefined;
      });
      await rebuild;
      return new Response(revision, {
        headers: { "Cache-Control": "no-store" },
      });
    },
    "/ragdoll/*": { dir: directory },
  },
});
console.log(`Lumen documentation: ${server.url.origin}${site.base}`);
