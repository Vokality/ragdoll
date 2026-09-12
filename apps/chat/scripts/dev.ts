import { $ } from "bun";
import { startRendererServer } from "./renderer-server";

const started = performance.now();
// Reserve the port before rebuilding; a duplicate launch must not replace
// modules that an existing development session is serving.
const server = startRendererServer();
let electron: ReturnType<typeof Bun.spawn> | undefined;
let stopped = false;
const stop = () => {
  stopped = true;
  electron?.kill("SIGTERM");
};
try {
  console.log("Building workspace modules with Bun…");
  await $`bun run build:runtime`.cwd(`${import.meta.dir}/../../..`);
  await $`bun run build:electron`.cwd(`${import.meta.dir}/..`);
  // Request the HTML once so bundling errors stop startup before Electron opens.
  const response = await fetch(server.url);
  if (!response.ok)
    throw new Error(`Renderer build failed: HTTP ${response.status}`);
  console.log(
    `Lumen ready at ${server.url} in ${((performance.now() - started) / 1000).toFixed(1)}s`,
  );
  electron = Bun.spawn(["bun", "run", "electron"], {
    cwd: `${import.meta.dir}/..`,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const exitCode = await electron.exited;
  process.exitCode = stopped ? 0 : exitCode;
} finally {
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
  electron?.kill();
  await server.stop(true);
}
