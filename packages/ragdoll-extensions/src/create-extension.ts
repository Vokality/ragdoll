/**
 * Factory function for creating Ragdoll extensions using declarative configuration.
 */

import type {
  ExtensionConfig,
  ExtensionContext,
  ExtensionHostEnvironment,
  ExtensionRuntimeContribution,
  ExtensionServiceDefinition,
  ExtensionStateChannel,
  ExtensionTool,
  RagdollExtension,
} from "./types.js";

function resolveList<T>(
  entry:
    | T[]
    | ((host: ExtensionHostEnvironment, context: ExtensionContext) => T[])
    | undefined,
  host: ExtensionHostEnvironment,
  context: ExtensionContext,
): T[] {
  if (!entry) {
    return [];
  }
  if (typeof entry === "function") {
    return entry(host, context);
  }
  return entry;
}

function validateConfig(config: ExtensionConfig): void {
  if (!config.id || typeof config.id !== "string") {
    throw new Error("Extension config requires a non-empty string 'id'");
  }
  if (!config.name || typeof config.name !== "string") {
    throw new Error("Extension config requires a non-empty string 'name'");
  }
  if (!config.version || typeof config.version !== "string") {
    throw new Error("Extension config requires a non-empty string 'version'");
  }
  if (
    !config.createRuntime &&
    !config.tools &&
    !config.services &&
    !config.stateChannels &&
    !config.slots
  ) {
    throw new Error(
      `Extension '${config.id}' must provide at least one capability (tools, services, stateChannels, slots) or a createRuntime() factory`,
    );
  }
}

export function createExtension(config: ExtensionConfig): RagdollExtension {
  validateConfig(config);

  let activeRuntime: ExtensionRuntimeContribution | null = null;

  return {
    manifest: {
      id: config.id,
      name: config.name,
      version: config.version,
      description: config.description,
      requiredCapabilities: config.requiredCapabilities,
    },

    async activate(host, context) {
      await config.onInitialize?.(context, host);

      const runtimeFromFactory = config.createRuntime
        ? await config.createRuntime(host, context)
        : undefined;

      const tools: ExtensionTool[] = [
        ...(runtimeFromFactory?.tools ?? []),
        ...resolveList<ExtensionTool>(config.tools, host, context),
      ];
      const services: ExtensionServiceDefinition[] = [
        ...(runtimeFromFactory?.services ?? []),
        ...resolveList<ExtensionServiceDefinition>(config.services, host, context),
      ];
      const stateChannels: ExtensionStateChannel[] = [
        ...(runtimeFromFactory?.stateChannels ?? []),
        ...resolveList<ExtensionStateChannel>(config.stateChannels, host, context),
      ];
      const slots = [
        ...(runtimeFromFactory?.slots ?? []),
        ...resolveList(config.slots, host, context),
      ];

      const hasCapability =
        tools.length > 0 || services.length > 0 || stateChannels.length > 0 || slots.length > 0;
      if (!hasCapability) {
        throw new Error(
          `Extension '${config.id}' did not register any capabilities during activation`,
        );
      }

      const runtime: ExtensionRuntimeContribution = {
        tools,
        services,
        stateChannels,
        slots,
        metadata: runtimeFromFactory?.metadata,
        dispose: runtimeFromFactory?.dispose,
      };

      activeRuntime = runtime;
      return runtime;
    },

    async deactivate(context) {
      if (activeRuntime?.dispose) {
        await activeRuntime.dispose();
      }
      activeRuntime = null;
      await config.onDestroy?.(context);
    },
  } satisfies RagdollExtension;
}
