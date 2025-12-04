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
  RagdollExtension,

  // Registry types
  RegistryEventType,
  RegistryEvent,
  RegistryEventCallback,
  RegisterOptions,

  // Factory types
  ExtensionConfig,
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
// Built-in Extensions
// =============================================================================

// Character extension
export {
  createCharacterExtension,
  VALID_MOODS,
  VALID_ACTIONS,
  VALID_TONES,
} from "./extensions/character/index.js";
export type {
  CharacterMood,
  CharacterAction,
  BubbleTone,
  SetMoodArgs,
  TriggerActionArgs,
  SetHeadPoseArgs,
  SetSpeechBubbleArgs,
  CharacterToolHandler,
  CharacterExtensionOptions,
} from "./extensions/character/index.js";

// Pomodoro extension
export {
  createPomodoroExtension,
  createStatefulPomodoroExtension,
  PomodoroManager,
  createPomodoroManager,
  VALID_SESSION_DURATIONS,
  VALID_BREAK_DURATIONS,
} from "./extensions/pomodoro/index.js";
export type {
  SessionDuration,
  BreakDuration,
  StartPomodoroArgs,
  PausePomodoroArgs,
  ResetPomodoroArgs,
  GetPomodoroStateArgs,
  PomodoroStateData,
  PomodoroState,
  PomodoroPhase,
  PomodoroEvent,
  PomodoroEventCallback,
  PomodoroToolHandler,
  PomodoroExtensionOptions,
  StatefulPomodoroExtensionOptions,
} from "./extensions/pomodoro/index.js";

// Tasks extension
export {
  createTaskExtension,
  createStatefulTaskExtension,
  TaskManager,
  createTaskManager,
  VALID_TASK_STATUSES,
} from "./extensions/tasks/index.js";
export type {
  TaskStatus,
  AddTaskArgs,
  UpdateTaskStatusArgs,
  SetActiveTaskArgs,
  RemoveTaskArgs,
  CompleteActiveTaskArgs,
  ClearCompletedTasksArgs,
  ClearAllTasksArgs,
  ListTasksArgs,
  Task,
  TaskState,
  TaskEvent,
  TaskEventCallback,
  TaskToolHandler,
  TaskExtensionOptions,
  StatefulTaskExtensionOptions,
} from "./extensions/tasks/index.js";

// Spotify extension
export {
  createSpotifyExtension,
  createStatefulSpotifyExtension,
  SpotifyManager,
  createSpotifyManager,
  EMPTY_PLAYBACK_STATE,
  INITIAL_SPOTIFY_STATE,
} from "./extensions/spotify/index.js";
export type {
  SpotifyImage,
  SpotifyArtist,
  SpotifyAlbum,
  SpotifyTrack,
  SpotifyDevice,
  SpotifyPlaybackState,
  SpotifyPlaylist,
  SpotifySearchResults,
  SpotifyTokens,
  SpotifyConnectionStatus,
  SpotifyState,
  SpotifyEventType,
  SpotifyEvent,
  SpotifyEventCallback,
  PlaySpotifyArgs,
  PauseSpotifyArgs,
  SearchSpotifyArgs,
  GetSpotifyPlaybackArgs,
  SkipSpotifyArgs,
  SpotifyToolHandler,
  SpotifyToolResult,
  SpotifyExtensionOptions,
  StatefulSpotifyExtensionOptions,
  SpotifyManagerConfig,
} from "./extensions/spotify/index.js";

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
  useExtensionSlots,

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

export { createElectronHostBridge } from "./ui/index.js";
export type { ExtensionHostBridge, ElectronHostAPI } from "./ui/index.js";

// Task UI (requires React)
export { createTaskUISlot } from "./extensions/tasks/ui.js";
export type { TaskUISlotOptions } from "./extensions/tasks/ui.js";

// Pomodoro UI (requires React)
export { createPomodoroUISlot } from "./extensions/pomodoro/ui.js";
export type { PomodoroUISlotOptions } from "./extensions/pomodoro/ui.js";

// Spotify UI (requires React)
export { createSpotifyUISlot, SpotifyPanelComponent } from "./extensions/spotify/ui.js";
export type {
  SpotifyUISlotOptions,
  SpotifyPlaybackControls,
  SpotifySetupActions,
} from "./extensions/spotify/ui.js";

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
