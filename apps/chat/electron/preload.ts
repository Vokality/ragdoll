import { contextBridge, ipcRenderer } from "electron";

// Types for extension management
export interface LoadResult {
  packageName: string;
  extensionId: string;
  success: boolean;
  error?: string;
}

export interface ExtensionStats {
  extensionCount: number;
  toolCount: number;
}

export interface LoadedPackage {
  packageName: string;
  extensionId: string;
}

export interface ExtensionInfo {
  packageName: string;
  id: string;
  name: string;
  description: string;
  canDisable: boolean;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface StateChannelInfo {
  extensionId: string;
  channelId: string;
  state: unknown;
}

export interface StateChannelChangeEvent {
  extensionId: string;
  channelId: string;
  state: unknown;
}

// Types for the API
export interface ElectronAPI {
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

  // Platform
  platform: string;
}

contextBridge.exposeInMainWorld("electronAPI", {
  // Auth
  hasApiKey: () => ipcRenderer.invoke("auth:has-key"),
  setApiKey: (key: string) => ipcRenderer.invoke("auth:set-key", key),
  validateApiKey: (key: string) => ipcRenderer.invoke("auth:validate-key", key),
  clearApiKey: () => ipcRenderer.invoke("auth:clear-key"),

  // Chat
  sendMessage: (
    message: string,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  ) => ipcRenderer.invoke("chat:send-message", message, conversationHistory),
  getConversation: () => ipcRenderer.invoke("chat:get-conversation"),
  clearConversation: () => ipcRenderer.invoke("chat:clear-conversation"),
  saveConversation: (conversation: Array<{ role: "user" | "assistant"; content: string }>) =>
    ipcRenderer.invoke("chat:save-conversation", conversation),

  // Streaming events
  onStreamingText: (callback: (text: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, text: string) => callback(text);
    ipcRenderer.on("chat:streaming-text", handler);
    return () => {
      ipcRenderer.removeListener("chat:streaming-text", handler);
    };
  },
  onFunctionCall: (callback: (name: string, args: Record<string, unknown>) => void) => {
    const handler = (_: Electron.IpcRendererEvent, name: string, args: Record<string, unknown>) =>
      callback(name, args);
    ipcRenderer.on("chat:function-call", handler);
    return () => {
      ipcRenderer.removeListener("chat:function-call", handler);
    };
  },
  onStreamEnd: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("chat:stream-end", handler);
    return () => {
      ipcRenderer.removeListener("chat:stream-end", handler);
    };
  },

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings: { theme?: string; variant?: string }) =>
    ipcRenderer.invoke("settings:set", settings),

  // Extensions
  getExtensionStats: () => ipcRenderer.invoke("extensions:get-stats"),
  getExtensionTools: () => ipcRenderer.invoke("extensions:get-tools"),
  getAvailableExtensions: () => ipcRenderer.invoke("extensions:get-available"),
  getDisabledExtensions: () => ipcRenderer.invoke("extensions:get-disabled"),
  setDisabledExtensions: (extensionIds: string[]) =>
    ipcRenderer.invoke("extensions:set-disabled", extensionIds),
  discoverPackages: () => ipcRenderer.invoke("extensions:discover-packages"),
  getLoadedPackages: () => ipcRenderer.invoke("extensions:get-loaded-packages"),
  loadPackage: (packageName: string, config?: Record<string, unknown>) =>
    ipcRenderer.invoke("extensions:load-package", packageName, config),
  unloadPackage: (packageName: string) =>
    ipcRenderer.invoke("extensions:unload-package", packageName),
  reloadPackage: (packageName: string, config?: Record<string, unknown>) =>
    ipcRenderer.invoke("extensions:reload-package", packageName, config),
  discoverAndLoadPackages: () => ipcRenderer.invoke("extensions:discover-and-load"),
  executeExtensionTool: (toolName: string, args?: Record<string, unknown>) =>
    ipcRenderer.invoke("extensions:execute-tool", toolName, args ?? {}),

  // Extension State Channels (generic)
  getAllStateChannels: () => ipcRenderer.invoke("extensions:get-all-state-channels"),
  getStateChannel: (channelId: string) => ipcRenderer.invoke("extensions:get-state-channel", channelId),
  onStateChannelChanged: (callback: (event: StateChannelChangeEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: StateChannelChangeEvent) => callback(event);
    ipcRenderer.on("extension-state:changed", handler);
    return () => {
      ipcRenderer.removeListener("extension-state:changed", handler);
    };
  },

  // Platform
  platform: process.platform,
} satisfies ElectronAPI);

// Extend Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
