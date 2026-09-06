import { useCallback, useRef, useState } from "react";

/** Keeps a user action pending until it settles and exposes failures for retry. */
export function usePanelAction() {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const run = useCallback(
    async (action: (() => void | Promise<void>) | undefined) => {
      if (!action || inFlight.current) return;
      inFlight.current = true;
      setPending(true);
      setError("");
      try {
        await action();
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [],
  );
  return { run, pending, error };
}
