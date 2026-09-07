import { citedResponse } from "../../electron/electron-api";
import type { ChatMessage } from "../domain/chat";
import { getVisibleMessages } from "../domain/chat";
import type { ChatSettings } from "../domain/settings";
import type { ChatGateway, ChatSendResult } from "./ports/chat-gateway";
import type {
  CharacterThemeId,
  CharacterVariantId,
} from "../../electron/electron-api";

/** How much history the conversation view keeps scrollable. */
const VISIBLE_MESSAGE_LIMIT = 100;

export interface ChatSnapshot {
  settings: ChatSettings;
  visibleMessages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
}

export class ChatService {
  private messages: ChatMessage[] = [];
  private streamingContent = "";
  private conversationVersion = 0;
  private readonly settingsVersions: Record<keyof ChatSettings, number> = {
    theme: 0,
    variant: 0,
  };
  private lifecycleVersion = 0;
  private snapshot: ChatSnapshot;
  private readonly listeners = new Set<() => void>();
  private unsubscribeStreaming: (() => void) | null = null;
  private startPromise: Promise<void> | null = null;
  private activeSend: symbol | null = null;

  constructor(
    private readonly gateway: ChatGateway,
    initialSettings: ChatSettings,
  ) {
    this.snapshot = {
      settings: initialSettings,
      visibleMessages: [],
      isStreaming: false,
      isLoading: false,
      error: null,
    };
  }

  readonly getSnapshot = (): ChatSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(): Promise<void> {
    if (this.startPromise) return this.startPromise;

    const lifecycleVersion = ++this.lifecycleVersion;
    this.unsubscribeStreaming = this.gateway.subscribeToStreaming({
      onText: (text) => {
        if (this.lifecycleVersion !== lifecycleVersion) return;
        this.streamingContent += text;
        this.publish();
      },
      onStreamEnd: () => {
        if (this.lifecycleVersion === lifecycleVersion) this.finishStream();
      },
      onConversationChanged: (conversation) => {
        if (this.lifecycleVersion !== lifecycleVersion) return;
        this.conversationVersion += 1;
        this.messages = conversation;
        this.dropStreamingContentIfPersisted();
        this.publish();
      },
    });
    this.startPromise = this.hydrate(lifecycleVersion).catch(
      (error: unknown) => {
        if (this.lifecycleVersion === lifecycleVersion) this.reportError(error);
      },
    );
    return this.startPromise;
  }

  stop(): void {
    this.lifecycleVersion += 1;
    this.unsubscribeStreaming?.();
    this.unsubscribeStreaming = null;
    this.startPromise = null;
  }

  readonly sendMessage = async (message: string): Promise<ChatSendResult> => {
    const trimmed = message.trim();
    if (!trimmed) return { success: false, error: "Message is empty" };
    if (this.snapshot.isLoading) {
      return { success: false, error: "Already processing" };
    }

    const send = Symbol("chat turn");
    this.activeSend = send;
    const lifecycleVersion = this.lifecycleVersion;
    this.streamingContent = "";
    this.publish({ isLoading: true, isStreaming: true, error: null });

    let result: Awaited<ReturnType<ChatGateway["sendMessage"]>>;
    try {
      result = await this.gateway.sendMessage(trimmed);
    } catch (error) {
      result = { success: false, error: this.getErrorMessage(error) };
    }
    if (this.activeSend !== send) return result;
    if (result.success) {
      if (this.lifecycleVersion !== lifecycleVersion) {
        // A React subscription gap can lose text and the completion event.
        // Recover the persisted response without replaying the user turn.
        this.streamingContent = "";
        const recoveryLifecycle = this.lifecycleVersion;
        const conversationVersion = this.conversationVersion;
        try {
          const conversation = await this.gateway.fetchConversation();
          if (
            this.activeSend === send &&
            this.lifecycleVersion === recoveryLifecycle &&
            this.conversationVersion === conversationVersion
          ) {
            this.messages = conversation;
            this.conversationVersion += 1;
          }
        } catch (error) {
          if (
            this.activeSend === send &&
            this.lifecycleVersion === recoveryLifecycle
          ) {
            this.reportError(error);
          }
        }
      }
      if (this.activeSend === send) this.finishStream();
    } else {
      this.streamingContent = "";
      this.publish({
        isLoading: false,
        isStreaming: false,
        error: result.error,
      });
    }
    if (this.activeSend === send) this.activeSend = null;
    return result;
  };

  readonly stopStreaming = async (): Promise<void> => {
    if (!this.snapshot.isLoading) return;
    try {
      await this.gateway.cancelMessage();
    } catch (error) {
      this.reportError(error);
    }
  };

  readonly changeTheme = async (theme: CharacterThemeId): Promise<boolean> => {
    try {
      await this.gateway.persistSettings({ theme });
      this.settingsVersions.theme += 1;
      this.publish({
        settings: { ...this.snapshot.settings, theme },
        error: null,
      });
      return true;
    } catch (error) {
      this.reportError(error);
      return false;
    }
  };

  readonly changeVariant = async (
    variant: CharacterVariantId,
  ): Promise<boolean> => {
    try {
      await this.gateway.persistSettings({ variant });
      this.settingsVersions.variant += 1;
      this.publish({
        settings: { ...this.snapshot.settings, variant },
        error: null,
      });
      return true;
    } catch (error) {
      this.reportError(error);
      return false;
    }
  };

  readonly clearConversation = async (): Promise<boolean> => {
    try {
      await this.gateway.clearConversation();
      this.messages = [];
      this.streamingContent = "";
      this.publish({ error: null });
      return true;
    } catch (error) {
      this.reportError(error);
      return false;
    }
  };

  readonly clearApiKey = async (): Promise<boolean> => {
    try {
      await this.gateway.clearApiKey();
      return true;
    } catch (error) {
      this.reportError(error);
      return false;
    }
  };

  readonly onFunctionCall = (
    callback: (name: string, args: Record<string, unknown>) => void,
  ): (() => void) => this.gateway.onFunctionCall(callback);

  private async hydrate(lifecycleVersion: number): Promise<void> {
    const conversationVersion = this.conversationVersion;
    const settingsVersions = { ...this.settingsVersions };
    const [settings, messages] = await Promise.all([
      this.gateway.fetchSettings(),
      this.gateway.fetchConversation(),
    ]);
    if (this.lifecycleVersion !== lifecycleVersion) return;
    if (this.conversationVersion === conversationVersion) {
      this.messages = messages;
    }
    this.publish({
      settings: {
        theme:
          settingsVersions.theme === this.settingsVersions.theme
            ? settings.theme
            : this.snapshot.settings.theme,
        variant:
          settingsVersions.variant === this.settingsVersions.variant
            ? settings.variant
            : this.snapshot.settings.variant,
      },
    });
  }

  private finishStream(): void {
    // Keep the streamed text on screen: the persisted conversation arrives
    // in a separate event, and clearing here would blank the bubble for a
    // frame and replay its entrance animation.
    this.dropStreamingContentIfPersisted();
    this.publish({ isLoading: false, isStreaming: false });
  }

  /**
   * Once the persisted conversation contains the streamed reply, the
   * synthetic streaming bubble is redundant — drop it so the two never
   * render together and the handoff is invisible.
   */
  private dropStreamingContentIfPersisted(): void {
    const last = this.messages.at(-1);
    if (
      this.streamingContent &&
      last?.role === "assistant" &&
      last.content === citedResponse(this.streamingContent).content
    ) {
      this.streamingContent = "";
    }
  }

  private publish(update: Partial<ChatSnapshot> = {}): void {
    this.snapshot = {
      ...this.snapshot,
      ...update,
      visibleMessages: getVisibleMessages(
        this.messages,
        this.streamingContent || null,
        VISIBLE_MESSAGE_LIMIT,
      ),
    };
    for (const listener of this.listeners) listener();
  }

  private reportError(error: unknown): void {
    this.publish({ error: this.getErrorMessage(error) });
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
