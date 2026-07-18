import { createExtension as createCharacterExtension } from "@vokality/ragdoll-extension-character";
import { createExtension as createPomodoroExtension } from "@vokality/ragdoll-extension-pomodoro";
import { createExtension as createTasksExtension } from "@vokality/ragdoll-extension-tasks";
import type { BuiltInExtensionDefinition } from "./services/extension-manager.js";

export const BUILT_IN_EXTENSIONS = [
  {
    packageName: "@vokality/ragdoll-extension-character",
    canDisable: false,
    capabilities: ["tools"],
    createExtension: createCharacterExtension,
  },
  {
    packageName: "@vokality/ragdoll-extension-tasks",
    canDisable: false,
    capabilities: ["tools", "stateChannels", "slots"],
    createExtension: createTasksExtension,
  },
  {
    packageName: "@vokality/ragdoll-extension-pomodoro",
    canDisable: false,
    capabilities: ["tools", "stateChannels", "slots"],
    createExtension: createPomodoroExtension,
  },
] as const satisfies readonly BuiltInExtensionDefinition[];
