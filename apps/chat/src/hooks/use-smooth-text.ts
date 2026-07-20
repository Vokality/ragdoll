import { useEffect, useRef, useState } from "react";

/** Floor speed so the reveal always reads as motion, never a crawl. */
const MIN_CHARS_PER_SECOND = 40;
/** How quickly the reveal closes the gap to the live buffer. */
const CATCH_UP_SECONDS = 0.6;

interface RevealState {
  key: string | number;
  count: number;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Reveals `target` progressively so streamed text reads as one steady
 * typewriter instead of network-paced bursts, and keeps draining after the
 * stream closes so short replies don't pop in abruptly.
 *
 * `resetKey` identifies the message being revealed: when it changes, the
 * reveal restarts from zero if `live`, or snaps to the full text if not
 * (e.g. restored history).
 */
export function useSmoothText(
  target: string,
  resetKey: string | number,
  live: boolean,
): string {
  const [state, setState] = useState<RevealState>(() => ({
    key: resetKey,
    count: live ? 0 : target.length,
  }));
  const fractionRef = useRef(0);

  // Adjust state when the tracked message changes (React's documented
  // "derive state during render" pattern — no effect round-trip flash).
  if (state.key !== resetKey) {
    fractionRef.current = 0;
    setState({ key: resetKey, count: live ? 0 : target.length });
  } else if (state.count > target.length) {
    // Target shrank (cleared or replaced) — never index past the end.
    setState({ key: resetKey, count: target.length });
  }

  const isCaughtUp = state.count >= target.length;

  useEffect(() => {
    if (isCaughtUp) return;

    if (prefersReducedMotion()) {
      setState({ key: resetKey, count: target.length });
      return;
    }

    let frame = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      setState((current) => {
        const backlog = target.length - current.count;
        if (backlog <= 0) return current;

        const speed = Math.max(
          MIN_CHARS_PER_SECOND,
          backlog / CATCH_UP_SECONDS,
        );
        fractionRef.current += speed * dt;
        const advance = Math.floor(fractionRef.current);
        if (advance <= 0) return current;

        fractionRef.current -= advance;
        return {
          key: current.key,
          count: Math.min(target.length, current.count + advance),
        };
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, resetKey, isCaughtUp]);

  return target.slice(0, state.count);
}
