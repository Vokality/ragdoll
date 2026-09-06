import type { WebContents } from "electron";

/** Renderer delivery is optional once its owning window has been closed. */
export function sendRendererEvent(
  contents: Pick<WebContents, "isDestroyed" | "send">,
  channel: string,
  ...args: unknown[]
): void {
  if (!contents.isDestroyed()) contents.send(channel, ...args);
}
