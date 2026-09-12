import renderer from "../index.html";

export function startRendererServer() {
  return Bun.serve({
    hostname: "localhost",
    port: 5173,
    development: { hmr: true, console: true },
    routes: { "/": renderer, "/index.html": renderer },
  });
}

if (import.meta.main) {
  const server = startRendererServer();
  console.log(`Lumen renderer: ${server.url}`);
}
