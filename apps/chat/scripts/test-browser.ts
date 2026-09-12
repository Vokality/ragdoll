import { $ } from "bun";
import { browserPages } from "../tests/browser-pages";

const appRoot = `${import.meta.dir}/..`;
const workspaceRoot = `${appRoot}/../..`;
const temporary = `${Bun.env.TMPDIR ?? Bun.env.TEMP ?? "/tmp"}/ragdoll-browser-tests-${crypto.randomUUID()}`;
await $`mkdir -p ${temporary}`.quiet();
try {
  const renderer = await Bun.build({
    entrypoints: browserPages.map((page) => `${workspaceRoot}/${page}`),
    root: workspaceRoot,
    outdir: `${temporary}/renderer`,
    target: "browser",
    splitting: true,
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
  });
  if (!renderer.success)
    throw new AggregateError(renderer.logs, "Browser fixture build failed");
  const build = await Bun.build({
    entrypoints: [
      `${appRoot}/tests/browser-runner.ts`,
      `${appRoot}/electron/preload.ts`,
    ],
    target: "node",
    format: "cjs",
    external: ["electron"],
    outdir: temporary,
    naming: "[name].cjs",
  });
  if (!build.success)
    throw new AggregateError(build.logs, "Browser runner build failed");
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    routes: { "/*": { dir: `${temporary}/renderer` } },
  });
  try {
    const child = Bun.spawn({
      cmd: [
        "bunx",
        "--bun",
        "--no-install",
        "electron",
        ...(process.platform === "linux" ? ["--no-sandbox"] : []),
        `${temporary}/browser-runner.cjs`,
      ],
      cwd: appRoot,
      env: {
        ...process.env,
        RAGDOLL_TEST_ORIGIN: server.url.origin,
        RAGDOLL_TEST_PRELOAD: `${temporary}/preload.cjs`,
        RAGDOLL_TEST_PROFILE: `${temporary}/profile`,
        RAGDOLL_TEST_RENDERER: `${appRoot}/dist/renderer/index.html`,
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    process.exitCode = await child.exited;
  } finally {
    await server.stop(true);
  }
} finally {
  await $`rm -rf ${temporary}`.quiet();
}
