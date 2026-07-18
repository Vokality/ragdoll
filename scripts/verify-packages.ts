import { $ } from "bun";

const rootDirectory = `${import.meta.dir}/..`;
const packageDirectories = [
  "packages/ragdoll",
  "packages/ragdoll-extensions",
  "packages/ragdoll-extension-character",
  "packages/ragdoll-extension-tasks",
  "packages/ragdoll-extension-pomodoro",
  "packages/ragdoll-extension-spotify",
  "examples/extension-weather",
] as const;

const temporaryRoot = Bun.env.TMPDIR ?? "/tmp";
const temporaryDirectory = `${temporaryRoot.replace(/\/$/, "")}/ragdoll-packages-${crypto.randomUUID()}`;
await $`mkdir -p ${temporaryDirectory}`.quiet();

try {
  const packedDependencies: Record<string, string> = {};

  for (const packageDirectory of packageDirectories) {
    const absoluteDirectory = `${rootDirectory}/${packageDirectory}`;
    const manifest = (await Bun.file(
      `${absoluteDirectory}/package.json`,
    ).json()) as {
      name: string;
    };
    const existingTarballs = new Set(
      await Array.fromAsync(new Bun.Glob("*.tgz").scan(temporaryDirectory)),
    );

    await $`bun pm pack --destination ${temporaryDirectory} --cwd ${absoluteDirectory}`.quiet();

    const tarballs = await Array.fromAsync(
      new Bun.Glob("*.tgz").scan(temporaryDirectory),
    );
    const tarball = tarballs.find(
      (candidate) => !existingTarballs.has(candidate),
    );
    if (!tarball) {
      throw new Error(`Packing ${manifest.name} did not produce a tarball.`);
    }

    packedDependencies[manifest.name] = `file:${temporaryDirectory}/${tarball}`;
  }

  await Bun.write(
    `${temporaryDirectory}/package.json`,
    JSON.stringify(
      {
        name: "ragdoll-package-verification",
        private: true,
        type: "module",
        dependencies: {
          ...packedDependencies,
          react: "19.2.0",
        },
        overrides: packedDependencies,
      },
      null,
      2,
    ),
  );

  await Bun.write(
    `${temporaryDirectory}/verify.ts`,
    `
import { RagdollCharacter } from "@vokality/ragdoll";
import { MockClock } from "@vokality/ragdoll/testing";
import { createRegistry } from "@vokality/ragdoll-extensions";
import { createLoader } from "@vokality/ragdoll-extensions/loader";
import { createSlotState } from "@vokality/ragdoll-extensions/slots";
import { SlotBar } from "@vokality/ragdoll-extensions/ui";
import { createExtension as createCharacter } from "@vokality/ragdoll-extension-character";
import { createExtension as createTasks } from "@vokality/ragdoll-extension-tasks";
import { createExtension as createPomodoro } from "@vokality/ragdoll-extension-pomodoro";
import { createExtension as createSpotify } from "@vokality/ragdoll-extension-spotify";
import { createExtension as createWeather } from "@example/ragdoll-extension-weather";

const exportsToCheck = [
  RagdollCharacter,
  MockClock,
  createRegistry,
  createLoader,
  createSlotState,
  SlotBar,
];
if (exportsToCheck.some((value) => value === undefined)) {
  throw new Error("A public package entrypoint did not export its declared API.");
}

const factories = [
  createCharacter,
  createTasks,
  createPomodoro,
  createSpotify,
  createWeather,
];
const extensions = factories.map((factory) => factory());
if (extensions.some((extension) => typeof extension.activate !== "function")) {
  throw new Error("An extension package did not create a valid extension.");
}

const registry = createRegistry();
const weather = createWeather({ defaultUnits: "fahrenheit" });
await registry.register(weather, { host: { capabilities: new Set() } });
const result = await registry.executeTool("getWeather", { location: "Paris" });
if (!result.success) {
  throw new Error(result.error ?? "Packed weather extension execution failed.");
}
await registry.destroy();
`,
  );

  await $`bun install`.cwd(temporaryDirectory).quiet();
  await $`bun run verify.ts`.cwd(temporaryDirectory);
  console.log(
    `Verified ${packageDirectories.length} packed packages in an isolated Bun project.`,
  );
} finally {
  await $`rm -rf ${temporaryDirectory}`.quiet();
}
