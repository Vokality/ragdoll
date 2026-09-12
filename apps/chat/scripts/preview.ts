const directory = `${import.meta.dir}/../dist/renderer`;
if (!(await Bun.file(`${directory}/index.html`).exists())) {
  throw new Error("Build Lumen before running preview");
}
const server = Bun.serve({
  hostname: "localhost",
  port: 4173,
  routes: { "/*": { dir: directory } },
});
console.log(`Lumen production renderer: ${server.url}`);
