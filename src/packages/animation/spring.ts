import * as THREE from "three";

/**
 * Spring physics configuration for natural motion
 */
export interface SpringConfig {
  /** Stiffness - higher = snappier response (0.1 - 1.0 typical) */
  stiffness: number;
  /** Damping - higher = less bounce (0.1 - 1.0 typical) */
  damping: number;
  /** Mass - higher = more momentum/inertia */
  mass: number;
}

/**
 * Preset spring configurations for different body parts
 */
export const SpringPresets: Record<string, SpringConfig> = {
  // Core body - stable but snappy
  spine: { stiffness: 0.85, damping: 0.6, mass: 0.9 },
  hip: { stiffness: 0.85, damping: 0.6, mass: 0.9 },

  // Limbs - responsive with controlled bounce
  shoulder: { stiffness: 0.75, damping: 0.55, mass: 0.8 },
  elbow: { stiffness: 0.65, damping: 0.5, mass: 0.6 },
  wrist: { stiffness: 0.6, damping: 0.4, mass: 0.45 },

  knee: { stiffness: 0.75, damping: 0.6, mass: 0.7 },
  ankle: { stiffness: 0.7, damping: 0.55, mass: 0.55 },

  // Head/neck - loose and expressive
  neck: { stiffness: 0.55, damping: 0.45, mass: 0.5 },

  // Default for unknown joints
  default: { stiffness: 0.65, damping: 0.6, mass: 1.0 },
};

/**
 * Get spring preset for a joint name
 */
export function getSpringPreset(jointName: string): SpringConfig {
  // Match joint name to preset
  const lowerName = jointName.toLowerCase();

  if (lowerName.includes("spine")) return SpringPresets.spine;
  if (lowerName.includes("hip")) return SpringPresets.hip;
  if (lowerName.includes("shoulder")) return SpringPresets.shoulder;
  if (lowerName.includes("elbow")) return SpringPresets.elbow;
  if (lowerName.includes("wrist")) return SpringPresets.wrist;
  if (lowerName.includes("knee")) return SpringPresets.knee;
  if (lowerName.includes("ankle")) return SpringPresets.ankle;
  if (lowerName.includes("neck")) return SpringPresets.neck;

  return SpringPresets.default;
}

/**
 * Spring state for tracking velocity and position
 */
export interface SpringState {
  current: THREE.Vector3;
  velocity: THREE.Vector3;
  target: THREE.Vector3;
}

/**
 * Create initial spring state
 */
export function createSpringState(initial?: THREE.Vector3): SpringState {
  return {
    current: initial?.clone() ?? new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    target: initial?.clone() ?? new THREE.Vector3(),
  };
}

/**
 * Update spring physics for a single frame
 * Uses critically damped spring for smooth, non-oscillating motion
 */
export function updateSpring(
  state: SpringState,
  config: SpringConfig,
  deltaTime: number,
): void {
  // Clamp delta time to prevent instability
  const dt = Math.min(deltaTime, 0.05);

  // Calculate spring force: F = -k * (x - target)
  const displacement = new THREE.Vector3().subVectors(
    state.current,
    state.target,
  );

  // Spring force
  const springForce = displacement.clone().multiplyScalar(-config.stiffness);

  // Damping force: F = -c * velocity
  const dampingForce = state.velocity.clone().multiplyScalar(-config.damping);

  // Total acceleration: a = F / m
  const acceleration = new THREE.Vector3()
    .addVectors(springForce, dampingForce)
    .divideScalar(config.mass);

  // Semi-implicit Euler integration for stability
  state.velocity.add(acceleration.multiplyScalar(dt * 60)); // 60fps normalized
  state.current.add(state.velocity.clone().multiplyScalar(dt));

  // Snap to target if very close (prevents micro-oscillations)
  if (displacement.length() < 0.0001 && state.velocity.length() < 0.0001) {
    state.current.copy(state.target);
    state.velocity.set(0, 0, 0);
  }
}

/**
 * Scalar spring state for single values
 */
export interface ScalarSpringState {
  current: number;
  velocity: number;
  target: number;
}

/**
 * Create scalar spring state
 */
export function createScalarSpringState(
  initial: number = 0,
): ScalarSpringState {
  return {
    current: initial,
    velocity: 0,
    target: initial,
  };
}

/**
 * Update scalar spring physics
 */
export function updateScalarSpring(
  state: ScalarSpringState,
  config: SpringConfig,
  deltaTime: number,
): void {
  const dt = Math.min(deltaTime, 0.05);

  const displacement = state.current - state.target;
  const springForce = -config.stiffness * displacement;
  const dampingForce = -config.damping * state.velocity;
  const acceleration = (springForce + dampingForce) / config.mass;

  state.velocity += acceleration * dt * 60;
  state.current += state.velocity * dt;

  if (Math.abs(displacement) < 0.0001 && Math.abs(state.velocity) < 0.0001) {
    state.current = state.target;
    state.velocity = 0;
  }
}

/**
 * Critically damped spring - smooth without oscillation
 * Best for character animation where you want organic but controlled motion
 */
export function criticallyDampedSpring(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  deltaTime: number,
): { value: number; velocity: number } {
  // Based on Game Programming Gems 4 critically damped spring
  const omega = 2 / smoothTime;
  const x = omega * deltaTime;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

  const change = current - target;
  const temp = (velocity + omega * change) * deltaTime;

  const newVelocity = (velocity - omega * temp) * exp;
  const newValue = target + (change + temp) * exp;

  return { value: newValue, velocity: newVelocity };
}

/**
 * Vector3 critically damped spring
 */
export function criticallyDampedSpringVec3(
  current: THREE.Vector3,
  target: THREE.Vector3,
  velocity: THREE.Vector3,
  smoothTime: number,
  deltaTime: number,
): { value: THREE.Vector3; velocity: THREE.Vector3 } {
  const resultX = criticallyDampedSpring(
    current.x,
    target.x,
    velocity.x,
    smoothTime,
    deltaTime,
  );
  const resultY = criticallyDampedSpring(
    current.y,
    target.y,
    velocity.y,
    smoothTime,
    deltaTime,
  );
  const resultZ = criticallyDampedSpring(
    current.z,
    target.z,
    velocity.z,
    smoothTime,
    deltaTime,
  );

  return {
    value: new THREE.Vector3(resultX.value, resultY.value, resultZ.value),
    velocity: new THREE.Vector3(
      resultX.velocity,
      resultY.velocity,
      resultZ.velocity,
    ),
  };
}
