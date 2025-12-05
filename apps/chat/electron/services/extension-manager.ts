/**
 * Extension Manager - Orchestrates the extension system in the Electron main process.
 *
 * Responsibilities:
 * - Manages the ExtensionRegistry lifecycle
 * - Provides ExtensionHostEnvironment to extensions
 * - Discovers and loads extension packages dynamically
 * - Syncs state changes to the renderer via IPC
 * - Provides tool definitions to the OpenAI service
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
  type NotificationRequest,
  type NotificationCallback,
  type ExtensionStateChannel,
} from "@vokality/ragdoll-extensions/core";

// =============================================================================
// Types
// =============================================================================

/**
 * Callback invoked when a tool is executed.
 * The main process uses this to forward tool calls to the renderer.
 */
export type ToolExecutionCallback = (
  toolName: string,
  args: Record<string, unknown>
) => void;

/**
 * Generic callback for extension state changes
 */
export type StateChangeCallback = (
  extensionId: string,
  channelId: string,
  state: unknown
) => void;

/**
 * Extension metadata from package.json
 */
export interface ExtensionInfo {
  /** Package name (e.g., @vokality/ragdoll-extension-tasks) */
  packageName: string;
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description of what the extension does */
  description: string;
  /** Whether this extension can be disabled by the user */
  canDisable: boolean;
}

/**
 * Configuration for the extension manager
 */
export interface ExtensionManagerConfig {
  /** Callback invoked when tools are executed (for forwarding to renderer) */
  onToolExecution?: ToolExecutionCallback;

  /** Generic callback when any extension state channel changes (for sync to renderer) */
  onStateChange?: StateChangeCallback;

  /** Callback to show system notifications (provided by host environment) */
  onNotification?: NotificationCallback;

  /**
   * Paths to search for node_modules directories containing extensions.
   * Used by the extension loader for package discovery.
   */
  searchPaths: string[];

  /**
   * Whether to auto-discover and load extensions from searchPaths on initialize.
   * Defaults to true.
   */
  autoDiscover?: boolean;

  /**
   * IDs of extensions to disable.
   * Disabled extensions will not be loaded.
   */
  disabledExtensions?: string[];

  /**
   * User data path for extension storage
   */
  userDataPath: string;

  /**
   * Extension-specific configuration passed to extensions on load.
   * Keyed by extension ID.
   */
  extensionConfigs?: Record<string, Record<string, unknown>>;
}

// =============================================================================
// Extension Manager
// =============================================================================

/**
 * Manages extensions and provides a unified interface for tool access.
 */
export class ExtensionManager {
  private registry: ExtensionRegistry;
  private loader: ExtensionLoader;
  private config: ExtensionManagerConfig;
  private initialized = false;
  private stateChannelUnsubscribers: Array<() => void> = [];
  private storageMap = new Map<string, Map<string, unknown>>();
  private loadedExtensions: ExtensionInfo[] = [];

  constructor(config: ExtensionManagerConfig) {
    this.config = config;
    this.registry = createRegistry();

    const hostEnv = this.createHostEnvironment();
    this.loader = createLoader(this.registry, {
      searchPaths: config.searchPaths,
      continueOnError: true,
      hostEnvironment: hostEnv,
    });
  }

  /**
   * Create the host environment for extensions.
   */
  private createHostEnvironment(): ExtensionHostEnvironment {
    const storage = {
      read: async <T>(extensionId: string, key: string): Promise<T | undefined> => {
        const extStorage = this.storageMap.get(extensionId);
        if (!extStorage) return undefined;
        return (extStorage.get(key) as T) ?? undefined;
      },
      write: async <T>(extensionId: string, key: string, value: T): Promise<void> => {
        let extStorage = this.storageMap.get(extensionId);
        if (!extStorage) {
          extStorage = new Map();
          this.storageMap.set(extensionId, extStorage);
        }
        extStorage.set(key, value);
      },
      delete: async (extensionId: string, key: string): Promise<void> => {
        const extStorage = this.storageMap.get(extensionId);
        if (extStorage) {
          extStorage.delete(key);
        }
      },
      list: async (extensionId: string): Promise<string[]> => {
        const extStorage = this.storageMap.get(extensionId);
        if (!extStorage) return [];
        return Array.from(extStorage.keys());
      },
    };

    const notifications = this.config.onNotification
      ? (req: NotificationRequest) => {
          this.config.onNotification?.(req);
        }
      : undefined;

    const logger = {
      debug: (...args: unknown[]) => console.debug("[Extension]", ...args),
      info: (...args: unknown[]) => console.info("[Extension]", ...args),
      warn: (...args: unknown[]) => console.warn("[Extension]", ...args),
      error: (...args: unknown[]) => console.error("[Extension]", ...args),
    };

    const ipc = {
      publish: (topic: string, payload: unknown) => {
        if (this.config.onToolExecution && topic.startsWith("extension-tool:")) {
          const data = payload as { extensionId: string; tool: string; args: Record<string, unknown> };
          this.config.onToolExecution(data.tool, data.args);
        }
      },
      subscribe: (_topic: string, _handler: (payload: unknown) => void): (() => void) => {
        // Not implemented in main process - renderer will subscribe via IPC
        return () => {};
      },
    };

    return {
      capabilities: new Set(["storage", "notifications", "ipc", "logger"]),
      storage,
      notifications,
      logger,
      ipc,
      getDataPath: (extensionId: string) => {
        return path.join(this.config.userDataPath, "extensions", extensionId);
      },
      schedulePersistence: async (extensionId: string, reason: string) => {
        logger.debug?.(`Persistence scheduled for ${extensionId}: ${reason}`);
      },
    };
  }

  /**
   * Initialize the extension manager and discover/load extensions.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Discover and load extension packages
    const autoDiscover = this.config.autoDiscover ?? true;
    if (autoDiscover && this.config.searchPaths.length > 0) {
      const results = await this.discoverAndLoadPackages();

      // Track loaded extensions
      for (const result of results) {
        if (result.success && result.extensionId) {
          // Get extension metadata from package
          const packageData = this.getPackageMetadata(result.packageName);
          if (packageData) {
            this.loadedExtensions.push(packageData);
          }
        }
      }
    }

    // Subscribe to state channels
    this.subscribeToStateChannels();

    this.initialized = true;
  }

  /**
   * Get extension metadata from a loaded package.
   */
  private getPackageMetadata(packageName: string): ExtensionInfo | null {
    try {
      // Find package.json in search paths
      for (const searchPath of this.config.searchPaths) {
        const packageJsonPath = path.join(searchPath, packageName, "package.json");
        if (fs.existsSync(packageJsonPath)) {
          const packageJsonContent = fs.readFileSync(packageJsonPath, "utf-8");
          const packageJson = JSON.parse(packageJsonContent);
          const metadata = packageJson.ragdollExtension;

          if (!metadata) return null;

          return {
            packageName,
            id: metadata.id,
            name: metadata.name,
            description: metadata.description,
            canDisable: metadata.canDisable ?? true,
          };
        }
      }

      return null;
    } catch (error) {
      console.warn(`[ExtensionManager] Failed to load metadata for ${packageName}:`, error);
      return null;
    }
  }

  /**
   * Check if an extension is disabled.
   */
  private isExtensionDisabled(extensionId: string): boolean {
    return this.config.disabledExtensions?.includes(extensionId) ?? false;
  }

  /**
   * Subscribe to state channels from registered extensions.
   * Generically forwards all state changes to the renderer via the onStateChange callback.
   */
  private subscribeToStateChannels(): void {
    const channels = this.registry.getStateChannels();

    for (const { extensionId, channel } of channels) {
      const unsubscribe = channel.subscribe((state) => {
        // Forward state change to renderer via generic callback
        this.config.onStateChange?.(extensionId, channel.id, state);
      });
      this.stateChannelUnsubscribers.push(unsubscribe);
    }
  }


  // ===========================================================================
  // Public API - Tools
  // ===========================================================================

  /**
   * Get all tool definitions in OpenAI format.
   */
  getTools(): ToolDefinition[] {
    return this.registry.getAllTools();
  }

  /**
   * Get the set of allowed function names for validation.
   */
  getAllowedFunctions(): Set<string> {
    const tools = this.registry.getAllTools();
    return new Set(tools.map((t) => t.function.name));
  }

  /**
   * Check if a tool exists.
   */
  hasTool(toolName: string): boolean {
    return this.registry.hasTool(toolName);
  }

  /**
   * Validate tool arguments.
   */
  validateTool(
    toolName: string,
    args: Record<string, unknown>
  ): { valid: boolean; error?: string } {
    return this.registry.validateTool(toolName, args);
  }

  /**
   * Execute a tool by name.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    return this.registry.executeTool(toolName, args);
  }

  /**
   * Subscribe to tool changes.
   */
  onToolsChanged(callback: () => void): () => void {
    return this.registry.onToolsChanged(() => callback());
  }

  // ===========================================================================
  // Public API - Extension Info
  // ===========================================================================

  /**
   * Get metadata for all loaded extensions.
   */
  getAvailableExtensions(): readonly ExtensionInfo[] {
    return this.loadedExtensions;
  }

  /**
   * Get the list of currently disabled extension IDs.
   */
  getDisabledExtensions(): string[] {
    return this.config.disabledExtensions ?? [];
  }

  // ===========================================================================
  // Public API - State Channels (generic access)
  // ===========================================================================

  /**
   * Get all state channels from all extensions.
   */
  getAllStateChannels(): Array<{
    extensionId: string;
    channelId: string;
    state: unknown;
  }> {
    const channels = this.registry.getStateChannels();
    return channels.map(({ extensionId, channel }) => ({
      extensionId,
      channelId: channel.id,
      state: channel.getState(),
    }));
  }

  /**
   * Get state from a specific channel.
   */
  getStateChannelState(channelId: string): unknown | null {
    const entry = this.registry.getStateChannel(channelId);
    if (!entry) return null;
    return entry.channel.getState();
  }

  /**
   * Subscribe to a specific state channel.
   */
  subscribeToStateChannel(
    channelId: string,
    callback: (state: unknown) => void
  ): (() => void) | null {
    const entry = this.registry.getStateChannel(channelId);
    if (!entry) return null;
    return entry.channel.subscribe(callback);
  }

  // ===========================================================================
  // Public API - UI Slots
  // ===========================================================================

  /**
   * Get all UI slots from registered extensions.
   * Returns serializable slot definitions (without functions/stores).
   */
  getAllSlots(): Array<{
    extensionId: string;
    slotId: string;
    label: string;
    icon: string | { type: "component" };
    priority: number;
  }> {
    const slotContributions = this.registry.getSlots();
    return slotContributions.map(({ extensionId, slot }) => ({
      extensionId,
      slotId: slot.id,
      label: slot.label,
      icon: typeof slot.icon === "string" ? slot.icon : { type: "component" as const },
      priority: slot.priority ?? 0,
    }));
  }

  /**
   * Get current state snapshot for a specific slot.
   */
  getSlotState(slotId: string): {
    badge: number | string | null;
    visible: boolean;
    panel: unknown;
  } | null {
    const slotEntry = this.registry.getSlot(slotId);
    if (!slotEntry) return null;

    const state = slotEntry.slot.state.getState();
    return {
      badge: state.badge,
      visible: state.visible,
      panel: this.serializePanel(state.panel),
    };
  }

  /**
   * Serialize panel config for IPC transport (remove functions).
   */
  private serializePanel(panel: unknown): unknown {
    // Deep clone and remove functions
    return JSON.parse(JSON.stringify(panel, (key, value) => {
      if (typeof value === "function") return undefined;
      return value;
    }));
  }

  /**
   * Execute a slot action (e.g., button click, checkbox toggle).
   */
  async executeSlotAction(
    slotId: string,
    actionType: string,
    actionId: string
  ): Promise<{ success: boolean; error?: string }> {
    const slotEntry = this.registry.getSlot(slotId);
    if (!slotEntry) {
      return { success: false, error: `Slot not found: ${slotId}` };
    }

    try {
      const state = slotEntry.slot.state.getState();
      const panel = state.panel as any;

      // Handle different action types
      if (actionType === "panel-action" && panel.actions) {
        const action = panel.actions.find((a: any) => a.id === actionId);
        if (action?.onClick) {
          await action.onClick();
          return { success: true };
        }
      } else if (actionType === "item-toggle" && panel.sections) {
        for (const section of panel.sections) {
          const item = section.items.find((i: any) => i.id === actionId);
          if (item?.onToggle) {
            await item.onToggle();
            return { success: true };
          }
        }
      } else if (actionType === "item-click" && panel.sections) {
        for (const section of panel.sections) {
          const item = section.items.find((i: any) => i.id === actionId);
          if (item?.onClick) {
            await item.onClick();
            return { success: true };
          }
        }
      } else if (actionType === "section-action" && panel.sections) {
        for (const section of panel.sections) {
          if (section.actions) {
            const action = section.actions.find((a: any) => a.id === actionId);
            if (action?.onClick) {
              await action.onClick();
              return { success: true };
            }
          }
        }
      }

      return { success: false, error: `Action not found: ${actionType}:${actionId}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ===========================================================================
  // Public API - Registry & Stats
  // ===========================================================================

  /**
   * Get registry statistics.
   */
  getStats(): {
    extensionCount: number;
    toolCount: number;
  } {
    const stats = this.registry.getStats();
    return {
      extensionCount: stats.extensionCount,
      toolCount: stats.toolCount,
    };
  }

  /**
   * Get the underlying registry for advanced use cases.
   */
  getRegistry(): ExtensionRegistry {
    return this.registry;
  }

  /**
   * Get the underlying loader for advanced use cases.
   */
  getLoader(): ExtensionLoader {
    return this.loader;
  }

  // ===========================================================================
  // Package Loading
  // ===========================================================================

  /**
   * Discover and load all extension packages from search paths.
   * Filters out disabled extensions.
   */
  async discoverAndLoadPackages(): Promise<LoadResult[]> {
    const packages = await this.loader.discoverPackages();
    const results: LoadResult[] = [];

    for (const packageName of packages) {
      // Get metadata to check if disabled
      const metadata = this.getPackageMetadata(packageName);

      if (metadata && this.isExtensionDisabled(metadata.id)) {
        continue;
      }

      // Load the package with extension-specific config if provided
      const config = this.config.extensionConfigs?.[metadata?.id ?? ""];
      const result = await this.loader.loadPackage(packageName, config);
      results.push(result);
    }

    return results;
  }

  /**
   * Discover extension packages without loading them.
   */
  async discoverPackages(): Promise<string[]> {
    return this.loader.discoverPackages();
  }

  /**
   * Load a specific extension package by name.
   */
  async loadPackage(
    packageName: string,
    config?: Record<string, unknown>
  ): Promise<LoadResult> {
    return this.loader.loadPackage(packageName, config);
  }

  /**
   * Unload a previously loaded package.
   */
  async unloadPackage(packageName: string): Promise<boolean> {
    return this.loader.unloadPackage(packageName);
  }

  /**
   * Reload a package (unload then load again).
   */
  async reloadPackage(
    packageName: string,
    config?: Record<string, unknown>
  ): Promise<LoadResult> {
    return this.loader.reloadPackage(packageName, config);
  }

  /**
   * Get list of currently loaded packages.
   */
  getLoadedPackages(): Array<{ packageName: string; extensionId: string }> {
    return this.loader.getLoadedPackages();
  }

  /**
   * Check if a package is currently loaded.
   */
  isPackageLoaded(packageName: string): boolean {
    return this.loader.isPackageLoaded(packageName);
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Clean up the extension manager.
   */
  async destroy(): Promise<void> {
    for (const unsubscribe of this.stateChannelUnsubscribers) {
      unsubscribe();
    }
    this.stateChannelUnsubscribers = [];
    this.loadedExtensions = [];
    await this.registry.destroy();
    this.initialized = false;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let extensionManagerInstance: ExtensionManager | null = null;

/**
 * Get or create the singleton extension manager instance.
 */
export function getExtensionManager(
  config?: ExtensionManagerConfig
): ExtensionManager {
  if (!extensionManagerInstance && config) {
    extensionManagerInstance = new ExtensionManager(config);
  }
  if (!extensionManagerInstance) {
    throw new Error("ExtensionManager must be initialized with config first");
  }
  return extensionManagerInstance;
}

/**
 * Reset the singleton instance (for testing).
 */
export async function resetExtensionManager(): Promise<void> {
  if (extensionManagerInstance) {
    await extensionManagerInstance.destroy();
    extensionManagerInstance = null;
  }
}
