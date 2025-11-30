import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");
const define = {
  "process.env.NODE_ENV": JSON.stringify(
    production ? "production" : "development",
  ),
};

// Extension build options
const extensionOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  sourcemap: !production,
  minify: production,
  target: "node18",
  define,
  logLevel: "info",
  legalComments: "none",
};

// MCP server build options (standalone, no vscode dependency)
const mcpServerOptions = {
  entryPoints: ["src/mcp-server.ts"],
  bundle: true,
  outfile: "dist/mcp-server.js",
  format: "esm",
  platform: "node",
  sourcemap: !production,
  minify: production,
  target: "node18",
  define,
  logLevel: "info",
  legalComments: "none",
};

async function main() {
  if (watch) {
    const [extensionCtx, serverCtx] = await Promise.all([
      esbuild.context(extensionOptions),
      esbuild.context(mcpServerOptions),
    ]);
    await Promise.all([extensionCtx.watch(), serverCtx.watch()]);
    console.log("Watching for changes...");
    return;
  }

  await Promise.all([
    esbuild.build(extensionOptions),
    esbuild.build(mcpServerOptions),
  ]);
  console.log("Build complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
