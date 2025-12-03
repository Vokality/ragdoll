/**
 * Core types for the Ragdoll extension system.
 *
 * Extensions provide tools that AI agents can use. Tools are defined in
 * OpenAI function-calling format for broad compatibility.
 */

// =============================================================================
// Tool Definition Types (OpenAI-compatible)
// =============================================================================

/**
 * JSON Schema for tool parameters
 */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, ToolPropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolPropertySchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: readonly (string | number)[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  items?: ToolPropertySchema;
  default?: unknown;
}

/**
 * Tool function definition (OpenAI format)
 */
export interface ToolFunctionDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

/**
 * Complete tool definition (OpenAI format)
 */
export interface ToolDefinition {
  type: "function";
  function: ToolFunctionDefinition;
}

// =============================================================================
// Tool Execution Types
// =============================================================================

/**
 * Result of validating tool arguments
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Result of executing a tool
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Handler function for executing a tool
 */
export type ToolHandler<TArgs = Record<string, unknown>> = (
  args: TArgs,
  context: ToolExecutionContext
) => Promise<ToolResult> | ToolResult;

/**
 * Optional validator for tool arguments
 */
export type ToolValidator<TArgs = Record<string, unknown>> = (
  args: TArgs
) => ValidationResult;

/**
 * Context passed to tool handlers during execution
 */
export interface ToolExecutionContext {
  /** ID of the extension that owns this tool */
  extensionId: string;
  /** Optional metadata from the caller */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Extension Types
// =============================================================================

/**
 * A single tool provided by an extension
 */
export interface ExtensionTool<TArgs = Record<string, unknown>> {
  /** Tool definition in OpenAI format */
  definition: ToolDefinition;
  /** Handler function to execute the tool */
  handler: ToolHandler<TArgs>;
  /** Optional argument validator */
  validate?: ToolValidator<TArgs>;
}

/**
 * Context provided to extensions during initialization
 */
export interface ExtensionContext {
  /** Unique instance ID for this extension registration */
  instanceId: string;
  /** Configuration passed during registration */
  config?: Record<string, unknown>;
}

/**
 * A Ragdoll extension that provides tools to AI agents
 */
export interface RagdollExtension {
  /** Unique identifier for this extension */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Semantic version */
  readonly version: string;
  /** Tools provided by this extension */
  readonly tools: ExtensionTool[];

  /** Called when extension is registered */
  initialize?(context: ExtensionContext): Promise<void> | void;
  /** Called when extension is unregistered */
  destroy?(): Promise<void> | void;
}

// =============================================================================
// Registry Types
// =============================================================================

/**
 * Event types emitted by the extension registry
 */
export type RegistryEventType =
  | "extension:registered"
  | "extension:unregistered"
  | "tools:changed";

/**
 * Event payload for registry events
 */
export interface RegistryEvent {
  type: RegistryEventType;
  extensionId: string;
  timestamp: number;
}

/**
 * Callback for registry event subscriptions
 */
export type RegistryEventCallback = (event: RegistryEvent) => void;

/**
 * Options for registering an extension
 */
export interface RegisterOptions {
  /** Configuration to pass to the extension */
  config?: Record<string, unknown>;
  /** Whether to replace an existing extension with the same ID */
  replace?: boolean;
}

// =============================================================================
// Factory Types
// =============================================================================

/**
 * Configuration for creating an extension via factory
 */
export interface ExtensionConfig {
  /** Unique identifier for this extension */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Tools provided by this extension */
  tools: ExtensionTool[];
  /** Called when extension is registered */
  onInitialize?: (context: ExtensionContext) => Promise<void> | void;
  /** Called when extension is unregistered */
  onDestroy?: () => Promise<void> | void;
}
