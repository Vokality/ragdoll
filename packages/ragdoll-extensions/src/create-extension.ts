/**
 * Factory function for creating Ragdoll extensions.
 *
 * Provides a clean, type-safe way to define extensions without
 * implementing the full interface manually.
 */

import type {
  RagdollExtension,
  ExtensionConfig,
  ExtensionContext,
  ExtensionTool,
} from "./types.js";

/**
 * Creates a new Ragdoll extension from a configuration object.
 *
 * @example
 * ```ts
 * const myExtension = createExtension({
 *   id: "my-extension",
 *   name: "My Extension",
 *   version: "1.0.0",
 *   tools: [
 *     {
 *       definition: {
 *         type: "function",
 *         function: {
 *           name: "myTool",
 *           description: "Does something useful",
 *           parameters: { type: "object", properties: {} },
 *         },
 *       },
 *       handler: async (args) => ({ success: true, data: "done" }),
 *     },
 *   ],
 * });
 * ```
 */
export function createExtension(config: ExtensionConfig): RagdollExtension {
  validateConfig(config);

  return {
    get id(): string {
      return config.id;
    },

    get name(): string {
      return config.name;
    },

    get version(): string {
      return config.version;
    },

    get tools(): ExtensionTool[] {
      return config.tools;
    },

    async initialize(context: ExtensionContext): Promise<void> {
      if (config.onInitialize) {
        await config.onInitialize(context);
      }
    },

    async destroy(): Promise<void> {
      if (config.onDestroy) {
        await config.onDestroy();
      }
    },
  };
}

/**
 * Validates extension configuration at creation time.
 * Throws descriptive errors for invalid configurations.
 */
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

  if (!Array.isArray(config.tools)) {
    throw new Error("Extension config requires a 'tools' array");
  }

  // Validate each tool
  const toolNames = new Set<string>();
  for (const tool of config.tools) {
    validateTool(tool, toolNames);
  }
}

/**
 * Validates a single tool definition.
 */
function validateTool(tool: ExtensionTool, seenNames: Set<string>): void {
  if (!tool.definition) {
    throw new Error("Tool requires a 'definition' object");
  }

  if (tool.definition.type !== "function") {
    throw new Error("Tool definition type must be 'function'");
  }

  const fn = tool.definition.function;
  if (!fn) {
    throw new Error("Tool definition requires a 'function' object");
  }

  if (!fn.name || typeof fn.name !== "string") {
    throw new Error("Tool function requires a non-empty string 'name'");
  }

  if (seenNames.has(fn.name)) {
    throw new Error(`Duplicate tool name: '${fn.name}'`);
  }
  seenNames.add(fn.name);

  if (!fn.description || typeof fn.description !== "string") {
    throw new Error(`Tool '${fn.name}' requires a non-empty 'description'`);
  }

  if (!fn.parameters || fn.parameters.type !== "object") {
    throw new Error(
      `Tool '${fn.name}' requires 'parameters' with type 'object'`
    );
  }

  if (typeof tool.handler !== "function") {
    throw new Error(`Tool '${fn.name}' requires a 'handler' function`);
  }

  if (tool.validate !== undefined && typeof tool.validate !== "function") {
    throw new Error(`Tool '${fn.name}' has invalid 'validate' (must be function)`);
  }
}
