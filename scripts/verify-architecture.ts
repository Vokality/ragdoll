import { dirname, relative, resolve, sep } from "node:path";

const workspaceRoot = resolve(import.meta.dir, "..");
const sourceGlob = new Bun.Glob("{apps,packages,examples}/**/*.{ts,tsx}");
const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
const violations: string[] = [];

function sourcePath(file: string): string {
  return file.split(sep).join("/");
}

function resolvedImport(file: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  return sourcePath(relative(workspaceRoot, resolve(dirname(file), specifier)));
}

function report(file: string, specifier: string, rule: string): void {
  violations.push(
    `${sourcePath(relative(workspaceRoot, file))}: ${rule} (${specifier})`,
  );
}

async function readPackageJson(
  directory: string,
): Promise<{ name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string> }> {
  return Bun.file(resolve(workspaceRoot, directory, "package.json")).json();
}

function dependencyNames(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}): string[] {
  return [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ];
}

const ragdollPackage = await readPackageJson("packages/ragdoll");
for (const name of dependencyNames(ragdollPackage)) {
  if (
    name.startsWith("@vokality/ragdoll-extension") ||
    name === "electron" ||
    name.startsWith("apps/")
  ) {
    violations.push(
      `packages/ragdoll/package.json: character core cannot depend on apps or extensions (${name})`,
    );
  }
}

const extensionsPackage = await readPackageJson("packages/ragdoll-extensions");
for (const name of dependencyNames(extensionsPackage)) {
  if (
    name.startsWith("@vokality/ragdoll-extension-") ||
    name === "electron"
  ) {
    violations.push(
      `packages/ragdoll-extensions/package.json: extension framework cannot depend on apps or first-party extensions (${name})`,
    );
  }
}

const emotePackage = await readPackageJson("apps/emote");
for (const name of dependencyNames(emotePackage)) {
  if (
    name === "@vokality/ragdoll-extensions" ||
    name.startsWith("@vokality/ragdoll-extension-")
  ) {
    violations.push(
      `apps/emote/package.json: Emote is an MCP character host and must not depend on the extension framework or first-party extensions (${name})`,
    );
  }
}

const extensionPackageDirs = (
  await Array.fromAsync(
    new Bun.Glob("packages/ragdoll-extension-*/package.json").scan({
      cwd: workspaceRoot,
    }),
  )
).map((manifest) => dirname(manifest));
for (const directory of extensionPackageDirs) {
  const pkg = await readPackageJson(directory);
  for (const name of dependencyNames(pkg)) {
    if (
      (name.startsWith("@vokality/ragdoll-extension-") &&
        name !== pkg.name) ||
      name === "electron"
    ) {
      violations.push(
        `${directory}/package.json: extension packages cannot depend on apps or other extensions (${name})`,
      );
    }
  }
}

const electronApi = await Bun.file(
  resolve(workspaceRoot, "apps/chat/electron/electron-api.ts"),
).text();
const declaredIpcChannels = new Set(
  [...electronApi.matchAll(/:\s*"([a-z]+:[a-z0-9-]+)"/g)].map(
    (match) => match[1],
  ),
);
const ipcChannelLiteral =
  /["']((?:auth|chat|extensions|settings|shell):[a-z0-9-]+)["']/g;

for await (const relativeFile of sourceGlob.scan({ cwd: workspaceRoot })) {
  if (
    relativeFile.includes("/dist/") ||
    relativeFile.includes("/node_modules/") ||
    relativeFile.endsWith(".test.ts") ||
    relativeFile.endsWith(".test.tsx")
  ) {
    continue;
  }

  const file = resolve(workspaceRoot, relativeFile);
  const normalizedFile = sourcePath(relativeFile);
  const extensionPackage = normalizedFile.match(
    /^(packages\/ragdoll-extension-[^/]+)/,
  )?.[1];
  const contents = await Bun.file(file).text();
  for (const match of contents.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;
    const target = resolvedImport(file, specifier);

    if (
      normalizedFile.startsWith("packages/ragdoll/src/") &&
      (specifier.startsWith("@vokality/ragdoll-extension") ||
        specifier === "electron" ||
        target?.startsWith("apps/") ||
        target?.startsWith("packages/ragdoll-extension"))
    ) {
      report(
        file,
        specifier,
        "character core cannot depend on apps or extensions",
      );
    }

    if (
      normalizedFile.startsWith("packages/ragdoll-extensions/src/") &&
      (specifier.startsWith("@vokality/ragdoll-extension-") ||
        specifier === "electron" ||
        target?.startsWith("apps/") ||
        target?.startsWith("packages/ragdoll-extension-"))
    ) {
      report(
        file,
        specifier,
        "the extension framework cannot depend on apps or first-party extensions",
      );
    }

    if (
      extensionPackage &&
      (specifier.startsWith("@vokality/ragdoll-extension-") ||
        specifier === "electron" ||
        target?.startsWith("apps/") ||
        (/^packages\/ragdoll-extension-[^/]+\//.test(target ?? "") &&
          !target?.startsWith(`${extensionPackage}/`)))
    ) {
      report(
        file,
        specifier,
        "extension packages cannot depend on apps, Electron, or other extensions",
      );
    }

    if (
      normalizedFile.startsWith("packages/ragdoll-extensions/src/") &&
      !normalizedFile.startsWith("packages/ragdoll-extensions/src/ui/") &&
      (specifier === "react" || specifier.startsWith("react/"))
    ) {
      report(
        file,
        specifier,
        "the default extension framework must remain React-free",
      );
    }

    if (
      normalizedFile.startsWith("apps/chat/src/") &&
      (specifier === "electron" ||
        specifier === "@vokality/ragdoll-extensions/loader" ||
        (target?.startsWith("apps/chat/electron/") &&
          target !== "apps/chat/electron/electron-api"))
    ) {
      report(
        file,
        specifier,
        "the chat renderer may only consume the Electron API contract",
      );
    }

    if (
      normalizedFile.startsWith("apps/emote/") &&
      (specifier === "@vokality/ragdoll-extensions" ||
        specifier.startsWith("@vokality/ragdoll-extensions/") ||
        specifier.startsWith("@vokality/ragdoll-extension-"))
    ) {
      report(
        file,
        specifier,
        "Emote is an MCP character host, not a Ragdoll extension host",
      );
    }

    if (
      !normalizedFile.includes("/testing/") &&
      (specifier === "@vokality/ragdoll/testing" ||
        target?.includes("/testing/"))
    ) {
      report(
        file,
        specifier,
        "production source cannot import testing helpers",
      );
    }
  }

  if (
    normalizedFile.startsWith("apps/chat/") &&
    normalizedFile !== "apps/chat/electron/electron-api.ts"
  ) {
    for (const match of contents.matchAll(ipcChannelLiteral)) {
      const channel = match[1];
      if (channel && !declaredIpcChannels.has(channel)) {
        report(
          file,
          channel,
          "Electron IPC channel names must be declared in IPC_CHANNELS",
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("Architecture boundaries verified");
