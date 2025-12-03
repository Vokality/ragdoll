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
  RagdollExtension,

  // Registry types
  RegistryEventType,
  RegistryEvent,
  RegistryEventCallback,
  RegisterOptions,

  // Factory types
  ExtensionConfig,

  // Notification types
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

// Tasks extension (without UI)
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

// Spotify extension (without UI)
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
