/**
 * @vokality/ragdoll-extensions/core
 *
 * Core extension framework without React UI components.
 * Use this entry point in environments where React is not available
 * (e.g., Electron main process, Node.js scripts).
 *
 * For React UI components, use "@vokality/ragdoll-extensions/ui" or
 * the main "@vokality/ragdoll-extensions" entry point.
 *
 * @example
 * ```ts
 * // In Electron main process or Node.js
 * import {
 *   createRegistry,
 *   createStatefulTaskExtension,
 * } from "@vokality/ragdoll-extensions/core";
 *
 * const registry = createRegistry();
 * const { extension, manager } = createStatefulTaskExtension();
 * await registry.register(extension);
 * ```
 */

// =============================================================================
// Core Types
// =============================================================================

export type {
  // Tool definition types (OpenAI-compatible)
  ToolParameterSchema,
  ToolPropertySchema,
  ToolFunctionDefinition,
  ToolDefinition,

  // Tool execution types
  ValidationResult,
  ToolResult,
  ToolHandler,
  ToolValidator,
  ToolExecutionContext,

  // Extension types
  ExtensionTool,
  ExtensionContext,
  ExtensionManifest,
  ExtensionRuntimeContribution,
  ExtensionServiceDefinition,
  ExtensionServiceHandler,
  ExtensionServiceContext,
  ExtensionStateChannel,
  RagdollExtension,
  ExtensionCapabilityType,
  ExtensionContributionMetadata,

  // Registry types
  RegistryEventType,
  RegistryEvent,
  RegistryEventCallback,
  RegisterOptions,

  // Factory types
  ExtensionConfig,

  // Host environment types
  ExtensionHostEnvironment,
  ExtensionHostCapability,
  HostStorageCapability,
  HostLoggerCapability,
  HostTimersCapability,
  HostSchedulerCapability,
  HostIpcBridge,
  HostScheduleOptions,
  NotificationRequest,
  NotificationCallback,
} from "./types.js";

// =============================================================================
// Config Schema Types
// =============================================================================

export type {
  // Config field types
  ConfigField,
  ConfigSchema,
  ConfigValues,
  ExtensionConfigStatus,

  // OAuth types
  OAuthConfig,
  OAuthTokens,
  OAuthConnectionStatus,
  OAuthState,
  OAuthEventType,
  OAuthEvent,
  OAuthEventCallback,
  HostOAuthCapability,
} from "./types/config-schema.js";

// Re-export Zod schema utilities
export {
  ConfigFieldSchema,
  ConfigSchemaSchema,
  OAuthConfigSchema,
  OAuthTokensSchema,
  OAuthStateSchema,
  configSchemaToZod,
  validateConfigValues,
  getMissingRequiredFields,
  applyConfigDefaults,
  z,
} from "./types/config-schema.js";

// Host config capability
export type { HostConfigCapability } from "./types/host-environment.js";

// =============================================================================
// Factory
// =============================================================================

export { createExtension } from "./create-extension.js";

// =============================================================================
// Registry
// =============================================================================

export { ExtensionRegistry, createRegistry } from "./registry.js";

// =============================================================================
// Loader
// =============================================================================

export { ExtensionLoader, createLoader } from "./loader.js";
export type {
  ExtensionPackageJson,
  ExtensionPackageManifest,
  ExtensionPackageInfo,
  LoadResult,
  ExtensionLoaderConfig,
} from "./loader.js";

// =============================================================================
// NOTE: Built-in extensions have been moved to standalone packages.
// Import them directly from their packages:
//
//   import { createCharacterRuntime } from "@vokality/ragdoll-extension-character";
//   import { createTaskRuntime } from "@vokality/ragdoll-extension-tasks";
//   import { createPomodoroRuntime } from "@vokality/ragdoll-extension-pomodoro";
//   import { createSpotifyRuntime } from "@vokality/ragdoll-extension-spotify";
//
// The framework package no longer re-exports extensions to avoid circular dependencies.
// =============================================================================
