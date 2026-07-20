import { useCallback, useEffect, useRef, useState } from "react";

const CONFIRM_WINDOW_MS = 4000;

/**
 * Two-step confirmation that automatically disarms after a few seconds,
 * so a destructive button never stays armed indefinitely.
 */
export function useTimedConfirm(windowMs: number = CONFIRM_WINDOW_MS) {
  const [isArmed, setIsArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const arm = useCallback(() => {
    clearTimer();
    setIsArmed(true);
    timerRef.current = setTimeout(() => setIsArmed(false), windowMs);
  }, [clearTimer, windowMs]);

  const disarm = useCallback(() => {
    clearTimer();
    setIsArmed(false);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return { isArmed, arm, disarm };
}
