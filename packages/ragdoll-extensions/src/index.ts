/**
 * @vokality/ragdoll-extensions
 *
 * Extension framework for Ragdoll - register tools, handlers, and plugins
 * that integrate with AI agents.
 *
 * @example
 * ```ts
 * import {
 *   createExtension,
 *   createRegistry,
 *   createCharacterExtension,
 * } from "@vokality/ragdoll-extensions";
 *
 * // Create a registry
 * const registry = createRegistry();
 *
 * // Register the character extension
 * const characterExtension = createCharacterExtension({
 *   handler: {
 *     setMood: async ({ mood }) => ({ success: true }),
 *     triggerAction: async ({ action }) => ({ success: true }),
 *     setHeadPose: async (args) => ({ success: true }),
 *     setSpeechBubble: async (args) => ({ success: true }),
 *   },
 * });
 * await registry.register(characterExtension);
 *
 * // Get all tools for OpenAI
 * const tools = registry.getAllTools();
 *
 * // Execute a tool
 * const result = await registry.executeTool("setMood", { mood: "smile" });
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
  LoadResult,
  ExtensionLoaderConfig,
} from "./loader.js";

// =============================================================================
// NOTE: Built-in extensions have been moved to standalone packages.
// Apps should import them directly:
//
//   import { createCharacterRuntime } from "@vokality/ragdoll-extension-character";
//   import { createTaskRuntime } from "@vokality/ragdoll-extension-tasks";
//   import { createPomodoroRuntime } from "@vokality/ragdoll-extension-pomodoro";
//   import { createSpotifyRuntime } from "@vokality/ragdoll-extension-spotify";
//
// The framework package no longer re-exports extensions to avoid circular dependencies.
// =============================================================================

// =============================================================================
// UI Components and Utilities
// =============================================================================

export {
  // State management
  createSlotState,
  createDerivedSlotState,
  createHiddenSlotState,
  createListSlotState,

  // React hooks
  useSlotState,
  useSlotStateStore,
  useSlotBadge,
  useSlotVisible,
  useSlotRegistry,
  useVisibleSlots,
  useActiveSlot,

  // React components
  SlotButton,
  SlotButtonStateless,
  SlotPanel,
  SlotPanelBase,
  SlotBar,
  ControlledSlotBar,

  // Icons
  presetIcons,
  getSlotIcon,
} from "./ui/index.js";

// NOTE: UI slot helpers have been moved to extension packages.
// Import them directly from the extension packages:
//
//   import { createTaskUISlot } from "@vokality/ragdoll-extension-tasks";
//   import { createPomodoroUISlot } from "@vokality/ragdoll-extension-pomodoro";
//   import { createSpotifyUISlot } from "@vokality/ragdoll-extension-spotify";


export type {
  // Icon types
  PresetIconName,
  SlotIcon,
  IconProps,

  // Panel types
  ItemStatus,
  ListPanelItem,
  PanelAction,
  ListPanelSection,
  ListPanelConfig,
  CustomPanelConfig,
  CustomPanelProps,
  PanelConfig,

  // Slot types
  SlotState,
  SlotStateCallback,
  SlotStateStore,
  ExtensionUISlot,
  MutableSlotStateStore,
  DerivedSlotStateOptions,

  // Registry types
  SlotRegistryEventType,
  SlotRegistryEvent,
  SlotRegistryEventCallback,
  SlotRegistry,

  // Component prop types
  SlotButtonProps,
  SlotPanelProps,
  SlotBarProps,
  ControlledSlotBarProps,
} from "./ui/index.js";
