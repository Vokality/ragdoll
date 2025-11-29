import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

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
};

async function main() {
  if (watch) {
    const ctx = await esbuild.context(extensionOptions);
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await esbuild.build(extensionOptions);
    await esbuild.build(mcpServerOptions);
    console.log("Build complete");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});



