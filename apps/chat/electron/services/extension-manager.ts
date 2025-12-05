/**
 * Extension Manager - Orchestrates the extension system in the Electron main process.
 *
 * Responsibilities:
 * - Manages the ExtensionRegistry lifecycle
 * - Provides ExtensionHostEnvironment to extensions
 * - Registers built-in extensions (character, tasks, pomodoro, spotify)
 * - Syncs state changes to the renderer via IPC
 * - Provides tool definitions to the OpenAI service
 */

import {
  createRegistry,
  createLoader,
  createExtension,
  type ExtensionRegistry,
  type ExtensionLoader,
  type ToolDefinition,
  type ToolResult,
  type LoadResult,
  type ExtensionHostEnvironment,
  type NotificationRequest,
  type NotificationCallback,
} from "@vokality/ragdoll-extensions";

import {
  createCharacterRuntime,
} from "@vokality/ragdoll-extension-character";

import {
  createTaskRuntime,
  type TaskState,
  type TaskEvent,
} from "@vokality/ragdoll-extension-tasks";

import {
  createPomodoroRuntime,
  type PomodoroEvent,
} from "@vokality/ragdoll-extension-pomodoro";

import {
  createSpotifyManager,
  type SpotifyManager,
  type SpotifyEvent,
  type SpotifyTokens,
  type SpotifyPlaybackState,
} from "@vokality/ragdoll-extension-spotify";

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
 * Callback for task state changes
 */
export type TaskStateCallback = (event: TaskEvent) => void;

/**
 * Callback for pomodoro state changes
 */
export type PomodoroStateCallback = (event: PomodoroEvent) => void;

/**
 * Callback for Spotify state changes
 */
export type SpotifyStateCallback = (event: SpotifyEvent) => void;

/**
 * Spotify configuration
 */
export interface SpotifyConfig {
  clientId: string;
  redirectUri: string;
  /** Initial tokens if already authenticated */
  initialTokens?: SpotifyTokens;
}

/**
 * Configuration for the extension manager
 */
export interface ExtensionManagerConfig {
  /** Callback invoked when character tools are executed (for forwarding to renderer) */
  onToolExecution?: ToolExecutionCallback;

  /** Callback when task state changes (for persistence/sync to renderer) */
  onTaskStateChange?: TaskStateCallback;

  /** Callback when pomodoro state changes (for sync to renderer) */
  onPomodoroStateChange?: PomodoroStateCallback;

  /** Callback when Spotify state changes (for sync to renderer) */
  onSpotifyStateChange?: SpotifyStateCallback;

  /** Callback to show system notifications (provided by host environment) */
  onNotification?: NotificationCallback;

  /** Initial task state to load */
  initialTaskState?: TaskState;

  /** Spotify configuration (optional - Spotify extension only enabled if provided) */
  spotify?: SpotifyConfig;

  /**
   * Paths to search for node_modules directories containing extensions.
   * Used by the extension loader for package discovery.
   */
  searchPaths?: string[];

  /**
   * Whether to auto-discover and load extensions from searchPaths on initialize.
   * Defaults to false.
   */
  autoDiscover?: boolean;

  /**
   * IDs of extensions to disable.
   * Disabled extensions will not be registered and will not contribute tools or UI.
   * Valid IDs: "character", "pomodoro", "tasks", "spotify"
   */
  disabledExtensions?: string[];

  /**
   * User data path for extension storage
   */
  userDataPath: string;
}

/** Built-in extension IDs */
export const BUILT_IN_EXTENSION_IDS = [
  "character",
  "pomodoro",
  "tasks",
  "spotify",
] as const;

export type BuiltInExtensionId = (typeof BUILT_IN_EXTENSION_IDS)[number];

/**
 * Metadata for a built-in extension.
 * Used by the UI to display extension toggles in settings.
 */
export interface BuiltInExtensionInfo {
  /** Unique identifier */
  id: BuiltInExtensionId;
  /** Human-readable name */
  name: string;
  /** Short description of what the extension does */
  description: string;
  /** Whether this extension can be disabled by the user */
  canDisable: boolean;
}

/**
 * Metadata for all built-in extensions.
 * Single source of truth for extension information displayed in settings.
 */
export const BUILT_IN_EXTENSIONS: readonly BuiltInExtensionInfo[] = [
  {
    id: "character",
    name: "Character",
    description: "Facial expressions and animations",
    canDisable: false, // Core functionality, always enabled
  },
  {
    id: "pomodoro",
    name: "Focus Timer",
    description: "Pomodoro-style work sessions",
    canDisable: true,
  },
  {
    id: "tasks",
    name: "Tasks",
    description: "Task tracking and management",
    canDisable: true,
  },
  {
    id: "spotify",
    name: "Spotify",
    description: "Music playback control",
    canDisable: true,
  },
] as const;

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
  private spotifyManager: SpotifyManager | null = null;
  private stateChannelUnsubscribers: Array<() => void> = [];
  private storageMap = new Map<string, Map<string, unknown>>();

  constructor(config: ExtensionManagerConfig) {
    this.config = config;
    this.registry = createRegistry();

    const hostEnv = this.createHostEnvironment();
    this.loader = createLoader(this.registry, {
      searchPaths: config.searchPaths ?? [],
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
      schedulePersistence: async (extensionId: string, reason: string) => {
        logger.debug?.(`Persistence scheduled for ${extensionId}: ${reason}`);
      },
    };
  }

  /**
   * Initialize the extension manager and register built-in extensions.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Register built-in extensions
    await this.registerBuiltInExtensions();

    // Subscribe to state channels
    this.subscribeToStateChannels();

    // Auto-discover and load packages if configured
    if (this.config.autoDiscover && this.config.searchPaths?.length) {
      await this.discoverAndLoadPackages();
    }

    this.initialized = true;
  }

  /**
   * Check if an extension is disabled.
   */
  private isExtensionDisabled(id: BuiltInExtensionId): boolean {
    return this.config.disabledExtensions?.includes(id) ?? false;
  }

  /**
   * Subscribe to state channels from registered extensions.
   */
  private subscribeToStateChannels(): void {
    const channels = this.registry.getStateChannels();

    for (const { extensionId, channel } of channels) {
      if (extensionId === "tasks" && channel.id === "tasks:state") {
        const unsubscribe = channel.subscribe((state) => {
          const taskEvent: TaskEvent = {
            type: "state:changed",
            state: state as TaskState,
            timestamp: Date.now(),
          };
          this.config.onTaskStateChange?.(taskEvent);
        });
        this.stateChannelUnsubscribers.push(unsubscribe);
      } else if (extensionId === "pomodoro" && channel.id === "pomodoro:state") {
        const unsubscribe = channel.subscribe((state) => {
          const pomodoroEvent: PomodoroEvent = {
            type: "state:changed",
            state: state as any,
            timestamp: Date.now(),
          };
          this.config.onPomodoroStateChange?.(pomodoroEvent);
        });
        this.stateChannelUnsubscribers.push(unsubscribe);
      }
    }
  }

  /**
   * Register the built-in extensions.
   */
  private async registerBuiltInExtensions(): Promise<void> {
    const host = this.createHostEnvironment();

    // Character extension - forwards to renderer for UI updates
    if (!this.isExtensionDisabled("character")) {
      const characterExtension = createExtension({
        id: "character",
        name: "Character",
        version: "1.1.0",
        description: "Facial expressions and animations",
        requiredCapabilities: ["ipc"],
        createRuntime: (h) => createCharacterRuntime(undefined, h),
      });
      await this.registry.register(characterExtension, { host });
    }

    // Pomodoro extension
    if (!this.isExtensionDisabled("pomodoro")) {
      const pomodoroExtension = createExtension({
        id: "pomodoro",
        name: "Pomodoro Timer",
        version: "1.1.0",
        description: "Pomodoro-style focus sessions",
        requiredCapabilities: ["notifications"],
        createRuntime: (h) => createPomodoroRuntime({ sessionDuration: 30, breakDuration: 5 }, h),
      });
      await this.registry.register(pomodoroExtension, { host });
    }

    // Tasks extension
    if (!this.isExtensionDisabled("tasks")) {
      const taskExtension = createExtension({
        id: "tasks",
        name: "Task Manager",
        version: "1.1.0",
        description: "Task tracking and management",
        requiredCapabilities: [],
        createRuntime: (h) => createTaskRuntime({ initialState: this.config.initialTaskState }, h),
      });
      await this.registry.register(taskExtension, { host });
    }

    // Spotify extension - optional, only if configured and not disabled
    if (this.config.spotify && !this.isExtensionDisabled("spotify")) {
      this.spotifyManager = createSpotifyManager({
        clientId: this.config.spotify.clientId,
        redirectUri: this.config.spotify.redirectUri,
        initialTokens: this.config.spotify.initialTokens,
        onStateChange: (event) => {
          this.config.onSpotifyStateChange?.(event);
        },
      });

      // TODO: Update createSpotifyExtension to use new API
      // For now, Spotify manager is managed manually
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
   * Get metadata for all available built-in extensions.
   */
  getAvailableExtensions(): readonly BuiltInExtensionInfo[] {
    return BUILT_IN_EXTENSIONS;
  }

  /**
   * Get the list of currently disabled extension IDs.
   */
  getDisabledExtensions(): string[] {
    return this.config.disabledExtensions ?? [];
  }

  // ===========================================================================
  // Public API - Task State (via state channel)
  // ===========================================================================

  /**
   * Get current task state.
   */
  getTaskState(): TaskState | null {
    const channel = this.registry.getStateChannel("tasks:state");
    if (!channel) return null;
    return channel.channel.getState() as TaskState;
  }

  /**
   * Load task state (e.g., from storage on startup).
   */
  loadTaskState(state: TaskState): void {
    // Task state is now managed by the extension itself via host storage
    // This is a compatibility method that doesn't do anything
    console.warn("[ExtensionManager] loadTaskState is deprecated - tasks extension manages its own state");
  }

  // ===========================================================================
  // Public API - Pomodoro State (via state channel)
  // ===========================================================================

  /**
   * Get current pomodoro state.
   */
  getPomodoroState(): {
    phase: string;
    remainingSeconds: number;
    isBreak: boolean;
    sessionsCompleted: number;
  } | null {
    const channel = this.registry.getStateChannel("pomodoro:state");
    if (!channel) return null;
    const state = channel.channel.getState() as any;
    return {
      phase: state.state,
      remainingSeconds: state.remainingTime,
      isBreak: state.isBreak,
      sessionsCompleted: state.sessionsCompleted ?? 0,
    };
  }

  // ===========================================================================
  // Public API - Spotify Manager
  // ===========================================================================

  /**
   * Get the Spotify manager instance.
   */
  getSpotifyManager(): SpotifyManager | null {
    return this.spotifyManager;
  }

  /**
   * Check if Spotify is enabled.
   */
  isSpotifyEnabled(): boolean {
    return this.spotifyManager !== null;
  }

  /**
   * Get Spotify authorization URL for OAuth flow (PKCE).
   */
  async getSpotifyAuthUrl(state?: string): Promise<string | null> {
    if (!this.spotifyManager) return null;
    return this.spotifyManager.getAuthorizationUrl(state);
  }

  /**
   * Exchange authorization code for Spotify tokens.
   */
  async exchangeSpotifyCode(code: string): Promise<SpotifyTokens | null> {
    if (!this.spotifyManager) return null;
    return this.spotifyManager.exchangeCode(code);
  }

  /**
   * Get Spotify access token for Web Playback SDK.
   */
  getSpotifyAccessToken(): string | null {
    return this.spotifyManager?.getAccessToken() ?? null;
  }

  /**
   * Get Spotify tokens for persistence.
   */
  getSpotifyTokens(): SpotifyTokens | null {
    return this.spotifyManager?.getTokens() ?? null;
  }

  /**
   * Load Spotify tokens (e.g., from storage on startup).
   */
  loadSpotifyTokens(tokens: SpotifyTokens): void {
    this.spotifyManager?.loadTokens(tokens);
  }

  /**
   * Check if Spotify is authenticated.
   */
  isSpotifyAuthenticated(): boolean {
    return this.spotifyManager?.isAuthenticated() ?? false;
  }

  /**
   * Update Spotify playback state from Web Playback SDK.
   */
  updateSpotifyPlaybackState(playback: SpotifyPlaybackState): void {
    this.spotifyManager?.updatePlaybackState(playback);
  }

  /**
   * Fetch current playback state from Spotify REST API.
   */
  async getSpotifyPlaybackState(): Promise<SpotifyPlaybackState | null> {
    if (!this.spotifyManager || !this.spotifyManager.isAuthenticated()) {
      return null;
    }

    try {
      return await this.spotifyManager.getPlaybackState();
    } catch (error) {
      console.error("[ExtensionManager] Failed to get playback state:", error);
      return null;
    }
  }

  /**
   * Disconnect Spotify.
   */
  disconnectSpotify(): void {
    this.spotifyManager?.disconnect();
  }

  /**
   * Resume or start Spotify playback.
   */
  async spotifyPlay(): Promise<void> {
    await this.spotifyManager?.play();
  }

  /**
   * Pause Spotify playback.
   */
  async spotifyPause(): Promise<void> {
    await this.spotifyManager?.pause();
  }

  /**
   * Skip to next track.
   */
  async spotifyNext(): Promise<void> {
    await this.spotifyManager?.skipToNext();
  }

  /**
   * Skip to previous track.
   */
  async spotifyPrevious(): Promise<void> {
    await this.spotifyManager?.skipToPrevious();
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
   */
  async discoverAndLoadPackages(): Promise<LoadResult[]> {
    return this.loader.discoverAndLoad();
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
    await this.registry.destroy();
    this.spotifyManager = null;
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
