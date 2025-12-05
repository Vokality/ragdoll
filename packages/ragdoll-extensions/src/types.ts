/**
 * Core types for the Ragdoll extension system.
 */

import type {
  ExtensionHostCapability,
  ExtensionHostEnvironment,
  HostIpcBridge,
  HostLoggerCapability,
  HostScheduleOptions,
  HostSchedulerCapability,
  HostStorageCapability,
  HostTimersCapability,
  NotificationCallback,
  NotificationRequest,
} from "./types/host-environment.js";
import type { ExtensionUISlot } from "./ui/types.js";

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
  context: ToolExecutionContext,
) => Promise<ToolResult> | ToolResult;

/**
 * Optional validator for tool arguments
 */
export type ToolValidator<TArgs = Record<string, unknown>> = (
  args: TArgs,
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
  /** Timestamp when this instance was created */
  createdAt: number;
  /** Configuration passed during registration */
  config?: Record<string, unknown>;
}

/**
 * Metadata describing an extension.
 */
export interface ExtensionManifest {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Optional description */
  description?: string;
  /** Capabilities that must be provided by the host environment */
  requiredCapabilities?: ReadonlyArray<ExtensionHostCapability>;
}

/**
 * Supported capability types tracked by the registry.
 */
export type ExtensionCapabilityType = "tool" | "service" | "stateChannel" | "slot";

/**
 * Context exposed to service handlers.
 */
export interface ExtensionServiceContext {
  extensionId: string;
  host: ExtensionHostEnvironment;
  metadata?: Record<string, unknown>;
}

/**
 * Handler signature for extension services.
 */
export type ExtensionServiceHandler<TPayload = unknown, TResult = unknown> = (
  payload: TPayload,
  context: ExtensionServiceContext,
) => Promise<TResult> | TResult;

/**
 * Service definition exposed by an extension.
 */
export interface ExtensionServiceDefinition<TPayload = unknown, TResult = unknown> {
  name: string;
  description?: string;
  inputSchema?: ToolParameterSchema;
  handler: ExtensionServiceHandler<TPayload, TResult>;
}

/**
 * State channel definition exposed by an extension.
 */
export interface ExtensionStateChannel<TState = unknown> {
  id: string;
  description?: string;
  getState(): TState;
  subscribe(listener: (state: TState) => void): () => void;
}

/**
 * Runtime contribution produced when an extension is activated.
 */
export interface ExtensionRuntimeContribution {
  tools?: ExtensionTool[];
  services?: ExtensionServiceDefinition[];
  stateChannels?: ExtensionStateChannel[];
  slots?: ExtensionUISlot[];
  metadata?: Record<string, unknown>;
  dispose?: () => Promise<void> | void;
}

/**
 * Extension contract. Extensions receive a host environment and return runtime contributions.
 */
export interface RagdollExtension {
  readonly manifest: ExtensionManifest;
  activate(
    host: ExtensionHostEnvironment,
    context: ExtensionContext,
  ): Promise<ExtensionRuntimeContribution> | ExtensionRuntimeContribution;
  deactivate?(context: ExtensionContext): Promise<void> | void;
}

// =============================================================================
// Registry Types
// =============================================================================

/**
 * Options for registering an extension with the registry.
 */
export interface RegisterOptions {
  /** Host environment surface provided to the extension */
  host: ExtensionHostEnvironment;
  /** Configuration passed to the extension */
  config?: Record<string, unknown>;
  /** Whether to replace an existing extension */
  replace?: boolean;
}

/**
 * Metadata summary describing the capabilities contributed by an extension instance.
 */
export interface ExtensionContributionMetadata {
  extensionId: string;
  manifest: ExtensionManifest;
  tools: string[];
  services: string[];
  stateChannels: string[];
  slots: string[];
}

/**
 * Event types emitted by the extension registry
 */
export type RegistryEventType =
  | "extension:registered"
  | "extension:unregistered"
  | "tools:changed"
  | "capability:registered"
  | "capability:removed";

export interface RegistryEventBase {
  type: RegistryEventType;
  extensionId: string;
  timestamp: number;
}

export interface RegistryBasicEvent extends RegistryEventBase {
  type: "extension:registered" | "extension:unregistered" | "tools:changed";
}

export interface RegistryCapabilityEvent extends RegistryEventBase {
  type: "capability:registered" | "capability:removed";
  capabilityType: ExtensionCapabilityType;
  capabilityId: string;
}

export type RegistryEvent = RegistryBasicEvent | RegistryCapabilityEvent;

/**
 * Callback for registry event subscriptions
 */
export type RegistryEventCallback = (event: RegistryEvent) => Promise<void> | void;

// =============================================================================
// Factory Types
// =============================================================================

export interface ExtensionConfig {
  id: string;
  name: string;
  version: string;
  description?: string;
  requiredCapabilities?: ReadonlyArray<ExtensionHostCapability>;
  tools?: ExtensionTool[] | ((host: ExtensionHostEnvironment, context: ExtensionContext) => ExtensionTool[]);
  services?:
    | ExtensionServiceDefinition[]
    | ((host: ExtensionHostEnvironment, context: ExtensionContext) => ExtensionServiceDefinition[]);
  stateChannels?:
    | ExtensionStateChannel[]
    | ((host: ExtensionHostEnvironment, context: ExtensionContext) => ExtensionStateChannel[]);
  slots?: ExtensionUISlot[] | ((host: ExtensionHostEnvironment, context: ExtensionContext) => ExtensionUISlot[]);
  createRuntime?: (
    host: ExtensionHostEnvironment,
    context: ExtensionContext,
  ) => Promise<ExtensionRuntimeContribution | void> | ExtensionRuntimeContribution | void;
  onInitialize?: (
    context: ExtensionContext,
    host: ExtensionHostEnvironment,
  ) => Promise<void> | void;
  onDestroy?: (context: ExtensionContext) => Promise<void> | void;
}

// =============================================================================
// Legacy Notification Type Re-exports (compatibility)
// =============================================================================

export type {
  ExtensionHostCapability,
  ExtensionHostEnvironment,
  HostIpcBridge,
  HostLoggerCapability,
  HostScheduleOptions,
  HostSchedulerCapability,
  HostStorageCapability,
  HostTimersCapability,
  NotificationCallback,
  NotificationRequest,
};
