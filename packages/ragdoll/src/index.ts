// Components
export { RagdollCharacter } from "./components/ragdoll-character";

// Controllers
export { CharacterController } from "./controllers/character-controller";
export { ActionController } from "./controllers/action-controller";
export { ExpressionController } from "./controllers/expression-controller";
export { HeadPoseController } from "./controllers/head-pose-controller";
export { IdleController } from "./controllers/idle-controller";

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

// Variants
export {
  getVariant,
  getDefaultVariant,
  getAllVariants,
  getVariantIds,
  registerVariant,
} from "./variants";
export { humanVariant } from "./variants/human";
export { einsteinVariant } from "./variants/einstein";
export type {
  CharacterVariant,
  DimensionOverrides,
  ColorOverrides,
  HairStyle,
  MustacheStyle,
} from "./variants/types";

// Types
export type {
  CharacterState,
  FacialCommand,
  FacialMood,
  FacialAction,
  FacialStatePayload,
  JointCommand,
  JointName,
  HeadPose,
  Vector3Like,
} from "./types";

// Animation utilities (only the pure functions that don't depend on three.js)
export * from "./animation/easing";

// Plugins
export type { FeaturePlugin } from "./plugins/plugin-interface";
