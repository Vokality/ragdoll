import { createExtension as createCharacterExtension } from "@vokality/ragdoll-extension-character";
import characterPackageJson from "@vokality/ragdoll-extension-character/manifest" with { type: "json" };
import { createExtension as createPomodoroExtension } from "@vokality/ragdoll-extension-pomodoro";
import pomodoroPackageJson from "@vokality/ragdoll-extension-pomodoro/manifest" with { type: "json" };
import { createExtension as createSpotifyExtension } from "@vokality/ragdoll-extension-spotify";
import spotifyPackageJson from "@vokality/ragdoll-extension-spotify/manifest" with { type: "json" };
import { createExtension as createTasksExtension } from "@vokality/ragdoll-extension-tasks";
import tasksPackageJson from "@vokality/ragdoll-extension-tasks/manifest" with { type: "json" };
import {
  createExtensionPackageDescriptor,
  parseExtensionPackageJson,
} from "@vokality/ragdoll-extensions/loader";
import type { RagdollExtension } from "@vokality/ragdoll-extensions";
import type { BuiltInExtensionDefinition } from "./services/extension-manager.js";

function defineBuiltInExtension(
  packageJson: unknown,
  createExtension: () => RagdollExtension,
): BuiltInExtensionDefinition {
  const descriptor = createExtensionPackageDescriptor(
    parseExtensionPackageJson(JSON.stringify(packageJson)),
  );
  if (!descriptor) throw new Error("Built-in package is not an extension");
  return { descriptor, createExtension };
}

export const BUILT_IN_EXTENSIONS = [
  defineBuiltInExtension(characterPackageJson, createCharacterExtension),
  defineBuiltInExtension(tasksPackageJson, createTasksExtension),
  defineBuiltInExtension(pomodoroPackageJson, createPomodoroExtension),
  defineBuiltInExtension(spotifyPackageJson, createSpotifyExtension),
] as const satisfies readonly BuiltInExtensionDefinition[];
