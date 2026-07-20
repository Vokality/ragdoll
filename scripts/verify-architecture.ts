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
      extensionPackage &&
      (specifier.startsWith("@vokality/ragdoll-extension-") ||
        target?.startsWith("apps/") ||
        (/^packages\/ragdoll-extension-[^/]+\//.test(target ?? "") &&
          !target?.startsWith(`${extensionPackage}/`)))
    ) {
      report(
        file,
        specifier,
        "extension packages cannot depend on apps or other extensions",
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
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("Architecture boundaries verified");
