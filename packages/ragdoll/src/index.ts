// Components
export { RagdollCharacter } from "./components/ragdoll-character";

// Controllers
export { CharacterController } from "./controllers/character-controller";
export { ExpressionController } from "./controllers/expression-controller";
export { HeadPoseController } from "./controllers/head-pose-controller";
export { IdleController } from "./controllers/idle-controller";

// Models
export { RagdollGeometry } from "./models/ragdoll-geometry";
export { RagdollSkeleton } from "./models/ragdoll-skeleton";

// Themes
export { getTheme, getDefaultTheme, getAllThemes, registerTheme } from "./themes";
export { defaultTheme, robotTheme, alienTheme, monochromeTheme } from "./themes/default-themes";
export type { RagdollTheme, ThemeColors, GradientDef, GradientStop } from "./themes/types";

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
} from "./types";

// Animation utilities (only the pure functions that don't depend on three.js)
export * from "./animation/easing";
