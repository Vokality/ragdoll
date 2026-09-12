import preview from "../packages/ragdoll/tests/renderers/preview.html";

const server = Bun.serve({
  hostname: "localhost",
  port: 5174,
  development: { hmr: true },
  routes: { "/packages/ragdoll/tests/renderers/preview.html": preview },
});
console.log(
  `Character review: ${server.url}packages/ragdoll/tests/renderers/preview.html`,
);
