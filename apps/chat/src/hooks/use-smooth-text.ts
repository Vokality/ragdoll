import { useEffect, useState, useSyncExternalStore } from "react";

/** Floor speed so the reveal always reads as motion, never a crawl. */
const MIN_CHARS_PER_SECOND = 40;
/** How quickly the reveal closes the gap to the live buffer. */
const CATCH_UP_SECONDS = 0.6;

interface RevealState {
  key: string | number;
  count: number;
  fraction: number;
}

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
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
  const reducedMotion = usePrefersReducedMotion();
  const shouldAnimate = live && !reducedMotion;
  const [state, setState] = useState<RevealState>(() => ({
    key: resetKey,
    count: shouldAnimate ? 0 : target.length,
    fraction: 0,
  }));

  // Adjust state when the tracked message or motion preference changes
  // (React's documented "adjust state during render" pattern).
  if (state.key !== resetKey) {
    setState({
      key: resetKey,
      count: shouldAnimate ? 0 : target.length,
      fraction: 0,
    });
  } else if (state.count > target.length) {
    setState({ key: resetKey, count: target.length, fraction: 0 });
  } else if (reducedMotion && state.count < target.length) {
    setState({ key: resetKey, count: target.length, fraction: 0 });
  }

  const revealCount =
    state.key === resetKey
      ? Math.min(state.count, target.length)
      : shouldAnimate
        ? 0
        : target.length;
  const isCaughtUp = revealCount >= target.length;

  useEffect(() => {
    if (reducedMotion || isCaughtUp) return;

    let frame = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      setState((current) => {
        if (current.key !== resetKey) return current;
        const backlog = target.length - current.count;
        if (backlog <= 0) return current;

        const speed = Math.max(
          MIN_CHARS_PER_SECOND,
          backlog / CATCH_UP_SECONDS,
        );
        const fraction = current.fraction + speed * dt;
        const advance = Math.floor(fraction);
        return {
          key: current.key,
          count: Math.min(target.length, current.count + advance),
          fraction: fraction - advance,
        };
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, resetKey, isCaughtUp, reducedMotion]);

  return target.slice(0, revealCount);
}
