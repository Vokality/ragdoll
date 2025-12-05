/// <reference types="vite/client" />

// Extension types for renderer
interface ExtensionInfo {
  packageName: string;
  id: string;
  name: string;
  description: string;
  canDisable: boolean;
}

interface ExtensionStats {
  extensionCount: number;
  toolCount: number;
}

interface LoadedPackage {
  packageName: string;
  extensionId: string;
}

interface LoadResult {
  packageName: string;
  extensionId: string;
  success: boolean;
  error?: string;
}

interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
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

interface SlotInfo {
  extensionId: string;
  slotId: string;
  label: string;
  icon: string | { type: "component" };
  priority: number;
}

interface SlotState {
  badge: number | string | null;
  visible: boolean;
  panel: unknown;
}

interface SlotChangeEvent {
  extensionId: string;
  slotId: string;
  state: SlotState;
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
  getExtensionStats: () => Promise<ExtensionStats>;
  getExtensionTools: () => Promise<ToolDefinition[]>;
  getExtensionSlots: () => Promise<SlotInfo[]>;
  getSlotState: (slotId: string) => Promise<SlotState | null>;
  getAvailableExtensions: () => Promise<ExtensionInfo[]>;
  getDisabledExtensions: () => Promise<string[]>;
  setDisabledExtensions: (extensionIds: string[]) => Promise<{ success: boolean; requiresRestart: boolean }>;
  discoverPackages: () => Promise<string[]>;
  getLoadedPackages: () => Promise<LoadedPackage[]>;
  loadPackage: (packageName: string, config?: Record<string, unknown>) => Promise<LoadResult>;
  unloadPackage: (packageName: string) => Promise<boolean>;
  reloadPackage: (packageName: string, config?: Record<string, unknown>) => Promise<LoadResult>;
  discoverAndLoadPackages: () => Promise<LoadResult[]>;
  executeExtensionTool: (
    toolName: string,
    args?: Record<string, unknown>
  ) => Promise<{ success: boolean; error?: string }>;

  // Extension State Channels (generic)
  getAllStateChannels: () => Promise<StateChannelInfo[]>;
  getStateChannel: (channelId: string) => Promise<unknown | null>;
  onStateChannelChanged: (callback: (event: StateChannelChangeEvent) => void) => () => void;

  // Extension Slots (generic)
  onSlotStateChanged: (callback: (event: SlotChangeEvent) => void) => () => void;
  executeSlotAction: (
    slotId: string,
    actionType: string,
    actionId: string
  ) => Promise<{ success: boolean; error?: string }>;

  // Platform
  platform: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
