/**
 * Pixar-style easing functions for organic animation
 * These curves add anticipation, overshoot, and natural feel to motion
 */

export type EasingFunction = (t: number) => number;

/**
 * Standard easing functions
 */
export const easeInQuad: EasingFunction = (t) => t * t;
export const easeOutQuad: EasingFunction = (t) => t * (2 - t);
export const easeInOutQuad: EasingFunction = (t) =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

export const easeInCubic: EasingFunction = (t) => t * t * t;
export const easeOutCubic: EasingFunction = (t) => --t * t * t + 1;
export const easeInOutCubic: EasingFunction = (t) =>
  t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

/**
 * Anticipation easing - slight pullback before moving forward
 * Great for character wind-ups and jumps
 */
export const easeInBack: EasingFunction = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
};

export const easeOutBack: EasingFunction = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const easeInOutBack: EasingFunction = (t) => {
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
};

/**
 * Elastic easing - bouncy overshoot like a spring
 * Perfect for snappy character reactions
 */
export const easeOutElastic: EasingFunction = (t) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

export const easeInElastic: EasingFunction = (t) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
      ? 1
      : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
};

export const easeInOutElastic: EasingFunction = (t) => {
  const c5 = (2 * Math.PI) / 4.5;
  return t === 0
    ? 0
    : t === 1
      ? 1
      : t < 0.5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 +
          1;
};

/**
 * Bounce easing - natural bouncing motion
 * Good for landing and settling effects
 */
export const easeOutBounce: EasingFunction = (t) => {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
};

export const easeInBounce: EasingFunction = (t) => 1 - easeOutBounce(1 - t);

/**
 * Smooth step - very smooth S-curve, great for organic motion
 */
export const smoothStep: EasingFunction = (t) => t * t * (3 - 2 * t);
export const smootherStep: EasingFunction = (t) =>
  t * t * t * (t * (t * 6 - 15) + 10);

/**
 * Walk cycle specific easing - shapes sine waves for natural leg motion
 * Adds quick lift-off and slow settle for foot plants
 */
export function shapeWalkCycle(phase: number): number {
  // Create asymmetric wave: fast up, slow down (like a real step)
  const normalized = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const t = normalized / (Math.PI * 2);

  // Bias toward quick lift, slow plant
  if (t < 0.3) {
    // Quick lift phase
    return easeOutCubic(t / 0.3);
  } else if (t < 0.5) {
    // Peak hold
    return 1;
  } else if (t < 0.8) {
    // Slow descend
    return 1 - easeInQuad((t - 0.5) / 0.3);
  } else {
    // Ground contact
    return 0;
  }
}

/**
 * Creates a shaped sine wave with easing for organic oscillation
 */
export function organicSine(phase: number, sharpness: number = 0.5): number {
  const rawSine = Math.sin(phase);
  const sign = Math.sign(rawSine);
  const magnitude = Math.abs(rawSine);

  // Apply power curve to shape the wave
  const shaped = Math.pow(magnitude, 1 - sharpness * 0.5);
  return sign * shaped;
}

/**
 * Anticipation curve - pulls back before going forward
 */
export function anticipate(
  t: number,
  anticipationAmount: number = 0.2,
): number {
  if (t < anticipationAmount) {
    // Pull back phase
    const pullT = t / anticipationAmount;
    return -easeOutQuad(pullT) * anticipationAmount;
  } else {
    // Forward phase
    const forwardT = (t - anticipationAmount) / (1 - anticipationAmount);
    return easeOutCubic(forwardT);
  }
}

/**
 * Overshoot curve - goes past target then settles
 */
export function overshoot(t: number, overshootAmount: number = 0.1): number {
  if (t < 0.7) {
    // Move to overshoot position
    return easeOutQuad(t / 0.7) * (1 + overshootAmount);
  } else {
    // Settle back to target
    const settleT = (t - 0.7) / 0.3;
    return 1 + overshootAmount - overshootAmount * easeInOutCubic(settleT);
  }
}
