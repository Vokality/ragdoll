import { contextBridge, ipcRenderer } from "electron";
import type { TaskState } from "@vokality/ragdoll";

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

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface TaskEvent {
  type: string;
  task?: unknown;
  taskId?: string;
  state: {
    tasks: Array<{
      id: string;
      text: string;
      status: string;
      createdAt: number;
      blockedReason?: string;
    }>;
    activeTaskId: string | null;
  };
  timestamp: number;
}

export interface PomodoroEvent {
  type: string;
  state: {
    phase: string;
    remainingMs: number;
    sessionDurationMs: number;
    breakDurationMs: number;
    isBreak: boolean;
    sessionsCompleted: number;
  };
  timestamp: number;
}

export interface PomodoroStateSnapshot {
  phase: string;
  remainingSeconds: number;
  isBreak: boolean;
  sessionsCompleted: number;
}

// Spotify types (local definitions to avoid importing from Node-only module)
export interface SpotifyPlaybackState {
  isPlaying: boolean;
  track: {
    id: string;
    name: string;
    uri: string;
    durationMs: number;
    artists: Array<{ id: string; name: string; uri: string }>;
    album: {
      id: string;
      name: string;
      uri: string;
      images: Array<{ url: string; height: number | null; width: number | null }>;
    };
    artworkUrl: string | null;
  } | null;
  progressMs: number;
  device: {
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    volumePercent: number;
  } | null;
  shuffleState: boolean;
  repeatState: "off" | "track" | "context";
  timestamp: number;
}

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
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

  // Tasks
  getTaskState: () => Promise<TaskState>;
  saveTaskState: (state: TaskState) => Promise<{ success: boolean; error?: string }>;

  // Extensions
  getExtensionStats: () => Promise<ExtensionStats>;
  getExtensionTools: () => Promise<ToolDefinition[]>;
  discoverPackages: () => Promise<string[]>;
  getLoadedPackages: () => Promise<LoadedPackage[]>;
  loadPackage: (packageName: string, config?: Record<string, unknown>) => Promise<LoadResult>;
  unloadPackage: (packageName: string) => Promise<boolean>;
  reloadPackage: (packageName: string, config?: Record<string, unknown>) => Promise<LoadResult>;
  discoverAndLoadPackages: () => Promise<LoadResult[]>;

  // State sync events
  onTaskStateChanged: (callback: (event: TaskEvent) => void) => () => void;
  onPomodoroStateChanged: (callback: (event: PomodoroEvent) => void) => () => void;
  getPomodoroState: () => Promise<PomodoroStateSnapshot | null>;

  // Spotify
  spotifyIsEnabled: () => Promise<boolean>;
  spotifyIsAuthenticated: () => Promise<boolean>;
  spotifyGetAuthUrl: (state?: string) => Promise<string | null>;
  spotifyExchangeCode: (code: string) => Promise<{ success: boolean; tokens?: SpotifyTokens; error?: string }>;
  spotifyGetAccessToken: () => Promise<string | null>;
  spotifyGetPlaybackState: () => Promise<SpotifyPlaybackState | null>;
  spotifyUpdatePlaybackState: (playback: SpotifyPlaybackState) => Promise<{ success: boolean }>;
  spotifyDisconnect: () => Promise<{ success: boolean }>;
  spotifyGetClientId: () => Promise<string | null>;
  spotifySetClientId: (clientId: string) => Promise<{ success: boolean }>;
  spotifyPlay: () => Promise<{ success: boolean; error?: string }>;
  spotifyPause: () => Promise<{ success: boolean; error?: string }>;
  spotifyNext: () => Promise<{ success: boolean; error?: string }>;
  spotifyPrevious: () => Promise<{ success: boolean; error?: string }>;

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

  // Tasks
  getTaskState: () => ipcRenderer.invoke("tasks:get-state"),
  saveTaskState: (state: TaskState) => ipcRenderer.invoke("tasks:save-state", state),

  // Extensions
  getExtensionStats: () => ipcRenderer.invoke("extensions:get-stats"),
  getExtensionTools: () => ipcRenderer.invoke("extensions:get-tools"),
  discoverPackages: () => ipcRenderer.invoke("extensions:discover-packages"),
  getLoadedPackages: () => ipcRenderer.invoke("extensions:get-loaded-packages"),
  loadPackage: (packageName: string, config?: Record<string, unknown>) =>
    ipcRenderer.invoke("extensions:load-package", packageName, config),
  unloadPackage: (packageName: string) =>
    ipcRenderer.invoke("extensions:unload-package", packageName),
  reloadPackage: (packageName: string, config?: Record<string, unknown>) =>
    ipcRenderer.invoke("extensions:reload-package", packageName, config),
  discoverAndLoadPackages: () => ipcRenderer.invoke("extensions:discover-and-load"),

  // State sync events
  onTaskStateChanged: (callback: (event: TaskEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: TaskEvent) => callback(event);
    ipcRenderer.on("tasks:state-changed", handler);
    return () => {
      ipcRenderer.removeListener("tasks:state-changed", handler);
    };
  },
  onPomodoroStateChanged: (callback: (event: PomodoroEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: PomodoroEvent) => callback(event);
    ipcRenderer.on("pomodoro:state-changed", handler);
    return () => {
      ipcRenderer.removeListener("pomodoro:state-changed", handler);
    };
  },
  getPomodoroState: () => ipcRenderer.invoke("pomodoro:get-state"),

  // Spotify
  spotifyIsEnabled: () => ipcRenderer.invoke("spotify:is-enabled"),
  spotifyIsAuthenticated: () => ipcRenderer.invoke("spotify:is-authenticated"),
  spotifyGetAuthUrl: (state?: string) => ipcRenderer.invoke("spotify:get-auth-url", state),
  spotifyExchangeCode: (code: string) => ipcRenderer.invoke("spotify:exchange-code", code),
  spotifyGetAccessToken: () => ipcRenderer.invoke("spotify:get-access-token"),
  spotifyGetPlaybackState: () => ipcRenderer.invoke("spotify:get-playback-state"),
  spotifyUpdatePlaybackState: (playback: SpotifyPlaybackState) =>
    ipcRenderer.invoke("spotify:update-playback-state", playback),
  spotifyDisconnect: () => ipcRenderer.invoke("spotify:disconnect"),
  spotifyGetClientId: () => ipcRenderer.invoke("spotify:get-client-id"),
  spotifySetClientId: (clientId: string) => ipcRenderer.invoke("spotify:set-client-id", clientId),
  spotifyPlay: () => ipcRenderer.invoke("spotify:play"),
  spotifyPause: () => ipcRenderer.invoke("spotify:pause"),
  spotifyNext: () => ipcRenderer.invoke("spotify:next"),
  spotifyPrevious: () => ipcRenderer.invoke("spotify:previous"),

  // Platform
  platform: process.platform,
} satisfies ElectronAPI);

// Extend Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
