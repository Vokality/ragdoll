import type { HostIpcBridge } from "@vokality/ragdoll-extensions";

type MessageListener = (payload: unknown) => void;

export class ExtensionMessageBus {
  private readonly listeners = new Map<string, Set<MessageListener>>();

  constructor(
    private readonly onToolExecution: (
      name: string,
      args: Record<string, unknown>,
    ) => void,
  ) {}

  forExtension(extensionId: string): HostIpcBridge {
    return {
      publish: (topic, payload) => {
        if (topic === `extension-tool:${extensionId}`) {
          const toolCall = this.parseToolCall(payload);
          this.onToolExecution(toolCall.tool, toolCall.args);
        }
        for (const listener of this.listeners.get(topic) ?? []) {
          listener(payload);
        }
      },
      subscribe: (topic, listener) => {
        const listeners = this.listeners.get(topic) ?? new Set();
        listeners.add(listener);
        this.listeners.set(topic, listeners);
        return () => {
          listeners.delete(listener);
          if (listeners.size === 0) this.listeners.delete(topic);
        };
      },
    };
  }

  clear(): void {
    this.listeners.clear();
  }

  private parseToolCall(payload: unknown): {
    tool: string;
    args: Record<string, unknown>;
  } {
    if (!payload || typeof payload !== "object") {
      throw new Error("Extension tool message must be an object");
    }
    const { tool, args } = payload as Record<string, unknown>;
    if (typeof tool !== "string" || !args || typeof args !== "object") {
      throw new Error("Extension tool message is invalid");
    }
    return { tool, args: args as Record<string, unknown> };
  }
}
