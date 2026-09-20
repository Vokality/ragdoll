const TARGET_FRAME_SECONDS = 1 / 60;
// requestAnimationFrame deltas jitter around the display interval. Without
// slack, a 60Hz frame that arrives a fraction early is skipped and the
// character stutters at half rate.
const FRAME_JITTER_SECONDS = 0.002;
const MAX_FRAME_SECONDS = 0.05;

/**
 * Seconds to simulate for an animation frame, or null when the frame arrived
 * too soon after the last simulated one (displays faster than 60Hz).
 */
export function frameDeltaSeconds(
  nowMs: number,
  lastFrameMs: number,
): number | null {
  const elapsed = (nowMs - lastFrameMs) / 1000;
  if (elapsed < TARGET_FRAME_SECONDS - FRAME_JITTER_SECONDS) return null;
  return Math.min(elapsed, MAX_FRAME_SECONDS);
}
