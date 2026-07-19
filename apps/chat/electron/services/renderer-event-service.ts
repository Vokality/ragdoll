import type { BrowserWindow } from "electron";
import type {
  ChatMessageDto,
  OAuthConnectedEvent,
  OAuthFailedEvent,
  SlotChangeEvent,
} from "../electron-api.js";
import { EXTENSION_EVENT_CHANNELS } from "../electron-api.js";

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

  conversationChanged(conversation: ChatMessageDto[]): void {
    this.send("chat:conversation-changed", conversation);
  }

  slotStateChanged(event: SlotChangeEvent): void {
    this.send(EXTENSION_EVENT_CHANNELS.slotStateChanged, event);
  }

  slotsChanged(): void {
    this.send(EXTENSION_EVENT_CHANNELS.slotsChanged);
  }

  oauthConnected(event: OAuthConnectedEvent): void {
    this.send(EXTENSION_EVENT_CHANNELS.oauthConnected, event);
  }

  oauthFailed(event: OAuthFailedEvent): void {
    this.send(EXTENSION_EVENT_CHANNELS.oauthFailed, event);
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
