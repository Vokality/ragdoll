// Components
export { RagdollCharacter } from "./components/ragdoll-character";
export { PomodoroTimer } from "./components/pomodoro-timer";
export { TaskDrawer } from "./components/task-drawer";

// Controllers
export { CharacterController } from "./controllers/character-controller";
export { ActionController } from "./controllers/action-controller";
export { ExpressionController } from "./controllers/expression-controller";
export { HeadPoseController } from "./controllers/head-pose-controller";
export { IdleController } from "./controllers/idle-controller";
export { PomodoroController } from "./controllers/pomodoro-controller";
export { TaskController } from "./controllers/task-controller";

// Controller Interfaces
export type { IHeadPoseController } from "./controllers/interfaces";

// State Management
export { StateManager } from "./state/state-manager";
export { EventBus } from "./state/event-bus";
export type { StateEvent, EventSubscriber, StateSnapshot } from "./state/types";

// Models
export { RagdollGeometry } from "./models/ragdoll-geometry";
export { RagdollSkeleton } from "./models/ragdoll-skeleton";

// Themes
export {
  getTheme,
  getDefaultTheme,
  getAllThemes,
  registerTheme,
} from "./themes";
export {
  defaultTheme,
  robotTheme,
  alienTheme,
  monochromeTheme,
} from "./themes/default-themes";
export type {
  RagdollTheme,
  ThemeColors,
  GradientDef,
  GradientStop,
} from "./themes/types";

// Types
export type {
  CharacterState,
  FacialCommand,
  FacialMood,
  FacialAction,
  FacialStatePayload,
  SpeechBubblePayload,
  SpeechBubbleState,
  JointCommand,
  JointName,
  HeadPose,
  Vector3Like,
  PomodoroState,
  PomodoroDuration,
  PomodoroStateData,
  TaskStatus,
  Task,
  TaskState,
} from "./types";

// Animation utilities (only the pure functions that don't depend on three.js)
export * from "./animation/easing";

// Plugins
export type { FeaturePlugin } from "./plugins/plugin-interface";
export { PomodoroPlugin } from "./plugins/pomodoro-plugin";
export { TaskPlugin } from "./plugins/task-plugin";
