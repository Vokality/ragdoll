/// <reference types="vite/client" />

// Extension types for renderer
interface ExtensionInfo {
  packageName: string;
  id: string;
  name: string;
  description: string;
  canDisable: boolean;
  hasConfigSchema: boolean;
  hasOAuth: boolean;
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

// OAuth types
interface OAuthState {
  status: "disconnected" | "connecting" | "connected" | "error" | "expired";
  isAuthenticated: boolean;
  expiresAt?: number;
  error?: string;
}

interface OAuthEvent {
  extensionId: string;
  error?: string;
}

// Config types
interface ConfigFieldBase {
  type: string;
  label: string;
  description?: string;
  required?: boolean;
}

interface ConfigFieldString extends ConfigFieldBase {
  type: "string";
  default?: string;
  placeholder?: string;
  secret?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

interface ConfigFieldNumber extends ConfigFieldBase {
  type: "number";
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

interface ConfigFieldBoolean extends ConfigFieldBase {
  type: "boolean";
  default?: boolean;
}

interface ConfigFieldSelect extends ConfigFieldBase {
  type: "select";
  default?: string;
  options: Array<{ value: string; label: string }>;
}

type ConfigField = ConfigFieldString | ConfigFieldNumber | ConfigFieldBoolean | ConfigFieldSelect;

interface ConfigSchema {
  [key: string]: ConfigField;
}

interface ExtensionConfigStatus {
  isConfigured: boolean;
  missingFields: string[];
  values: Record<string, unknown>;
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
  getDiscoveredExtensions: () => Promise<ExtensionInfo[]>;
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

  // Extension OAuth
  getOAuthState: (extensionId: string) => Promise<OAuthState | null>;
  startOAuthFlow: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
  disconnectOAuth: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
  onOAuthSuccess: (callback: (event: OAuthEvent) => void) => () => void;
  onOAuthError: (callback: (event: OAuthEvent) => void) => () => void;

  // Extension Config
  getConfigStatus: (extensionId: string) => Promise<ExtensionConfigStatus | null>;
  getConfigSchema: (extensionId: string) => Promise<ConfigSchema | null>;
  setConfigValue: (
    extensionId: string,
    key: string,
    value: string | number | boolean
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
