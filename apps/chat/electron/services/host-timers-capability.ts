import type { HostTimersCapability } from "@vokality/ragdoll-extensions";

export function createHostTimersCapability(): HostTimersCapability {
  const timers = new Map<symbol, ReturnType<typeof setTimeout>>();
  const clear = (handle: unknown): void => {
    if (typeof handle !== "symbol") return;
    const timer = timers.get(handle);
    if (!timer) return;
    clearTimeout(timer);
    timers.delete(handle);
  };
  return {
    setTimeout(callback, delayMs) {
      const handle = Symbol("timeout");
      const timer = setTimeout(() => {
        timers.delete(handle);
        callback();
      }, delayMs);
      timers.set(handle, timer);
      return handle;
    },
    clearTimeout: clear,
    setInterval(callback, intervalMs) {
      const handle = Symbol("interval");
      timers.set(handle, setInterval(callback, intervalMs));
      return handle;
    },
    clearInterval: clear,
  };
}
