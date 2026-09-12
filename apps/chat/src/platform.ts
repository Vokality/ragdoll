/** Host platform helpers for renderer copy and chrome that should follow the OS. */

export function isApplePlatform(
  userAgent = globalThis.navigator?.userAgent ?? "",
): boolean {
  return /Mac OS X|Macintosh/.test(userAgent);
}

export function composerFocusShortcutLabel(
  userAgent = globalThis.navigator?.userAgent ?? "",
): string {
  return isApplePlatform(userAgent) ? "⌘K" : "Ctrl+K";
}
