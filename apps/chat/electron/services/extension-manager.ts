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

import * as path from "path";
import * as fs from "fs";
import {
  createRegistry,
  createLoader,
  type ExtensionRegistry,
  type ExtensionLoader,
  type ToolDefinition,
  type ToolResult,
  type LoadResult,
  type ExtensionHostEnvironment,
  type ExtensionHostCapability,
  type NotificationCallback,
  type ExtensionManifest,
  type ConfigSchema,
  type ConfigValues,
  type OAuthConfig,
  type OAuthTokens,
  type ExtensionPackageInfo,
} from "@vokality/ragdoll-extensions/core";
import { OAuthManager, createOAuthManager } from "./oauth-manager.js";
import { ConfigManager, createConfigManager } from "./config-manager.js";

// =============================================================================
// Types
// =============================================================================

export type ToolExecutionCallback = (
  toolName: string,
  args: Record<string, unknown>
) => void;

export type StateChangeCallback = (
  extensionId: string,
  channelId: string,
  state: unknown
) => void;

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
  onToolExecution?: ToolExecutionCallback;
  onStateChange?: StateChangeCallback;
  onSlotStateChange?: (extensionId: string, slotId: string, state: unknown) => void;
  onNotification?: NotificationCallback;
  searchPaths: string[];
  autoDiscover?: boolean;
  disabledExtensions?: string[];
  userDataPath: string;
  /** Function to open URLs in system browser (for OAuth) */
  openExternal: (url: string) => Promise<void>;
  /** Base redirect URI for OAuth (e.g., "lumen://oauth") */
  oauthRedirectBase: string;
}

// =============================================================================
// Extension Manager
// =============================================================================

export class ExtensionManager {
  private registry: ExtensionRegistry;
  private loader: ExtensionLoader;
  private config: ExtensionManagerConfig;
  private initialized = false;
  private stateChannelUnsubscribers: Array<() => void> = [];
  private slotStateUnsubscribers: Array<() => void> = [];

  // Per-extension state management
  private oauthManagers = new Map<string, OAuthManager>();
  private configManagers = new Map<string, ConfigManager>();
  private packageInfoCache = new Map<string, ExtensionPackageInfo>();
  private loadedExtensions: ExtensionInfo[] = [];

  constructor(config: ExtensionManagerConfig) {
    this.config = config;
    this.registry = createRegistry();

    // Use getHostEnvironment to provide extension-specific capabilities
    this.loader = createLoader(this.registry, {
      searchPaths: config.searchPaths,
      continueOnError: true,
      getHostEnvironment: (manifest) => this.createHostEnvironment(manifest),
    });
  }

  // ===========================================================================
  // Host Environment Creation
  // ===========================================================================

  private createHostEnvironment(manifest: ExtensionManifest): ExtensionHostEnvironment {
    const extensionId = manifest.id;
    const packageInfo = this.packageInfoCache.get(extensionId);

    // Determine capabilities based on package requirements
    const capabilities = new Set<ExtensionHostCapability>([
      "storage",
      "notifications",
      "ipc",
      "logger",
    ]);

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
      ? this.getOrCreateOAuthManager(extensionId, packageInfo.oauth, packageInfo.configSchema)
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
      getDataPath: () => path.join(this.config.userDataPath, "extensions", extensionId),
      schedulePersistence: async (_extensionId: string, reason: string) => {
        logger.debug(`Persistence scheduled: ${reason}`);
      },
    };
  }

  private createStorageCapability(extensionId: string) {
    const storagePath = path.join(this.config.userDataPath, "extensions", extensionId, "storage.json");

    return {
      read: async <T>(extId: string, key: string): Promise<T | undefined> => {
        try {
          const filePath = path.join(this.config.userDataPath, "extensions", extId, "storage.json");
          if (!fs.existsSync(filePath)) return undefined;
          const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          return data[key] as T;
        } catch {
          return undefined;
        }
      },
      write: async <T>(extId: string, key: string, value: T): Promise<void> => {
        const filePath = path.join(this.config.userDataPath, "extensions", extId, "storage.json");
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        let data: Record<string, unknown> = {};
        if (fs.existsSync(filePath)) {
          try {
            data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          } catch {}
        }
        data[key] = value;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      },
      delete: async (extId: string, key: string): Promise<void> => {
        const filePath = path.join(this.config.userDataPath, "extensions", extId, "storage.json");
        if (!fs.existsSync(filePath)) return;
        try {
          const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          delete data[key];
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch {}
      },
      list: async (extId: string): Promise<string[]> => {
        const filePath = path.join(this.config.userDataPath, "extensions", extId, "storage.json");
        if (!fs.existsSync(filePath)) return [];
        try {
          const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          return Object.keys(data);
        } catch {
          return [];
        }
      },
    };
  }

  private createIpcCapability(extensionId: string) {
    return {
      publish: (topic: string, payload: unknown) => {
        if (this.config.onToolExecution && topic.startsWith("extension-tool:")) {
          const data = payload as { tool: string; args: Record<string, unknown> };
          this.config.onToolExecution(data.tool, data.args);
        }
      },
      subscribe: (_topic: string, _handler: (payload: unknown) => void): (() => void) => {
        return () => {};
      },
    };
  }

  // ===========================================================================
  // OAuth Management
  // ===========================================================================

  private getOrCreateOAuthManager(
    extensionId: string,
    oauthConfig: OAuthConfig,
    configSchema?: ConfigSchema
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
      getClientId: () => (configManager?.getValues().clientId as string) ?? "",
      redirectUri: `${this.config.oauthRedirectBase}/${extensionId}`,
      loadTokens: async (): Promise<OAuthTokens | null> => {
        const storage = this.createStorageCapability(extensionId);
        const tokens = await storage.read<OAuthTokens>(extensionId, "oauth_tokens");
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
    schema: ConfigSchema
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
    // First try from config manager
    const manager = this.configManagers.get(extensionId);
    if (manager) {
      return manager.getSchema() ?? null;
    }

    // Fallback to package info cache
    const info = this.packageInfoCache.get(extensionId);
    return info?.configSchema ?? null;
  }

  /**
   * Set config value for an extension.
   */
  async setConfigValue(extensionId: string, key: string, value: string | number | boolean) {
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
        const manager = this.getOrCreateConfigManager(extensionId, info.configSchema);
        await manager.initialize();
      }
    }

    // Initialize OAuth managers and load tokens
    for (const [extensionId, info] of this.packageInfoCache) {
      if (info.oauth) {
        const manager = this.getOrCreateOAuthManager(extensionId, info.oauth, info.configSchema);
        await manager.initialize();
      }
    }

    // Now load extensions
    const autoDiscover = this.config.autoDiscover ?? true;
    if (autoDiscover) {
      const results = await this.discoverAndLoadPackages();

      for (const result of results) {
        if (result.success && result.packageInfo) {
          this.loadedExtensions.push({
            packageName: result.packageName,
            id: result.packageInfo.extensionId,
            name: result.packageInfo.name,
            description: result.packageInfo.description ?? "",
            canDisable: result.packageInfo.canDisable,
            hasConfigSchema: !!result.packageInfo.configSchema,
            hasOAuth: !!result.packageInfo.oauth,
          });
        }
      }
    }

    this.subscribeToStateChannels();
    this.subscribeToSlots();
    this.initialized = true;
  }

  // ===========================================================================
  // Package Discovery and Loading
  // ===========================================================================

  async discoverAndLoadPackages(): Promise<LoadResult[]> {
    const packages = await this.loader.discoverPackages();
    const results: LoadResult[] = [];

    for (const packageName of packages) {
      const info = this.packageInfoCache.get(packageName) ??
        await this.loader.getPackageInfo(packageName);

      if (info && this.isExtensionDisabled(info.extensionId)) {
        continue;
      }

      // Check if extension is configured (has required config)
      if (info?.configSchema) {
        const configManager = this.configManagers.get(info.extensionId);
        if (configManager && !configManager.isConfigured()) {
          console.info(`[ExtensionManager] Skipping ${info.extensionId}: not configured`);
          continue;
        }
      }

      const result = await this.loader.loadPackage(packageName);
      results.push(result);
    }

    return results;
  }

  private isExtensionDisabled(extensionId: string): boolean {
    return this.config.disabledExtensions?.includes(extensionId) ?? false;
  }

  // ===========================================================================
  // State Subscriptions
  // ===========================================================================

  private subscribeToStateChannels(): void {
    const channels = this.registry.getStateChannels();
    for (const { extensionId, channel } of channels) {
      const unsubscribe = channel.subscribe((state) => {
        this.config.onStateChange?.(extensionId, channel.id, state);
      });
      this.stateChannelUnsubscribers.push(unsubscribe);
    }
  }

  private subscribeToSlots(): void {
    const slots = this.registry.getSlots();
    for (const { extensionId, slot } of slots) {
      const unsubscribe = slot.state.subscribe(() => {
        const state = slot.state.getState();
        this.config.onSlotStateChange?.(extensionId, slot.id, {
          ...state,
          panel: this.serializePanel(state.panel),
        });
      });
      this.slotStateUnsubscribers.push(unsubscribe);
    }
  }

  private serializePanel(panel: unknown): unknown {
    return JSON.parse(JSON.stringify(panel, (_key, value) => {
      if (typeof value === "function") return undefined;
      return value;
    }));
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

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
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
      const isLoaded = this.loadedExtensions.some((ext) => ext.id === extensionId);

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
    return this.config.disabledExtensions ?? [];
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
    return this.loadedExtensions.map((ext) => ext.packageName);
  }

  async loadPackage(
    packageName: string,
    _config?: Record<string, unknown>
  ): Promise<LoadResult> {
    // Check if package info is cached, if not load it
    let info: ExtensionPackageInfo | undefined = this.packageInfoCache.get(packageName);
    if (!info) {
      const loaded = await this.loader.getPackageInfo(packageName);
      if (loaded) {
        info = loaded;
        this.packageInfoCache.set(info.extensionId, info);
      }
    }

    // Initialize config manager if needed
    if (info?.configSchema) {
      const manager = this.getOrCreateConfigManager(info.extensionId, info.configSchema);
      await manager.initialize();
    }

    // Initialize OAuth manager if needed
    if (info?.oauth) {
      const manager = this.getOrCreateOAuthManager(info.extensionId, info.oauth, info.configSchema);
      await manager.initialize();
    }

    const result = await this.loader.loadPackage(packageName);

    if (result.success && result.packageInfo) {
      this.loadedExtensions.push({
        packageName: result.packageName,
        id: result.packageInfo.extensionId,
        name: result.packageInfo.name,
        description: result.packageInfo.description ?? "",
        canDisable: result.packageInfo.canDisable,
        hasConfigSchema: !!result.packageInfo.configSchema,
        hasOAuth: !!result.packageInfo.oauth,
      });
    }

    return result;
  }

  async unloadPackage(packageName: string): Promise<boolean> {
    const extension = this.loadedExtensions.find((ext) => ext.packageName === packageName);
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
      this.packageInfoCache.delete(extension.id);

      // Remove from loaded extensions
      this.loadedExtensions = this.loadedExtensions.filter(
        (ext) => ext.packageName !== packageName
      );
    }

    return success;
  }

  async reloadPackage(
    packageName: string,
    config?: Record<string, unknown>
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
      icon: typeof slot.icon === "string" ? slot.icon : { type: "component" as const },
      priority: slot.priority ?? 0,
    }));
  }

  getSlotState(slotId: string) {
    const slotEntry = this.registry.getSlot(slotId);
    if (!slotEntry) return null;
    const state = slotEntry.slot.state.getState();
    return {
      badge: state.badge,
      visible: state.visible,
      panel: this.serializePanel(state.panel),
    };
  }

  async executeSlotAction(slotId: string, actionType: string, actionId: string) {
    const slotEntry = this.registry.getSlot(slotId);
    if (!slotEntry) {
      return { success: false, error: `Slot not found: ${slotId}` };
    }

    try {
      const state = slotEntry.slot.state.getState();
      const panel = state.panel as any;

      if (actionType === "panel-action" && panel.actions) {
        const action = panel.actions.find((a: any) => a.id === actionId);
        if (action?.onClick) {
          await action.onClick();
          return { success: true };
        }
      }

      return { success: false, error: `Action not found: ${actionType}:${actionId}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
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
    for (const unsubscribe of this.stateChannelUnsubscribers) unsubscribe();
    for (const unsubscribe of this.slotStateUnsubscribers) unsubscribe();
    for (const manager of this.oauthManagers.values()) manager.destroy();
    for (const manager of this.configManagers.values()) manager.destroy();

    this.stateChannelUnsubscribers = [];
    this.slotStateUnsubscribers = [];
    this.oauthManagers.clear();
    this.configManagers.clear();
    this.loadedExtensions = [];

    await this.registry.destroy();
    this.initialized = false;
  }
}

// =============================================================================
// Singleton
// =============================================================================

let instance: ExtensionManager | null = null;

export function getExtensionManager(config?: ExtensionManagerConfig): ExtensionManager {
  if (!instance && config) {
    instance = new ExtensionManager(config);
  }
  if (!instance) {
    throw new Error("ExtensionManager must be initialized with config first");
  }
  return instance;
}

export async function resetExtensionManager(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}
