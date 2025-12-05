/// <reference types="vite/client" />

// Extension types for renderer
interface ExtensionInfo {
  packageName: string;
  id: string;
  name: string;
  description: string;
  canDisable: boolean;
}

interface StateChannelInfo {
  extensionId: string;
  channelId: string;
  state: unknown;
}

interface StateChannelChangeEvent {
  extensionId: string;
  channelId: string;
  state: unknown;
}

// ElectronAPI type definition
interface ElectronAPI {
  // Auth
  hasApiKey: () => Promise<boolean>;
  setApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  validateApiKey: (key: string) => Promise<{ valid: boolean; error?: string }>;
  clearApiKey: () => Promise<{ success: boolean }>;

  // Chat
  sendMessage: (
    message: string,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  ) => Promise<{ success: boolean; error?: string }>;
  getConversation: () => Promise<Array<{ role: "user" | "assistant"; content: string }>>;
  clearConversation: () => Promise<{ success: boolean }>;
  saveConversation: (
    conversation: Array<{ role: "user" | "assistant"; content: string }>
  ) => Promise<{ success: boolean }>;

  // Streaming events
  onStreamingText: (callback: (text: string) => void) => () => void;
  onFunctionCall: (callback: (name: string, args: Record<string, unknown>) => void) => () => void;
  onStreamEnd: (callback: () => void) => () => void;

  // Settings
  getSettings: () => Promise<{ theme?: string; variant?: string }>;
  setSettings: (settings: { theme?: string; variant?: string }) => Promise<{ success: boolean }>;

  // Extensions
  getAvailableExtensions: () => Promise<ExtensionInfo[]>;
  getDisabledExtensions: () => Promise<string[]>;
  setDisabledExtensions: (extensionIds: string[]) => Promise<{ success: boolean; requiresRestart: boolean }>;
  executeExtensionTool: (
    toolName: string,
    args?: Record<string, unknown>
  ) => Promise<{ success: boolean; error?: string }>;

  // Extension State Channels (generic)
  getAllStateChannels: () => Promise<StateChannelInfo[]>;
  getStateChannel: (channelId: string) => Promise<unknown | null>;
  onStateChannelChanged: (callback: (event: StateChannelChangeEvent) => void) => () => void;

  // Platform
  platform: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
