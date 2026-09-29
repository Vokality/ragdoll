/**
 * Easing curves shared by the controllers. Inputs are clamped to [0, 1].
 */

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

export function easeInQuad(t: number): number {
  const c = clamp01(t);
  return c * c;
}

export function easeOutQuad(t: number): number {
  const c = clamp01(t);
  return 1 - (1 - c) * (1 - c);
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 3);
}

export function easeInOutCubic(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

export function smoothStep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}
