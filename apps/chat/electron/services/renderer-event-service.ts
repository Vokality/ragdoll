import type { BrowserWindow } from "electron";
import type { OAuthEvent, SlotChangeEvent } from "../electron-api.js";

export class RendererEventService {
  private window: BrowserWindow | null = null;

  attach(window: BrowserWindow): void {
    this.window = window;
  }

  detach(window: BrowserWindow): void {
    if (this.window === window) this.window = null;
  }

  functionCall(name: string, args: Record<string, unknown>): void {
    this.send("chat:function-call", name, args);
  }

  slotChanged(event: SlotChangeEvent): void {
    this.send("extension-slot:changed", event);
  }

  slotsChanged(): void {
    this.send("extension-slots:changed");
  }

  oauthSucceeded(event: OAuthEvent): void {
    this.send("oauth:success", event);
  }

  oauthFailed(event: OAuthEvent): void {
    this.send("oauth:error", event);
  }

  focus(): void {
    const window = this.getLiveWindow();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  }

  private send(channel: string, ...args: unknown[]): void {
    this.getLiveWindow()?.webContents.send(channel, ...args);
  }

  private getLiveWindow(): BrowserWindow | null {
    if (!this.window || this.window.isDestroyed()) return null;
    return this.window;
  }
}
