const platformPackage = `@typescript/typescript-${process.platform}-${process.arch}`;
const packageJsonUrl = import.meta.resolve(`${platformPackage}/package.json`);
const executableUrl = new URL(
  `./lib/tsc${process.platform === "win32" ? ".exe" : ""}`,
  packageJsonUrl,
);
const decodedPath = decodeURIComponent(executableUrl.pathname);
const executablePath =
  process.platform === "win32"
    ? decodedPath.replace(/^\/([A-Za-z]:)/, "$1")
    : decodedPath;

if (!(await Bun.file(executablePath).exists())) {
  throw new Error(
    `TypeScript compiler executable not found: ${executablePath}`,
  );
}

const compiler = Bun.spawn({
  cmd: [executablePath, ...Bun.argv.slice(2)],
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(await compiler.exited);
