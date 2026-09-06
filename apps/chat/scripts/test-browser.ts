import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const appRoot = resolve(import.meta.dir, "..");
const temporary = await mkdtemp(join(tmpdir(), "ragdoll-browser-tests-"));
try {
  const server = await createServer({
    configFile: false,
    root: resolve(appRoot, "../.."),
    cacheDir: join(temporary, "vite-cache"),
    plugins: [react()],
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "warn",
  });
  try {
    const entry = join(temporary, "runner.cjs");
    const build = await Bun.build({
      entrypoints: [join(appRoot, "tests/browser-runner.ts")],
      target: "node",
      format: "cjs",
      external: ["electron"],
      outdir: temporary,
      naming: "runner.cjs",
    });
    if (!build.success)
      throw new AggregateError(build.logs, "Browser test runner build failed");
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string")
      throw new Error("Test server did not bind a TCP port");
    const child = Bun.spawn({
      cmd: [
        "bunx",
        "--bun",
        "--no-install",
        "electron",
        // Linux sandbox initialization happens before the fixture entry runs.
        // This exception applies only to the disposable browser-test process.
        ...(process.platform === "linux" ? ["--no-sandbox"] : []),
        entry,
      ],
      cwd: appRoot,
      env: {
        ...process.env,
        RAGDOLL_TEST_ORIGIN: `http://127.0.0.1:${address.port}`,
        RAGDOLL_TEST_PROFILE: join(temporary, "profile"),
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    process.exitCode = await child.exited;
  } finally {
    await server.close();
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
