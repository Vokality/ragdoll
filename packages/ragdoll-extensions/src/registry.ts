/**
 * Event-driven extension registry that manages runtime contributions and capability maps.
 */

import type {
  ExtensionContributionMetadata,
  ExtensionContext,
  ExtensionRuntimeContribution,
  ExtensionServiceDefinition,
  ExtensionStateChannel,
  ExtensionTool,
  RagdollExtension,
  RegisterOptions,
  RegistryEvent,
  RegistryEventCallback,
  RegistryEventType,
  ToolDefinition,
  ToolExecutionContext,
  ToolResult,
  ValidationResult,
} from "./types.js";
import type {
  ExtensionHostCapability,
  ExtensionHostEnvironment,
} from "./types/host-environment.js";
import type { ExtensionSlot } from "./slots.js";

interface ToolEntry {
  extensionId: string;
  tool: ExtensionTool;
}

interface ServiceEntry {
  extensionId: string;
  definition: ExtensionServiceDefinition;
}

interface StateChannelEntry {
  extensionId: string;
  channel: ExtensionStateChannel;
}

interface SlotEntry {
  extensionId: string;
  slot: ExtensionSlot;
}

interface RegisteredExtension {
  extension: RagdollExtension;
  host: ExtensionHostEnvironment;
  context: ExtensionContext;
  contribution: ExtensionRuntimeContribution;
  registeredAt: number;
  capabilities: {
    tools: string[];
    services: string[];
    stateChannels: string[];
    slots: string[];
  };
}

class RegistryEventBus {
  private listeners: Map<RegistryEventType, Set<RegistryEventCallback>> =
    new Map();

  on(
    eventType: RegistryEventType,
    callback: RegistryEventCallback,
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  async emit(event: RegistryEvent): Promise<void> {
    const callbacks = this.listeners.get(event.type);
    if (!callbacks || callbacks.size === 0) {
      return;
    }

    const executions = Array.from(callbacks).map(async (callback) => {
      try {
        await callback(event);
      } catch (error) {
        console.error(
          `Error in registry event listener for '${event.type}':`,
          error,
        );
      }
    });

    await Promise.allSettled(executions);
  }

  getListenerCount(): number {
    let count = 0;
    for (const set of this.listeners.values()) {
      count += set.size;
    }
    return count;
  }

  clear(eventType?: RegistryEventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
      return;
    }
    this.listeners.clear();
  }
}

function ensureHostCapabilities(
  extensionId: string,
  required: ReadonlyArray<ExtensionHostCapability> | undefined,
  host: ExtensionHostEnvironment,
): void {
  if (!required || required.length === 0) {
    return;
  }
  const available = host.capabilities ?? new Set();
  for (const capability of required) {
    if (!available.has(capability)) {
      throw new Error(
        `Extension '${extensionId}' requires missing host capability '${capability}'. Update the host environment to provide it.`,
      );
    }
  }
}

function assertHasCapabilities(
  extensionId: string,
  contribution: ExtensionRuntimeContribution,
): void {
  const hasCapability = Boolean(
    (contribution.tools && contribution.tools.length > 0) ||
    (contribution.services && contribution.services.length > 0) ||
    (contribution.stateChannels && contribution.stateChannels.length > 0) ||
    (contribution.slots && contribution.slots.length > 0),
  );
  if (!hasCapability) {
    throw new Error(
      `Extension '${extensionId}' did not register any tools, services, state channels, or slots.`,
    );
  }
}

function assertUniqueCapabilityIds(
  extensionId: string,
  capabilityType: string,
  ids: string[],
): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id) {
      throw new Error(
        `Extension '${extensionId}' registered a ${capabilityType} with an empty ID.`,
      );
    }
    if (seen.has(id)) {
      throw new Error(
        `Extension '${extensionId}' registered duplicate ${capabilityType} capability '${id}'.`,
      );
    }
    seen.add(id);
  }
}

function assertValidContribution(
  extensionId: string,
  contribution: ExtensionRuntimeContribution | null | undefined,
): asserts contribution is ExtensionRuntimeContribution {
  if (!contribution || typeof contribution !== "object") {
    throw new Error(
      `Extension '${extensionId}' did not return a runtime contribution.`,
    );
  }

  const capabilities = summarizeCapabilities(contribution);
  assertUniqueCapabilityIds(extensionId, "tool", capabilities.tools);
  assertUniqueCapabilityIds(extensionId, "service", capabilities.services);
  assertUniqueCapabilityIds(
    extensionId,
    "state channel",
    capabilities.stateChannels,
  );
  assertUniqueCapabilityIds(extensionId, "slot", capabilities.slots);
  assertHasCapabilities(extensionId, contribution);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function deactivateExtension(
  extension: RagdollExtension,
  context: ExtensionContext,
  contribution?: ExtensionRuntimeContribution,
): Promise<void> {
  const errors: unknown[] = [];

  try {
    await contribution?.dispose?.();
  } catch (error) {
    errors.push(error);
  }

  try {
    await extension.deactivate?.(context);
  } catch (error) {
    errors.push(error);
  }

  if (errors.length === 1) {
    throw errors[0];
  }
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      `Extension '${extension.manifest.id}' cleanup failed.`,
    );
  }
}

function summarizeCapabilities(contribution: ExtensionRuntimeContribution): {
  tools: string[];
  services: string[];
  stateChannels: string[];
  slots: string[];
} {
  return {
    tools:
      contribution.tools?.map((tool) => tool.definition.function.name) ?? [],
    services: contribution.services?.map((service) => service.name) ?? [],
    stateChannels:
      contribution.stateChannels?.map((channel) => channel.id) ?? [],
    slots: contribution.slots?.map((slot) => slot.id) ?? [],
  };
}

function getServiceKey(extensionId: string, serviceName: string): string {
  return `${extensionId}::${serviceName}`;
}

function getChannelKey(channelId: string): string {
  return channelId;
}

export class ExtensionRegistry {
  private readonly extensions = new Map<string, RegisteredExtension>();
  private readonly toolIndex = new Map<string, ToolEntry>();
  private readonly serviceIndex = new Map<string, ServiceEntry>();
  private readonly stateChannelIndex = new Map<string, StateChannelEntry>();
  private readonly slotIndex = new Map<string, SlotEntry>();
  private readonly eventBus = new RegistryEventBus();
  private instanceCounter = 0;

  async register(
    extension: RagdollExtension,
    options: RegisterOptions,
  ): Promise<void> {
    const host = options.host;
    if (!host) {
      throw new Error(
        "Extension host environment is required when registering an extension.",
      );
    }

    const manifest = extension.manifest;
    if (!manifest?.id || !manifest.name || !manifest.version) {
      throw new Error(
        "Extensions must define a manifest with non-empty 'id', 'name', and 'version' fields.",
      );
    }
    const extensionId = manifest.id;

    const existing = this.extensions.get(extensionId);
    if (existing && !options.replace) {
      throw new Error(
        `Extension '${extensionId}' is already registered. Use { replace: true } to override the existing instance.`,
      );
    }

    ensureHostCapabilities(extensionId, manifest.requiredCapabilities, host);

    const context: ExtensionContext = {
      instanceId: `${extensionId}-${++this.instanceCounter}`,
      createdAt: Date.now(),
      config: options.config,
    };

    let contribution: ExtensionRuntimeContribution | undefined;
    try {
      contribution = await extension.activate(host, context);
      assertValidContribution(extensionId, contribution);
      this.ensureNoConflicts(extensionId, contribution);

      if (existing) {
        await this.unregister(extensionId);
      }

      const capabilities = summarizeCapabilities(contribution);
      this.addContributionIndices(extensionId, contribution);
      this.extensions.set(extensionId, {
        extension,
        host,
        context,
        contribution,
        registeredAt: Date.now(),
        capabilities,
      });

      await this.emitCapabilityEvents(
        "capability:registered",
        extensionId,
        capabilities,
      );
      await this.eventBus.emit({
        type: "extension:registered",
        extensionId,
        timestamp: Date.now(),
      });
      await this.eventBus.emit({
        type: "tools:changed",
        extensionId,
        timestamp: Date.now(),
      });
    } catch (error) {
      if (this.extensions.get(extensionId)?.context !== context) {
        try {
          await deactivateExtension(extension, context, contribution);
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            `Extension '${extensionId}' registration and cleanup failed.`,
          );
        }
      }
      throw error;
    }
  }

  async unregister(extensionId: string): Promise<boolean> {
    const registered = this.extensions.get(extensionId);
    if (!registered) {
      return false;
    }

    this.extensions.delete(extensionId);
    this.removeContributionIndices(extensionId, registered.contribution);
    await this.emitCapabilityEvents(
      "capability:removed",
      extensionId,
      registered.capabilities,
    );

    await this.eventBus.emit({
      type: "extension:unregistered",
      extensionId,
      timestamp: Date.now(),
    });
    await this.eventBus.emit({
      type: "tools:changed",
      extensionId,
      timestamp: Date.now(),
    });

    await deactivateExtension(
      registered.extension,
      registered.context,
      registered.contribution,
    );

    return true;
  }

  has(extensionId: string): boolean {
    return this.extensions.has(extensionId);
  }

  getExtension(
    extensionId: string,
  ): RegisteredExtension["extension"] | undefined {
    return this.extensions.get(extensionId)?.extension;
  }

  getContributionMetadata(
    extensionId: string,
  ): ExtensionContributionMetadata | undefined {
    const registered = this.extensions.get(extensionId);
    if (!registered) {
      return undefined;
    }

    return {
      extensionId,
      manifest: registered.extension.manifest,
      tools: registered.capabilities.tools,
      services: registered.capabilities.services,
      stateChannels: registered.capabilities.stateChannels,
      slots: registered.capabilities.slots,
    };
  }

  getExtensionIds(): string[] {
    return Array.from(this.extensions.keys());
  }

  getAllTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const entry of this.toolIndex.values()) {
      tools.push(entry.tool.definition);
    }
    return tools;
  }

  getToolsByExtension(extensionId: string): ToolDefinition[] {
    return (
      this.extensions
        .get(extensionId)
        ?.contribution.tools?.map((tool) => tool.definition) ?? []
    );
  }

  getServices(): Array<{
    extensionId: string;
    definition: ExtensionServiceDefinition;
  }> {
    return Array.from(this.serviceIndex.values()).map((entry) => ({
      extensionId: entry.extensionId,
      definition: entry.definition,
    }));
  }

  getStateChannels(): Array<{
    extensionId: string;
    channel: ExtensionStateChannel;
  }> {
    return Array.from(this.stateChannelIndex.values()).map((entry) => ({
      extensionId: entry.extensionId,
      channel: entry.channel,
    }));
  }

  getStateChannel(
    channelId: string,
  ): { extensionId: string; channel: ExtensionStateChannel } | undefined {
    const entry = this.stateChannelIndex.get(getChannelKey(channelId));
    return entry
      ? { extensionId: entry.extensionId, channel: entry.channel }
      : undefined;
  }

  hasTool(toolName: string): boolean {
    return this.toolIndex.has(toolName);
  }

  validateTool(
    toolName: string,
    args: Record<string, unknown>,
  ): ValidationResult {
    const entry = this.toolIndex.get(toolName);
    if (!entry) {
      return { valid: false, error: `Unknown tool: '${toolName}'` };
    }
    if (entry.tool.validate) {
      try {
        return entry.tool.validate(args);
      } catch (error) {
        return { valid: false, error: getErrorMessage(error) };
      }
    }
    return { valid: true };
  }

  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<ToolResult> {
    const entry = this.toolIndex.get(toolName);
    if (!entry) {
      return { success: false, error: `Unknown tool: '${toolName}'` };
    }

    try {
      if (entry.tool.validate) {
        const validation = entry.tool.validate(args);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      }

      const context: ToolExecutionContext = {
        extensionId: entry.extensionId,
        metadata,
      };
      return await entry.tool.handler(args, context);
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  async invokeService(
    extensionId: string,
    serviceName: string,
    payload: unknown,
    metadata?: Record<string, unknown>,
  ): Promise<unknown> {
    const key = getServiceKey(extensionId, serviceName);
    const entry = this.serviceIndex.get(key);
    if (!entry) {
      throw new Error(
        `Service '${serviceName}' is not registered for extension '${extensionId}'.`,
      );
    }

    const registered = this.extensions.get(extensionId);
    if (!registered) {
      throw new Error(`Extension '${extensionId}' is not registered.`);
    }

    return entry.definition.handler(payload, {
      extensionId,
      host: registered.host,
      metadata,
    });
  }

  onToolsChanged(callback: RegistryEventCallback): () => void {
    return this.eventBus.on("tools:changed", callback);
  }

  onExtensionRegistered(callback: RegistryEventCallback): () => void {
    return this.eventBus.on("extension:registered", callback);
  }

  onExtensionUnregistered(callback: RegistryEventCallback): () => void {
    return this.eventBus.on("extension:unregistered", callback);
  }

  on(
    eventType: RegistryEventType,
    callback: RegistryEventCallback,
  ): () => void {
    return this.eventBus.on(eventType, callback);
  }

  off(eventType?: RegistryEventType): void {
    this.eventBus.clear(eventType);
  }

  async destroy(): Promise<void> {
    const ids = Array.from(this.extensions.keys());
    const errors: unknown[] = [];
    for (const id of ids) {
      try {
        await this.unregister(id);
      } catch (error) {
        errors.push(error);
      }
    }
    this.eventBus.clear();

    if (errors.length === 1) {
      throw errors[0];
    }
    if (errors.length > 1) {
      throw new AggregateError(
        errors,
        "Multiple extensions failed during registry cleanup.",
      );
    }
  }

  getStats(): {
    extensionCount: number;
    toolCount: number;
    listenerCount: number;
  } {
    return {
      extensionCount: this.extensions.size,
      toolCount: this.toolIndex.size,
      listenerCount: this.eventBus.getListenerCount(),
    };
  }

  private ensureNoConflicts(
    extensionId: string,
    contribution: ExtensionRuntimeContribution,
  ): void {
    if (contribution.tools) {
      for (const tool of contribution.tools) {
        const name = tool.definition.function.name;
        const existing = this.toolIndex.get(name);
        if (existing && existing.extensionId !== extensionId) {
          throw new Error(
            `Tool '${name}' from extension '${extensionId}' conflicts with extension '${existing.extensionId}'.`,
          );
        }
      }
    }

    if (contribution.services) {
      for (const service of contribution.services) {
        const key = getServiceKey(extensionId, service.name);
        const existing = this.serviceIndex.get(key);
        if (existing && existing.extensionId !== extensionId) {
          throw new Error(
            `Service '${service.name}' from extension '${extensionId}' conflicts with extension '${existing.extensionId}'.`,
          );
        }
      }
    }

    if (contribution.stateChannels) {
      for (const channel of contribution.stateChannels) {
        const key = getChannelKey(channel.id);
        const existing = this.stateChannelIndex.get(key);
        if (existing && existing.extensionId !== extensionId) {
          throw new Error(
            `State channel '${channel.id}' conflicts with extension '${existing.extensionId}'. Channel IDs must be globally unique.`,
          );
        }
      }
    }

    if (contribution.slots) {
      for (const slot of contribution.slots) {
        const existing = this.slotIndex.get(slot.id);
        if (existing && existing.extensionId !== extensionId) {
          throw new Error(
            `Slot '${slot.id}' from extension '${extensionId}' conflicts with extension '${existing.extensionId}'.`,
          );
        }
      }
    }
  }

  private addContributionIndices(
    extensionId: string,
    contribution: ExtensionRuntimeContribution,
  ): void {
    if (contribution.tools) {
      for (const tool of contribution.tools) {
        const name = tool.definition.function.name;
        this.toolIndex.set(name, { extensionId, tool });
      }
    }

    if (contribution.services) {
      for (const service of contribution.services) {
        const key = getServiceKey(extensionId, service.name);
        this.serviceIndex.set(key, { extensionId, definition: service });
      }
    }

    if (contribution.stateChannels) {
      for (const channel of contribution.stateChannels) {
        const key = getChannelKey(channel.id);
        this.stateChannelIndex.set(key, { extensionId, channel });
      }
    }

    if (contribution.slots) {
      for (const slot of contribution.slots) {
        this.slotIndex.set(slot.id, { extensionId, slot });
      }
    }
  }

  private removeContributionIndices(
    extensionId: string,
    contribution: ExtensionRuntimeContribution,
  ): void {
    if (contribution.tools) {
      for (const tool of contribution.tools) {
        const name = tool.definition.function.name;
        this.toolIndex.delete(name);
      }
    }

    if (contribution.services) {
      for (const service of contribution.services) {
        const key = getServiceKey(extensionId, service.name);
        this.serviceIndex.delete(key);
      }
    }

    if (contribution.stateChannels) {
      for (const channel of contribution.stateChannels) {
        const key = getChannelKey(channel.id);
        this.stateChannelIndex.delete(key);
      }
    }

    if (contribution.slots) {
      for (const slot of contribution.slots) {
        this.slotIndex.delete(slot.id);
      }
    }
  }

  private async emitCapabilityEvents(
    type: "capability:registered" | "capability:removed",
    extensionId: string,
    capabilities: RegisteredExtension["capabilities"],
  ): Promise<void> {
    const timestamp = Date.now();
    const entries = [
      ...capabilities.tools.map((capabilityId) => ({
        capabilityId,
        capabilityType: "tool" as const,
      })),
      ...capabilities.services.map((capabilityId) => ({
        capabilityId,
        capabilityType: "service" as const,
      })),
      ...capabilities.stateChannels.map((capabilityId) => ({
        capabilityId,
        capabilityType: "stateChannel" as const,
      })),
      ...capabilities.slots.map((capabilityId) => ({
        capabilityId,
        capabilityType: "slot" as const,
      })),
    ];

    for (const entry of entries) {
      await this.eventBus.emit({ type, extensionId, timestamp, ...entry });
    }
  }

  // ===========================================================================
  // Slot Accessors
  // ===========================================================================

  /**
   * Get all registered UI slots.
   */
  getSlots(): SlotEntry[] {
    return Array.from(this.slotIndex.values());
  }

  /**
   * Get a specific slot by ID.
   */
  getSlot(slotId: string): SlotEntry | undefined {
    return this.slotIndex.get(slotId);
  }

  /**
   * Check if a slot is registered.
   */
  hasSlot(slotId: string): boolean {
    return this.slotIndex.has(slotId);
  }
}

export function createRegistry(): ExtensionRegistry {
  return new ExtensionRegistry();
}
