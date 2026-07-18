/**
 * Extension Manager - Orchestrates the extension system in the Electron main process.
 *
 * Responsibilities:
 * - Manages the ExtensionRegistry lifecycle
 * - Provides ExtensionHostEnvironment to extensions (including OAuth/Config)
 * - Discovers and loads extension packages dynamically
 * - Handles OAuth callbacks for extensions that require it
 * - Syncs state changes to the renderer via IPC
 */

import {
  createRegistry,
  type ExtensionRegistry,
  type ToolDefinition,
  type ToolResult,
  type ExtensionHostEnvironment,
  type ExtensionHostCapability,
  type NotificationCallback,
  type ExtensionManifest,
  type ConfigSchema,
  type ConfigValues,
  type OAuthConfig,
  type OAuthTokens,
  type RegistryCapabilityEvent,
  type RagdollExtension,
  type SerializedSlotState,
  serializeSlotState,
} from "@vokality/ragdoll-extensions";
import {
  createLoader,
  type ExtensionLoader,
  type ExtensionLoaderConfig,
  type ExtensionPackageInfo,
  type LoadResult,
} from "@vokality/ragdoll-extensions/loader";
import { OAuthManager, createOAuthManager } from "./oauth-manager.js";
import { ConfigManager, createConfigManager } from "./config-manager.js";
import type { ExtensionStorage } from "../infrastructure/extension-storage.js";
import type { ExtensionMessageBus } from "./extension-message-bus.js";

// =============================================================================
// Types
// =============================================================================

export interface ExtensionInfo {
  packageName: string;
  id: string;
  name: string;
  description: string;
  canDisable: boolean;
  hasConfigSchema: boolean;
  hasOAuth: boolean;
}

export interface ExtensionManagerConfig {
  onSlotStateChange?: (
    extensionId: string,
    slotId: string,
    state: SerializedSlotState,
  ) => void;
  onSlotsChange?: () => void;
  onNotification?: NotificationCallback;
  packageRoots: ExtensionLoaderConfig["packageRoots"];
  disabledExtensions?: string[];
  /** Function to open URLs in system browser (for OAuth) */
  openExternal: (url: string) => Promise<void>;
  /** Base redirect URI for OAuth (e.g., "lumen://oauth") */
  oauthRedirectBase: string;
  builtInExtensions: readonly BuiltInExtensionDefinition[];
  fileSystem: ExtensionLoaderConfig["fileSystem"];
  storage: ExtensionStorage;
  messageBus: ExtensionMessageBus;
}

export interface BuiltInExtensionDefinition {
  packageName: string;
  canDisable: boolean;
  capabilities: readonly ("tools" | "services" | "stateChannels" | "slots")[];
  createExtension: () => RagdollExtension;
}

// =============================================================================
// Extension Manager
// =============================================================================

export class ExtensionManager {
  private registry: ExtensionRegistry;
  private loader: ExtensionLoader;
  private config: ExtensionManagerConfig;
  private initialized = false;
  private slotStateUnsubscribers = new Map<string, () => void>();
  private registryUnsubscribers: Array<() => void> = [];

  // Per-extension state management
  private oauthManagers = new Map<string, OAuthManager>();
  private configManagers = new Map<string, ConfigManager>();
  private packageInfoCache = new Map<string, ExtensionPackageInfo>();
  private loadedExtensions: ExtensionInfo[] = [];
  private disabledExtensions: Set<string>;

  constructor(config: ExtensionManagerConfig) {
    this.config = config;
    this.disabledExtensions = new Set(config.disabledExtensions ?? []);
    this.registry = createRegistry();

    // Use getHostEnvironment to provide extension-specific capabilities
    this.loader = createLoader(this.registry, {
      packageRoots: config.packageRoots,
      continueOnError: true,
      fileSystem: config.fileSystem,
      getHostEnvironment: (manifest) => this.createHostEnvironment(manifest),
    });

    this.registryUnsubscribers.push(
      this.registry.on("capability:registered", (event) => {
        this.subscribeToCapability(event as RegistryCapabilityEvent);
      }),
      this.registry.on("capability:removed", (event) => {
        this.unsubscribeFromCapability(event as RegistryCapabilityEvent);
      }),
    );
  }

  // ===========================================================================
  // Host Environment Creation
  // ===========================================================================

  private createHostEnvironment(
    manifest: ExtensionManifest,
  ): ExtensionHostEnvironment {
    const extensionId = manifest.id;
    const packageInfo = this.packageInfoCache.get(extensionId);

    // Determine capabilities based on package requirements
    const capabilities = new Set<ExtensionHostCapability>([
      "storage",
      "ipc",
      "logger",
    ]);

    if (this.config.onNotification) {
      capabilities.add("notifications");
    }

    if (packageInfo?.oauth) {
      capabilities.add("oauth");
    }
    if (packageInfo?.configSchema) {
      capabilities.add("config");
    }

    const logger = {
      debug: (...args: unknown[]) => console.debug(`[${extensionId}]`, ...args),
      info: (...args: unknown[]) => console.info(`[${extensionId}]`, ...args),
      warn: (...args: unknown[]) => console.warn(`[${extensionId}]`, ...args),
      error: (...args: unknown[]) => console.error(`[${extensionId}]`, ...args),
    };

    const storage = this.createStorageCapability(extensionId);
    const notifications = this.config.onNotification;
    const ipc = this.createIpcCapability(extensionId);

    // Get OAuth capability if extension requires it
    const oauth = packageInfo?.oauth
      ? this.getOrCreateOAuthManager(
          extensionId,
          packageInfo.oauth,
          packageInfo.configSchema,
        )
      : undefined;

    // Get Config capability if extension has config schema
    const config = packageInfo?.configSchema
      ? this.getOrCreateConfigManager(extensionId, packageInfo.configSchema)
      : undefined;

    return {
      capabilities,
      storage,
      notifications,
      logger,
      ipc,
      oauth,
      config,
    };
  }

  private createStorageCapability(extensionId: string) {
    return this.config.storage.forExtension(extensionId);
  }

  private createIpcCapability(extensionId: string) {
    return this.config.messageBus.forExtension(extensionId);
  }

  // ===========================================================================
  // OAuth Management
  // ===========================================================================

  private getOrCreateOAuthManager(
    extensionId: string,
    oauthConfig: OAuthConfig,
    configSchema?: ConfigSchema,
  ): OAuthManager {
    if (this.oauthManagers.has(extensionId)) {
      return this.oauthManagers.get(extensionId)!;
    }

    // Get config manager if extension has config schema
    const configManager = configSchema
      ? this.getOrCreateConfigManager(extensionId, configSchema)
      : undefined;

    const manager = createOAuthManager({
      oauthConfig,
      extensionId,
      // Use getter so clientId is fetched dynamically when needed
      getClientId: () => {
        const clientId = configManager?.getValues().clientId;
        return typeof clientId === "string" ? clientId : "";
      },
      redirectUri: `${this.config.oauthRedirectBase}/${extensionId}`,
      loadTokens: async (): Promise<OAuthTokens | null> => {
        const storage = this.createStorageCapability(extensionId);
        const tokens = await storage.read<OAuthTokens>(
          extensionId,
          "oauth_tokens",
        );
        return tokens ?? null;
      },
      saveTokens: async (tokens) => {
        const storage = this.createStorageCapability(extensionId);
        await storage.write(extensionId, "oauth_tokens", tokens);
      },
      clearTokens: async () => {
        const storage = this.createStorageCapability(extensionId);
        await storage.delete(extensionId, "oauth_tokens");
      },
      openExternal: this.config.openExternal,
      logger: {
        debug: (...args) => console.debug(`[OAuth:${extensionId}]`, ...args),
        info: (...args) => console.info(`[OAuth:${extensionId}]`, ...args),
        warn: (...args) => console.warn(`[OAuth:${extensionId}]`, ...args),
        error: (...args) => console.error(`[OAuth:${extensionId}]`, ...args),
      },
    });

    this.oauthManagers.set(extensionId, manager);
    return manager;
  }

  /**
   * Handle OAuth callback from system.
   * Called when the app receives an OAuth redirect URL.
   */
  async handleOAuthCallback(extensionId: string, code: string): Promise<void> {
    const manager = this.oauthManagers.get(extensionId);
    if (!manager) {
      throw new Error(`No OAuth manager for extension: ${extensionId}`);
    }
    await manager.handleCallback(code);
  }

  /**
   * Get OAuth state for an extension.
   */
  getOAuthState(extensionId: string) {
    return this.oauthManagers.get(extensionId)?.getState();
  }

  /**
   * Start OAuth flow for an extension.
   */
  async startOAuthFlow(extensionId: string): Promise<string> {
    const manager = this.oauthManagers.get(extensionId);
    if (!manager) {
      throw new Error(`No OAuth manager for extension: ${extensionId}`);
    }
    return manager.startFlow();
  }

  /**
   * Disconnect OAuth for an extension.
   */
  async disconnectOAuth(extensionId: string): Promise<void> {
    const manager = this.oauthManagers.get(extensionId);
    if (!manager) {
      throw new Error(`No OAuth manager for extension: ${extensionId}`);
    }
    await manager.disconnect();
  }

  // ===========================================================================
  // Config Management
  // ===========================================================================

  private getOrCreateConfigManager(
    extensionId: string,
    schema: ConfigSchema,
  ): ConfigManager {
    if (this.configManagers.has(extensionId)) {
      return this.configManagers.get(extensionId)!;
    }

    const storage = this.createStorageCapability(extensionId);

    const manager = createConfigManager({
      extensionId,
      schema,
      loadValues: async (): Promise<ConfigValues | null> => {
        const values = await storage.read<ConfigValues>(extensionId, "config");
        return values ?? null;
      },
      saveValues: async (values) => {
        await storage.write(extensionId, "config", values);
      },
      logger: {
        debug: (...args) => console.debug(`[Config:${extensionId}]`, ...args),
        info: (...args) => console.info(`[Config:${extensionId}]`, ...args),
        warn: (...args) => console.warn(`[Config:${extensionId}]`, ...args),
        error: (...args) => console.error(`[Config:${extensionId}]`, ...args),
      },
    });

    this.configManagers.set(extensionId, manager);
    return manager;
  }

  /**
   * Get config status for an extension.
   */
  getConfigStatus(extensionId: string) {
    return this.configManagers.get(extensionId)?.getStatus();
  }

  /**
   * Get config schema for an extension.
   */
  getConfigSchema(extensionId: string): ConfigSchema | null {
    return this.configManagers.get(extensionId)?.getSchema() ?? null;
  }

  /**
   * Set config value for an extension.
   */
  async setConfigValue(
    extensionId: string,
    key: string,
    value: string | number | boolean,
  ) {
    const manager = this.configManagers.get(extensionId);
    if (!manager) {
      throw new Error(`No config manager for extension: ${extensionId}`);
    }
    await manager.setValue(key, value);
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // First, discover packages and cache their info (for OAuth/Config requirements)
    const packages = await this.loader.discoverPackages();
    for (const packageName of packages) {
      const info = await this.loader.getPackageInfo(packageName);
      if (info) {
        this.packageInfoCache.set(info.extensionId, info);
      }
    }

    // Initialize config managers for extensions that need it
    for (const [extensionId, info] of this.packageInfoCache) {
      if (info.configSchema) {
        const manager = this.getOrCreateConfigManager(
          extensionId,
          info.configSchema,
        );
        await manager.initialize();
      }
    }

    // Initialize OAuth managers and load tokens
    for (const [extensionId, info] of this.packageInfoCache) {
      if (info.oauth) {
        const manager = this.getOrCreateOAuthManager(
          extensionId,
          info.oauth,
          info.configSchema,
        );
        await manager.initialize();
      }
    }

    await this.loadBuiltInExtensions();
    await this.discoverAndLoadPackages();
    this.initialized = true;
  }

  private async loadBuiltInExtensions(): Promise<void> {
    for (const definition of this.config.builtInExtensions) {
      const extension = definition.createExtension();
      if (this.isExtensionDisabled(extension.manifest.id)) continue;

      await this.registry.register(extension, {
        host: this.createHostEnvironment(extension.manifest),
      });
      const actual = this.registry.getContributionMetadata(
        extension.manifest.id,
      );
      if (!actual) {
        throw new Error(
          `Built-in extension '${extension.manifest.id}' was not registered`,
        );
      }
      const expected = [...definition.capabilities].sort();
      const received = [
        ...(actual.tools.length > 0 ? (["tools"] as const) : []),
        ...(actual.services.length > 0 ? (["services"] as const) : []),
        ...(actual.stateChannels.length > 0
          ? (["stateChannels"] as const)
          : []),
        ...(actual.slots.length > 0 ? (["slots"] as const) : []),
      ].sort();
      if (
        expected.length !== received.length ||
        expected.some((capability, index) => capability !== received[index])
      ) {
        await this.registry.unregister(extension.manifest.id);
        throw new Error(
          `Built-in extension '${extension.manifest.id}' declared ${expected.join(", ")} but registered ${received.join(", ")}`,
        );
      }

      this.loadedExtensions.push({
        packageName: definition.packageName,
        id: extension.manifest.id,
        name: extension.manifest.name,
        description: extension.manifest.description ?? "",
        canDisable: definition.canDisable,
        hasConfigSchema: false,
        hasOAuth: false,
      });
    }
  }

  // ===========================================================================
  // Package Discovery and Loading
  // ===========================================================================

  async discoverAndLoadPackages(): Promise<LoadResult[]> {
    const packages = await this.loader.discoverPackages();
    const results: LoadResult[] = [];

    for (const packageName of packages) {
      const info =
        this.getCachedPackageInfo(packageName) ??
        (await this.loader.getPackageInfo(packageName));

      if (!info) {
        throw new Error(`Package metadata is unavailable for '${packageName}'`);
      }
      await this.initializePackageInfo(info);

      if (this.isExtensionDisabled(info.extensionId)) {
        continue;
      }

      // Check if extension is configured (has required config)
      if (info.configSchema) {
        const configManager = this.configManagers.get(info.extensionId);
        if (!configManager?.isConfigured()) {
          console.info(
            `[ExtensionManager] Skipping ${info.extensionId}: not configured`,
          );
          continue;
        }
      }

      const result = await this.loadPackage(packageName);
      results.push(result);
    }

    return results;
  }

  private isExtensionDisabled(extensionId: string): boolean {
    return this.disabledExtensions.has(extensionId);
  }

  // ===========================================================================
  // State Subscriptions
  // ===========================================================================

  private subscribeToCapability(event: RegistryCapabilityEvent): void {
    if (event.capabilityType === "slot") {
      if (this.slotStateUnsubscribers.has(event.capabilityId)) return;
      const entry = this.registry.getSlot(event.capabilityId);
      if (!entry) return;
      const unsubscribe = entry.slot.state.subscribe(() => {
        const state = entry.slot.state.getState();
        this.config.onSlotStateChange?.(
          entry.extensionId,
          entry.slot.id,
          serializeSlotState(state),
        );
      });
      this.slotStateUnsubscribers.set(event.capabilityId, unsubscribe);
      this.config.onSlotsChange?.();
    }
  }

  private unsubscribeFromCapability(event: RegistryCapabilityEvent): void {
    const subscriptions =
      event.capabilityType === "slot" ? this.slotStateUnsubscribers : undefined;
    const unsubscribe = subscriptions?.get(event.capabilityId);
    unsubscribe?.();
    subscriptions?.delete(event.capabilityId);
    if (event.capabilityType === "slot") this.config.onSlotsChange?.();
  }

  // ===========================================================================
  // Public API - Tools
  // ===========================================================================

  getTools(): ToolDefinition[] {
    return this.registry.getAllTools();
  }

  getAllowedFunctions(): Set<string> {
    return new Set(this.registry.getAllTools().map((t) => t.function.name));
  }

  hasTool(toolName: string): boolean {
    return this.registry.hasTool(toolName);
  }

  validateTool(toolName: string, args: Record<string, unknown>) {
    return this.registry.validateTool(toolName, args);
  }

  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    return this.registry.executeTool(toolName, args);
  }

  onToolsChanged(callback: () => void): () => void {
    return this.registry.onToolsChanged(() => callback());
  }

  // ===========================================================================
  // Public API - Extension Info
  // ===========================================================================

  getAvailableExtensions(): readonly ExtensionInfo[] {
    return this.loadedExtensions;
  }

  /**
   * Get all discovered extensions, including those not yet loaded/configured.
   * This is useful for showing extensions that need configuration in the UI.
   */
  getDiscoveredExtensions(): ExtensionInfo[] {
    const discovered: ExtensionInfo[] = [];

    for (const [extensionId, info] of this.packageInfoCache) {
      // Check if already in loaded extensions
      const isLoaded = this.loadedExtensions.some(
        (ext) => ext.id === extensionId,
      );

      if (!isLoaded) {
        discovered.push({
          packageName: info.packageName,
          id: extensionId,
          name: info.name,
          description: info.description ?? "",
          canDisable: info.canDisable,
          hasConfigSchema: !!info.configSchema,
          hasOAuth: !!info.oauth,
        });
      }
    }

    // Combine loaded + discovered (deduplicated)
    return [...this.loadedExtensions, ...discovered];
  }

  getDisabledExtensions(): string[] {
    return [...this.disabledExtensions];
  }

  async setDisabledExtensions(extensionIds: string[]): Promise<void> {
    const next = new Set(extensionIds);
    const extensions = this.getDiscoveredExtensions();
    for (const extensionId of next) {
      const extension = extensions.find(({ id }) => id === extensionId);
      if (!extension) throw new Error(`Unknown extension: ${extensionId}`);
      if (!extension.canDisable) {
        throw new Error(`Extension '${extensionId}' is required`);
      }
    }

    const toDisable = extensions.filter(
      ({ id }) => next.has(id) && !this.disabledExtensions.has(id),
    );
    const toEnable = extensions.filter(
      ({ id }) => !next.has(id) && this.disabledExtensions.has(id),
    );

    const disabled: ExtensionInfo[] = [];
    const enabled: ExtensionInfo[] = [];
    try {
      for (const extension of toDisable) {
        if (!(await this.unloadPackage(extension.packageName))) {
          throw new Error(`Failed to disable extension '${extension.id}'`);
        }
        disabled.push(extension);
      }
      for (const extension of toEnable) {
        const result = await this.loadPackage(extension.packageName);
        if (!result.success) {
          throw new Error(
            result.error ?? `Failed to enable extension '${extension.id}'`,
          );
        }
        enabled.push(extension);
      }
    } catch (error) {
      const rollbackErrors: string[] = [];
      for (const extension of enabled.reverse()) {
        if (!(await this.unloadPackage(extension.packageName))) {
          rollbackErrors.push(`could not unload '${extension.id}'`);
        }
      }
      for (const extension of disabled.reverse()) {
        const result = await this.loadPackage(extension.packageName);
        if (!result.success) {
          rollbackErrors.push(
            result.error ?? `could not reload '${extension.id}'`,
          );
        }
      }
      const reason = error instanceof Error ? error.message : String(error);
      if (rollbackErrors.length > 0) {
        throw new Error(
          `${reason}; rollback failed: ${rollbackErrors.join(", ")}`,
        );
      }
      throw error;
    }
    this.disabledExtensions = next;
  }

  // ===========================================================================
  // Public API - State Channels
  // ===========================================================================

  getAllStateChannels() {
    return this.registry.getStateChannels().map(({ extensionId, channel }) => ({
      extensionId,
      channelId: channel.id,
      state: channel.getState(),
    }));
  }

  getStateChannelState(channelId: string) {
    const channels = this.registry.getStateChannels();
    const entry = channels.find(({ channel }) => channel.id === channelId);
    return entry ? entry.channel.getState() : null;
  }

  // ===========================================================================
  // Public API - Package Management
  // ===========================================================================

  async discoverPackages(): Promise<string[]> {
    return this.loader.discoverPackages();
  }

  getLoadedPackages(): string[] {
    return this.loader
      .getLoadedPackages()
      .map(({ packageName }) => packageName);
  }

  async loadPackage(
    packageName: string,
    config?: Record<string, unknown>,
  ): Promise<LoadResult> {
    // Check if package info is cached, if not load it
    let info = this.getCachedPackageInfo(packageName);
    if (!info) {
      const loaded = await this.loader.getPackageInfo(packageName);
      if (loaded) {
        info = loaded;
        this.packageInfoCache.set(info.extensionId, info);
      }
    }

    if (info) await this.initializePackageInfo(info);

    const result = await this.loader.loadPackage(packageName, config);

    if (result.success && result.packageInfo) {
      this.recordLoadedExtension(result.packageName, result.packageInfo);
    }

    return result;
  }

  async unloadPackage(packageName: string): Promise<boolean> {
    const extension = this.loadedExtensions.find(
      (ext) => ext.packageName === packageName,
    );
    if (!extension) {
      return false;
    }

    const success = await this.loader.unloadPackage(packageName);
    if (success) {
      // Clean up managers
      this.oauthManagers.get(extension.id)?.destroy();
      this.oauthManagers.delete(extension.id);
      this.configManagers.get(extension.id)?.destroy();
      this.configManagers.delete(extension.id);
      // Remove from loaded extensions
      this.loadedExtensions = this.loadedExtensions.filter(
        (ext) => ext.packageName !== packageName,
      );
    }

    return success;
  }

  async reloadPackage(
    packageName: string,
    config?: Record<string, unknown>,
  ): Promise<LoadResult> {
    await this.unloadPackage(packageName);
    return this.loadPackage(packageName, config);
  }

  // ===========================================================================
  // Public API - Slots
  // ===========================================================================

  getAllSlots() {
    return this.registry.getSlots().map(({ extensionId, slot }) => ({
      extensionId,
      slotId: slot.id,
      label: slot.label,
      icon: slot.icon,
      priority: slot.priority ?? 0,
    }));
  }

  getSlotState(slotId: string) {
    const slotEntry = this.registry.getSlot(slotId);
    if (!slotEntry) return null;
    return serializeSlotState(slotEntry.slot.state.getState());
  }

  async executeSlotAction(
    slotId: string,
    actionType: string,
    actionId: string,
  ) {
    const slotEntry = this.registry.getSlot(slotId);
    if (!slotEntry) {
      return { success: false, error: `Slot not found: ${slotId}` };
    }

    try {
      const panel = slotEntry.slot.state.getState().panel;
      const items = [
        ...(panel.items ?? []),
        ...(panel.sections?.flatMap((section) => section.items) ?? []),
      ];
      const action =
        actionType === "panel-action"
          ? panel.actions?.find((candidate) => candidate.id === actionId)
          : actionType === "section-action"
            ? panel.sections
                ?.flatMap((section) => section.actions ?? [])
                .find((candidate) => candidate.id === actionId)
            : undefined;
      const item =
        actionType === "item-click" || actionType === "item-toggle"
          ? items.find((candidate) => candidate.id === actionId)
          : undefined;
      const callback =
        actionType === "item-click"
          ? item?.onClick
          : actionType === "item-toggle"
            ? item?.onToggle
            : action?.onClick;

      if (callback) {
        await callback();
        return { success: true };
      }

      return {
        success: false,
        error: `Action not found: ${actionType}:${actionId}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ===========================================================================
  // Public API - Registry
  // ===========================================================================

  getStats() {
    const stats = this.registry.getStats();
    return { extensionCount: stats.extensionCount, toolCount: stats.toolCount };
  }

  getRegistry(): ExtensionRegistry {
    return this.registry;
  }

  getLoader(): ExtensionLoader {
    return this.loader;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async destroy(): Promise<void> {
    for (const unsubscribe of this.slotStateUnsubscribers.values())
      unsubscribe();
    for (const unsubscribe of this.registryUnsubscribers) unsubscribe();
    for (const manager of this.oauthManagers.values()) manager.destroy();
    for (const manager of this.configManagers.values()) manager.destroy();

    this.slotStateUnsubscribers.clear();
    this.registryUnsubscribers = [];
    this.oauthManagers.clear();
    this.configManagers.clear();
    this.loadedExtensions = [];
    this.config.messageBus.clear();

    await this.registry.destroy();
    this.initialized = false;
  }

  private getCachedPackageInfo(
    packageName: string,
  ): ExtensionPackageInfo | undefined {
    for (const info of this.packageInfoCache.values()) {
      if (info.packageName === packageName) return info;
    }
    return undefined;
  }

  private recordLoadedExtension(
    packageName: string,
    info: ExtensionPackageInfo,
  ): void {
    const extension: ExtensionInfo = {
      packageName,
      id: info.extensionId,
      name: info.name,
      description: info.description ?? "",
      canDisable: info.canDisable,
      hasConfigSchema: Boolean(info.configSchema),
      hasOAuth: Boolean(info.oauth),
    };
    const existingIndex = this.loadedExtensions.findIndex(
      (loaded) => loaded.packageName === packageName,
    );
    if (existingIndex === -1) {
      this.loadedExtensions.push(extension);
    } else {
      this.loadedExtensions[existingIndex] = extension;
    }
  }

  private async initializePackageInfo(
    info: ExtensionPackageInfo,
  ): Promise<void> {
    this.packageInfoCache.set(info.extensionId, info);
    if (info.configSchema) {
      await this.getOrCreateConfigManager(
        info.extensionId,
        info.configSchema,
      ).initialize();
    }
    if (info.oauth) {
      await this.getOrCreateOAuthManager(
        info.extensionId,
        info.oauth,
        info.configSchema,
      ).initialize();
    }
  }
}
