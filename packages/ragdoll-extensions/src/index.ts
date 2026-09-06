/**
 * @vokality/ragdoll-extensions
 *
 * React-free extension contracts, registry, and slot state.
 *
 * For React UI components, use "@vokality/ragdoll-extensions/ui".
 *
 * @example
 * ```ts
 * // In a host process
 * import { createRegistry } from "@vokality/ragdoll-extensions";
 *
 * const registry = createRegistry({
 *   now: Date.now,
 *   onListenerError: console.error,
 * });
 * await registry.register(extension, { host });
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
  RegistryCapabilityEvent,
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
  HostSchedulerPriority,
  HostIpcBridge,
  HostConversationEventsCapability,
  HostScheduleOptions,
  ConversationEventInput,
  EventTurnPolicy,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  PublishedConversationEvent,
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
export {
  CONVERSATION_EVENT_TYPE_PATTERN,
  HOST_CAPABILITY_FIELDS,
  REQUIRED_TOOL_NAME_PATTERN,
} from "./types/host-environment.js";

// =============================================================================
// React-free Slot Contracts and State
// =============================================================================

export type {
  PresetIconName,
  ItemStatus,
  ListPanelItem,
  PanelAction,
  ListPanelSection,
  ListPanelConfig,
  GridPanelCell,
  GridPanelConfig,
  GridPanelResult,
  PanelProgress,
  PanelFrame,
  PanelStatus,
  CardsPanelResult,
  CardsPanelCardBase,
  CardsAnswerInput,
  CardsPanelFront,
  CardsPanelRevealed,
  CardsPanelConfig,
  PanelConfig,
  SlotState,
  SlotStateCallback,
  SlotStateStore,
  MutableSlotStateStore,
  DerivedSlotStateOptions,
  ExtensionSlot,
  SerializedPanelAction,
  SerializedListPanelItem,
  SerializedListPanelSection,
  SerializedListPanelConfig,
  SerializedGridPanelCell,
  SerializedGridPanelConfig,
  SerializedCardsPanelConfig,
  SerializedPanelConfig,
  SerializedSlotState,
} from "./slots.js";
export {
  createSlotState,
  createDerivedSlotState,
  createHiddenSlotState,
  createListSlotState,
  createGridSlotState,
  createCardsSlotState,
  serializeSlotState,
} from "./slots.js";

// =============================================================================
// Factory
// =============================================================================

export { createExtension } from "./create-extension.js";

// =============================================================================
// Registry
// =============================================================================

export { ExtensionRegistry, createRegistry } from "./registry.js";
