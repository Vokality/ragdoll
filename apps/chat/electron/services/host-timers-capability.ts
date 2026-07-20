import type { HostTimersCapability } from "@vokality/ragdoll-extensions";

export function createHostTimersCapability(): HostTimersCapability {
  return {
    setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimeout: (handle) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>),
    setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
    clearInterval: (handle) =>
      clearInterval(handle as ReturnType<typeof setInterval>),
  };
}
