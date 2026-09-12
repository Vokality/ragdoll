import { expect, test } from "bun:test";
import { $ } from "bun";

test("the configured Bun dev server permits hot-update scripts", async () => {
  const appRoot = `${import.meta.dir}/..`;
  const temporary = `${Bun.env.TMPDIR ?? Bun.env.TEMP ?? "/tmp"}/lumen-hmr-${crypto.randomUUID()}`;
  await $`mkdir -p ${temporary}`.quiet();
  let child: ReturnType<typeof Bun.spawn> | undefined;
  try {
    const script = `${temporary}/server.ts`;
    await Bun.write(script, `
      import renderer from ${JSON.stringify(`${appRoot}/index.html`)};
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        development: { hmr: true },
        routes: { "/": renderer },
      });
      console.log(server.url.href);
    `);
    child = Bun.spawn(["bun", "run", script], {
      cwd: appRoot,
      stdout: "pipe",
      stderr: "inherit",
    });
    if (typeof child.stdout === "number" || !child.stdout)
      throw new Error("Dev server output is unavailable");
    const reader = child.stdout.getReader();
    let output = "";
    try {
      while (!output.includes("\n")) {
        const { value, done } = await reader.read();
        if (done) throw new Error("Dev server exited before becoming ready");
        output += new TextDecoder().decode(value);
      }
    } finally {
      reader.releaseLock();
    }
    const response = await fetch(output.trim());
    expect(response.ok).toBe(true);
    const html = await response.text();
    expect(html).toContain("script-src 'self' blob: https://sdk.scdn.co;");
    expect(html).toContain("data-bun-dev-server-script");
  } finally {
    child?.kill();
    if (child) await child.exited;
    await $`rm -rf ${temporary}`.quiet();
  }
}, 15_000);
