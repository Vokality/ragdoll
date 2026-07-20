const [packageName, ...args] = Bun.argv.slice(2);
if (!packageName) {
  throw new Error("A package name is required");
}

const packageJsonUrl = import.meta.resolve(`${packageName}/package.json`);
const packageJson = (await Bun.file(new URL(packageJsonUrl)).json()) as {
  bin?: string | Record<string, string>;
};
const binPath =
  typeof packageJson.bin === "string"
    ? packageJson.bin
    : packageJson.bin?.[packageName.split("/").at(-1) ?? packageName];

if (!binPath) {
  throw new Error(`Package '${packageName}' does not declare a runnable bin`);
}

const binUrl = new URL(binPath, packageJsonUrl);
process.argv.splice(1, process.argv.length - 1, binUrl.pathname, ...args);
await import(binUrl.href);
