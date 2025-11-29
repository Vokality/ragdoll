/**
 * Main package exports
 * Provides access to all ragdoll framework components
 */

// Character domain
export * from "./character/types";
export { RagdollSkeleton } from "./character/models/ragdoll-skeleton";
export { RagdollGeometry } from "./character/models/ragdoll-geometry";
export { ExpressionController } from "./character/controllers/expression-controller";
export { HeadPoseController } from "./character/controllers/head-pose-controller";
export { CharacterController } from "./character/controllers/character-controller";
export { RagdollCharacter } from "./character/components/ragdoll-character";

// UI domain
export { ControlPanel } from "./ui/components/control-panel";
export { Scene } from "./ui/components/scene";

// Animation utilities
export * from "./animation";

// Note: API server and MCP server are server-side only and should be imported separately
// import { RagdollAPIServer } from './packages/api/server'; (Node.js only)
// import { RagdollMCPServer } from './packages/mcp/ragdoll-mcp-server'; (Node.js only)
