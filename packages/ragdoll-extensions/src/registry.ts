/**
 * Extension Registry - Central hub for managing extensions and tools.
 *
 * The registry is the core orchestrator of the extension system. It:
 * - Registers and unregisters extensions
 * - Aggregates tools from all registered extensions
 * - Routes tool execution to the appropriate handler
 * - Emits events when the tool set changes
 */

import type {
  RagdollExtension,
  ExtensionTool,
  ToolDefinition,
  ToolResult,
  ValidationResult,
  ToolExecutionContext,
  RegisterOptions,
  RegistryEvent,
  RegistryEventType,
  RegistryEventCallback,
} from "./types.js";

/**
 * Internal state for a registered extension
 */
interface RegisteredExtension {
  extension: RagdollExtension;
  instanceId: string;
  registeredAt: number;
}

/**
 * Internal mapping of tool name to its owner and definition
 */
interface ToolEntry {
  extensionId: string;
  tool: ExtensionTool;
}

/**
 * Extension Registry - manages extensions and provides unified tool access.
 *
 * @example
 * ```ts
 * const registry = new ExtensionRegistry();
 *
 * // Register an extension
 * await registry.register(myExtension);
 *
 * // Get all tools for OpenAI
 * const tools = registry.getAllTools();
 *
 * // Execute a tool
 * const result = await registry.executeTool("myTool", { arg: "value" });
 *
 * // Listen for changes
 * const unsubscribe = registry.onToolsChanged((event) => {
 *   console.log("Tools changed:", registry.getAllTools());
 * });
 * ```
 */
export class ExtensionRegistry {
  private extensions: Map<string, RegisteredExtension> = new Map();
  private toolIndex: Map<string, ToolEntry> = new Map();
  private listeners: Map<RegistryEventType, Set<RegistryEventCallback>> =
    new Map();
  private instanceCounter = 0;

  /**
   * Register an extension with the registry.
   *
   * @param extension - The extension to register
   * @param options - Registration options
   * @throws Error if extension ID already registered (unless replace: true)
   * @throws Error if tool names conflict with existing tools
   */
  async register(
    extension: RagdollExtension,
    options: RegisterOptions = {}
  ): Promise<void> {
    const { config, replace = false } = options;

    // Check for existing registration
    if (this.extensions.has(extension.id)) {
      if (!replace) {
        throw new Error(
          `Extension '${extension.id}' is already registered. Use { replace: true } to override.`
        );
      }
      // Unregister existing before replacing
      await this.unregister(extension.id);
    }

    // Validate tool names don't conflict
    for (const tool of extension.tools) {
      const toolName = tool.definition.function.name;
      const existing = this.toolIndex.get(toolName);
      if (existing && existing.extensionId !== extension.id) {
        throw new Error(
          `Tool name '${toolName}' conflicts with extension '${existing.extensionId}'`
        );
      }
    }

    // Generate instance ID
    const instanceId = `${extension.id}-${++this.instanceCounter}`;

    // Initialize extension
    if (extension.initialize) {
      await extension.initialize({ instanceId, config });
    }

    // Register extension
    const registered: RegisteredExtension = {
      extension,
      instanceId,
      registeredAt: Date.now(),
    };
    this.extensions.set(extension.id, registered);

    // Index tools
    for (const tool of extension.tools) {
      const toolName = tool.definition.function.name;
      this.toolIndex.set(toolName, {
        extensionId: extension.id,
        tool,
      });
    }

    // Emit events
    this.emit("extension:registered", extension.id);
    this.emit("tools:changed", extension.id);
  }

  /**
   * Unregister an extension from the registry.
   *
   * @param extensionId - ID of the extension to unregister
   * @returns true if the extension was unregistered, false if not found
   */
  async unregister(extensionId: string): Promise<boolean> {
    const registered = this.extensions.get(extensionId);
    if (!registered) {
      return false;
    }

    // Destroy extension
    if (registered.extension.destroy) {
      await registered.extension.destroy();
    }

    // Remove tools from index
    for (const tool of registered.extension.tools) {
      const toolName = tool.definition.function.name;
      this.toolIndex.delete(toolName);
    }

    // Remove extension
    this.extensions.delete(extensionId);

    // Emit events
    this.emit("extension:unregistered", extensionId);
    this.emit("tools:changed", extensionId);

    return true;
  }

  /**
   * Check if an extension is registered.
   */
  has(extensionId: string): boolean {
    return this.extensions.has(extensionId);
  }

  /**
   * Get a registered extension by ID.
   */
  getExtension(extensionId: string): RagdollExtension | undefined {
    return this.extensions.get(extensionId)?.extension;
  }

  /**
   * Get all registered extension IDs.
   */
  getExtensionIds(): string[] {
    return Array.from(this.extensions.keys());
  }

  /**
   * Get all tool definitions from all registered extensions.
   * Returns tools in OpenAI function-calling format.
   */
  getAllTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const entry of this.toolIndex.values()) {
      tools.push(entry.tool.definition);
    }
    return tools;
  }

  /**
   * Get tool definitions from a specific extension.
   */
  getToolsByExtension(extensionId: string): ToolDefinition[] {
    const registered = this.extensions.get(extensionId);
    if (!registered) {
      return [];
    }
    return registered.extension.tools.map((t) => t.definition);
  }

  /**
   * Check if a tool exists.
   */
  hasTool(toolName: string): boolean {
    return this.toolIndex.has(toolName);
  }

  /**
   * Validate tool arguments.
   *
   * @param toolName - Name of the tool to validate for
   * @param args - Arguments to validate
   * @returns Validation result with success/error
   */
  validateTool(
    toolName: string,
    args: Record<string, unknown>
  ): ValidationResult {
    const entry = this.toolIndex.get(toolName);
    if (!entry) {
      return { valid: false, error: `Unknown tool: '${toolName}'` };
    }

    if (entry.tool.validate) {
      return entry.tool.validate(args);
    }

    return { valid: true };
  }

  /**
   * Execute a tool by name.
   *
   * @param toolName - Name of the tool to execute
   * @param args - Arguments to pass to the tool
   * @param metadata - Optional metadata for the execution context
   * @returns Tool execution result
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<ToolResult> {
    const entry = this.toolIndex.get(toolName);
    if (!entry) {
      return { success: false, error: `Unknown tool: '${toolName}'` };
    }

    // Validate if validator exists
    if (entry.tool.validate) {
      const validation = entry.tool.validate(args);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }

    // Build execution context
    const context: ToolExecutionContext = {
      extensionId: entry.extensionId,
      metadata,
    };

    // Execute handler
    try {
      return await entry.tool.handler(args, context);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error during tool execution";
      return { success: false, error: message };
    }
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to tools changed events.
   * Called whenever extensions are registered or unregistered.
   *
   * @param callback - Function to call when tools change
   * @returns Unsubscribe function
   */
  onToolsChanged(callback: RegistryEventCallback): () => void {
    return this.on("tools:changed", callback);
  }

  /**
   * Subscribe to extension registered events.
   *
   * @param callback - Function to call when an extension is registered
   * @returns Unsubscribe function
   */
  onExtensionRegistered(callback: RegistryEventCallback): () => void {
    return this.on("extension:registered", callback);
  }

  /**
   * Subscribe to extension unregistered events.
   *
   * @param callback - Function to call when an extension is unregistered
   * @returns Unsubscribe function
   */
  onExtensionUnregistered(callback: RegistryEventCallback): () => void {
    return this.on("extension:unregistered", callback);
  }

  /**
   * Subscribe to a registry event.
   *
   * @param eventType - Type of event to subscribe to
   * @param callback - Function to call when the event occurs
   * @returns Unsubscribe function
   */
  on(eventType: RegistryEventType, callback: RegistryEventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Remove all listeners for an event type, or all listeners if no type specified.
   */
  off(eventType?: RegistryEventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Emit an event to all subscribers.
   */
  private emit(eventType: RegistryEventType, extensionId: string): void {
    const callbacks = this.listeners.get(eventType);
    if (!callbacks || callbacks.size === 0) {
      return;
    }

    const event: RegistryEvent = {
      type: eventType,
      extensionId,
      timestamp: Date.now(),
    };

    for (const callback of callbacks) {
      try {
        callback(event);
      } catch (error) {
        // Don't let listener errors break the registry
        console.error(
          `Error in registry event listener for '${eventType}':`,
          error
        );
      }
    }
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Unregister all extensions and clear all state.
   */
  async destroy(): Promise<void> {
    // Unregister all extensions (this will call their destroy methods)
    const extensionIds = Array.from(this.extensions.keys());
    for (const id of extensionIds) {
      await this.unregister(id);
    }

    // Clear listeners
    this.listeners.clear();
  }

  /**
   * Get registry statistics.
   */
  getStats(): {
    extensionCount: number;
    toolCount: number;
    listenerCount: number;
  } {
    let listenerCount = 0;
    for (const listeners of this.listeners.values()) {
      listenerCount += listeners.size;
    }

    return {
      extensionCount: this.extensions.size,
      toolCount: this.toolIndex.size,
      listenerCount,
    };
  }
}

/**
 * Create a new extension registry instance.
 *
 * @example
 * ```ts
 * const registry = createRegistry();
 * await registry.register(myExtension);
 * ```
 */
export function createRegistry(): ExtensionRegistry {
  return new ExtensionRegistry();
}
