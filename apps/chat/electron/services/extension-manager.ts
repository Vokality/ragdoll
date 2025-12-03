/**
 * Extension Manager - Orchestrates the extension system in the Electron main process.
 *
 * Responsibilities:
 * - Manages the ExtensionRegistry lifecycle
 * - Registers built-in extensions with appropriate handlers
 * - Manages stateful extensions (tasks, pomodoro) in the main process
 * - Syncs state changes to the renderer via callbacks
 * - Provides tool definitions to the OpenAI service
 */

import {
  createRegistry,
  createLoader,
  createCharacterExtension,
  createStatefulPomodoroExtension,
  createStatefulTaskExtension,
  type ExtensionRegistry,
  type ExtensionLoader,
  type ToolDefinition,
  type ToolResult,
  type LoadResult,
  type CharacterToolHandler,
  type TaskManager,
  type TaskState,
  type TaskEvent,
  type PomodoroManager,
  type PomodoroEvent,
} from "@vokality/ragdoll-extensions";

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
 * Configuration for the extension manager
 */
export interface ExtensionManagerConfig {
  /** Callback invoked when character tools are executed (for forwarding to renderer) */
  onToolExecution?: ToolExecutionCallback;

  /** Callback when task state changes (for persistence/sync to renderer) */
  onTaskStateChange?: TaskStateCallback;

  /** Callback when pomodoro state changes (for sync to renderer) */
  onPomodoroStateChange?: PomodoroStateCallback;

  /** Initial task state to load */
  initialTaskState?: TaskState;

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
}

// =============================================================================
// Extension Manager
// =============================================================================

/**
 * Manages extensions and provides a unified interface for tool access.
 *
 * @example
 * ```ts
 * const manager = new ExtensionManager({
 *   onToolExecution: (name, args) => {
 *     mainWindow?.webContents.send("chat:function-call", name, args);
 *   },
 *   onTaskStateChange: (event) => {
 *     mainWindow?.webContents.send("tasks:state-changed", event.state);
 *     saveTasksToStorage(event.state);
 *   },
 *   onPomodoroStateChange: (event) => {
 *     mainWindow?.webContents.send("pomodoro:state-changed", event.state);
 *   },
 *   initialTaskState: await loadTasksFromStorage(),
 * });
 *
 * await manager.initialize();
 *
 * // Get tools for OpenAI
 * const tools = manager.getTools();
 *
 * // Execute a tool
 * const result = await manager.executeTool("setMood", { mood: "smile" });
 * ```
 */
export class ExtensionManager {
  private registry: ExtensionRegistry;
  private loader: ExtensionLoader;
  private config: ExtensionManagerConfig;
  private initialized = false;

  // Stateful managers
  private taskManager: TaskManager | null = null;
  private pomodoroManager: PomodoroManager | null = null;

  constructor(config: ExtensionManagerConfig = {}) {
    this.config = config;
    this.registry = createRegistry();
    this.loader = createLoader(this.registry, {
      searchPaths: config.searchPaths ?? [],
      continueOnError: true,
    });
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

    // Auto-discover and load packages if configured
    if (this.config.autoDiscover && this.config.searchPaths?.length) {
      await this.discoverAndLoadPackages();
    }

    this.initialized = true;
  }

  /**
   * Register the built-in extensions.
   *
   * - Character extension: forwards to renderer (UI-based)
   * - Pomodoro extension: stateful, managed in main process
   * - Tasks extension: stateful, managed in main process
   */
  private async registerBuiltInExtensions(): Promise<void> {
    // Character extension - forwards to renderer for UI updates
    const characterHandler = this.createCharacterForwardingHandler();
    const characterExtension = createCharacterExtension({
      handler: characterHandler,
    });
    await this.registry.register(characterExtension);

    // Pomodoro extension - stateful, managed here
    const { extension: pomodoroExtension, manager: pomodoroManager } =
      createStatefulPomodoroExtension({
        sessionDuration: 30,
        breakDuration: 5,
        onStateChange: (event) => {
          // Forward state changes to renderer
          if (this.config.onPomodoroStateChange) {
            this.config.onPomodoroStateChange(event);
          }
          // Also forward as tool execution for backward compatibility
          if (this.config.onToolExecution) {
            this.config.onToolExecution("_pomodoroStateChanged", {
              type: event.type,
              state: event.state,
            });
          }
        },
      });
    this.pomodoroManager = pomodoroManager;
    await this.registry.register(pomodoroExtension);

    // Tasks extension - stateful, managed here
    const { extension: taskExtension, manager: taskManager } =
      createStatefulTaskExtension({
        initialState: this.config.initialTaskState,
        onStateChange: (event) => {
          // Forward state changes to renderer
          if (this.config.onTaskStateChange) {
            this.config.onTaskStateChange(event);
          }
          // Also forward as tool execution for backward compatibility
          if (this.config.onToolExecution) {
            this.config.onToolExecution("_taskStateChanged", {
              type: event.type,
              state: event.state,
              task: event.task,
            });
          }
        },
      });
    this.taskManager = taskManager;
    await this.registry.register(taskExtension);
  }

  /**
   * Creates a handler that forwards character tool calls to the renderer.
   */
  private createCharacterForwardingHandler(): CharacterToolHandler {
    const forward = (
      methodName: string,
      args: Record<string, unknown>
    ): ToolResult => {
      if (this.config.onToolExecution) {
        this.config.onToolExecution(methodName, args);
      }
      return {
        success: true,
        data: { handledInRenderer: true, tool: methodName },
      };
    };

    return {
      setMood: (args) => forward("setMood", args as unknown as Record<string, unknown>),
      triggerAction: (args) => forward("triggerAction", args as unknown as Record<string, unknown>),
      setHeadPose: (args) => forward("setHeadPose", args as unknown as Record<string, unknown>),
      setSpeechBubble: (args) => forward("setSpeechBubble", args as unknown as Record<string, unknown>),
    };
  }

  // ===========================================================================
  // Public API - Tools
  // ===========================================================================

  /**
   * Get all tool definitions in OpenAI format.
   * Call this fresh on each chat request to get the latest tools.
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
  // Public API - Task Manager
  // ===========================================================================

  /**
   * Get the task manager instance.
   */
  getTaskManager(): TaskManager | null {
    return this.taskManager;
  }

  /**
   * Get current task state.
   */
  getTaskState(): TaskState | null {
    return this.taskManager?.getState() ?? null;
  }

  /**
   * Load task state (e.g., from storage on startup).
   */
  loadTaskState(state: TaskState): void {
    this.taskManager?.loadState(state);
  }

  // ===========================================================================
  // Public API - Pomodoro Manager
  // ===========================================================================

  /**
   * Get the pomodoro manager instance.
   */
  getPomodoroManager(): PomodoroManager | null {
    return this.pomodoroManager;
  }

  /**
   * Get current pomodoro state.
   */
  getPomodoroState(): {
    phase: string;
    remainingSeconds: number;
    isBreak: boolean;
    sessionsCompleted: number;
  } | null {
    if (!this.pomodoroManager) return null;
    const state = this.pomodoroManager.getState();
    return {
      phase: state.phase,
      remainingSeconds: this.pomodoroManager.getRemainingSeconds(),
      isBreak: state.isBreak,
      sessionsCompleted: state.sessionsCompleted,
    };
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
    await this.registry.destroy();
    this.taskManager = null;
    this.pomodoroManager = null;
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
  if (!extensionManagerInstance) {
    extensionManagerInstance = new ExtensionManager(config);
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
