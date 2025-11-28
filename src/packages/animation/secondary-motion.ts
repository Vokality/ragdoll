import * as THREE from 'three';
import type { SpringConfig, SpringState } from './spring';
import { createSpringState, updateSpring } from './spring';

/**
 * Secondary motion adds life to animation through:
 * - Follow-through: parts continue moving after main action stops
 * - Overlapping action: different parts move at different rates
 * - Drag: extremities lag behind the main body
 */

/**
 * Configuration for secondary motion on a joint
 */
export interface SecondaryMotionConfig {
  /** How much this joint lags behind (0 = no lag, 1 = maximum lag) */
  drag: number;
  /** How much overshoot when stopping (0 = none, 1 = significant) */
  overshoot: number;
  /** Phase offset for overlapping action (in radians) */
  phaseOffset: number;
  /** Amplitude multiplier for secondary oscillation */
  amplitude: number;
}

/**
 * Preset secondary motion configs for body parts
 */
export const SecondaryMotionPresets: Record<string, SecondaryMotionConfig> = {
  // Head has significant drag and bob
  neck: { drag: 0.5, overshoot: 0.3, phaseOffset: 0.25, amplitude: 0.65 },

  // Arms swing with phase offset from legs
  leftShoulder: { drag: 0.25, overshoot: 0.2, phaseOffset: Math.PI, amplitude: 0.45 },
  rightShoulder: { drag: 0.25, overshoot: 0.2, phaseOffset: 0, amplitude: 0.45 },

  // Elbows/wrists have more follow-through
  leftElbow: { drag: 0.5, overshoot: 0.35, phaseOffset: Math.PI + 0.35, amplitude: 0.4 },
  rightElbow: { drag: 0.5, overshoot: 0.35, phaseOffset: 0.35, amplitude: 0.4 },
  leftWrist: { drag: 0.65, overshoot: 0.45, phaseOffset: Math.PI + 0.8, amplitude: 0.35 },
  rightWrist: { drag: 0.65, overshoot: 0.45, phaseOffset: 0.8, amplitude: 0.35 },

  // Core is stable with minimal secondary motion
  spine: { drag: 0.15, overshoot: 0.1, phaseOffset: 0, amplitude: 0.25 },

  // Legs drive the motion, less secondary effect
  leftHip: { drag: 0.08, overshoot: 0.08, phaseOffset: 0, amplitude: 0.16 },
  rightHip: { drag: 0.08, overshoot: 0.08, phaseOffset: Math.PI, amplitude: 0.16 },
  leftKnee: { drag: 0.2, overshoot: 0.18, phaseOffset: 0.25, amplitude: 0.24 },
  rightKnee: { drag: 0.2, overshoot: 0.18, phaseOffset: Math.PI + 0.25, amplitude: 0.24 },
  leftAnkle: { drag: 0.3, overshoot: 0.2, phaseOffset: 0.35, amplitude: 0.18 },
  rightAnkle: { drag: 0.3, overshoot: 0.2, phaseOffset: Math.PI + 0.35, amplitude: 0.18 },

  // Default
  default: { drag: 0.2, overshoot: 0.15, phaseOffset: 0, amplitude: 0.3 },
};

/**
 * Get secondary motion preset for a joint
 */
export function getSecondaryMotionPreset(
  jointName: string
): SecondaryMotionConfig {
  return SecondaryMotionPresets[jointName] ?? SecondaryMotionPresets.default;
}

/**
 * Tracks secondary motion state for smooth transitions
 */
export interface SecondaryMotionState {
  springState: SpringState;
  lastVelocity: THREE.Vector3;
  accumulatedPhase: number;
}

/**
 * Create secondary motion state
 */
export function createSecondaryMotionState(): SecondaryMotionState {
  return {
    springState: createSpringState(),
    lastVelocity: new THREE.Vector3(),
    accumulatedPhase: 0,
  };
}

/**
 * Apply secondary motion to a rotation
 * Adds drag, overshoot, and overlapping action effects
 */
export function applySecondaryMotion(
  baseRotation: THREE.Vector3,
  state: SecondaryMotionState,
  config: SecondaryMotionConfig,
  springConfig: SpringConfig,
  walkCycle: number,
  isMoving: boolean,
  deltaTime: number
): THREE.Vector3 {
  // Update accumulated phase with drag
  const targetPhase = walkCycle + config.phaseOffset;
  state.accumulatedPhase +=
    (targetPhase - state.accumulatedPhase) * (1 - config.drag) * deltaTime * 10;

  // Calculate secondary oscillation (follow-through wobble)
  const secondaryOscillation = new THREE.Vector3(
    Math.sin(state.accumulatedPhase * 2) * config.amplitude * 0.18,
    Math.cos(state.accumulatedPhase * 3) * config.amplitude * 0.1,
    Math.sin(state.accumulatedPhase * 2.5) * config.amplitude * 0.14
  );

  // Apply drag to the base rotation
  const targetRotation = baseRotation.clone();

  if (isMoving) {
    // Add secondary oscillation when moving
    targetRotation.add(secondaryOscillation);
  }

  // Update spring state for smooth interpolation
  state.springState.target.copy(targetRotation);
  updateSpring(state.springState, springConfig, deltaTime);

  // Calculate velocity for overshoot detection
  const currentVelocity = new THREE.Vector3().subVectors(
    state.springState.current,
    state.springState.target
  );

  // Apply overshoot when decelerating
  if (!isMoving && state.lastVelocity.length() > currentVelocity.length()) {
    const overshootAmount = state.lastVelocity
      .clone()
      .multiplyScalar(config.overshoot * 0.8);
    state.springState.current.add(overshootAmount);
  }

  state.lastVelocity.copy(currentVelocity);

  return state.springState.current.clone();
}

/**
 * Calculate follow-through effect for stopping motion
 * Returns additional rotation to apply during deceleration
 */
export function calculateFollowThrough(
  velocity: THREE.Vector3,
  mass: number,
  deltaTime: number
): THREE.Vector3 {
  // Follow-through is proportional to velocity and mass
  const followThrough = velocity.clone().multiplyScalar(mass * deltaTime * 2);

  // Apply decay
  followThrough.multiplyScalar(0.95);

  return followThrough;
}

/**
 * Calculate overlapping action offset for a joint
 * Different body parts move at different times for organic feel
 */
export function calculateOverlapOffset(
  walkCycle: number,
  jointConfig: SecondaryMotionConfig
): number {
  // Apply phase offset and drag for overlapping action
  const delayedPhase = walkCycle - jointConfig.phaseOffset * jointConfig.drag;
  return delayedPhase;
}

/**
 * Add micro-movements for life-like animation
 * Small procedural movements that prevent static poses
 */
export function addBreathingMotion(
  time: number,
  intensity: number = 0.02
): THREE.Vector3 {
  // Breathing cycle (slower than walk)
  const breathCycle = time * 0.5;

  return new THREE.Vector3(
    Math.sin(breathCycle) * intensity * 0.5, // Slight forward lean
    0,
    Math.sin(breathCycle * 0.7) * intensity * 0.3 // Subtle side sway
  );
}

/**
 * Add idle sway motion when character is standing still
 */
export function addIdleSway(time: number, intensity: number = 0.03): THREE.Vector3 {
  // Multiple overlapping sine waves for organic idle
  const sway1 = Math.sin(time * 0.3) * intensity;
  const sway2 = Math.sin(time * 0.5 + 1.2) * intensity * 0.5;
  const sway3 = Math.sin(time * 0.2 + 2.4) * intensity * 0.3;

  return new THREE.Vector3(
    sway1 + sway3 * 0.5, // Forward/back
    sway2 * 0.3, // Twist
    sway1 * 0.7 + sway2 // Side sway
  );
}

