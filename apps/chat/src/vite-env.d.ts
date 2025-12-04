/// <reference types="vite/client" />
import type { TaskState, PomodoroState } from "@vokality/ragdoll-extensions";

// Extension types for renderer
interface BuiltInExtensionInfo {
  id: string;
  name: string;
  description: string;
  canDisable: boolean;
}

// Spotify types for renderer
interface SpotifyPlaybackState {
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

interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

interface TaskEvent {
  type: string;
  task?: unknown;
  taskId?: string;
  state: TaskState;
  timestamp: number;
}

interface PomodoroEvent {
  type: string;
  state: PomodoroState;
  timestamp: number;
}

interface PomodoroStateSnapshot {
  phase: string;
  remainingSeconds: number;
  isBreak: boolean;
  sessionsCompleted: number;
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

  // Tasks
  getTaskState: () => Promise<TaskState>;
  onTaskStateChanged: (callback: (event: TaskEvent) => void) => () => void;

  // Pomodoro
  getPomodoroState: () => Promise<PomodoroStateSnapshot | null>;
  onPomodoroStateChanged: (callback: (event: PomodoroEvent) => void) => () => void;

  // Extensions
  getAvailableExtensions: () => Promise<BuiltInExtensionInfo[]>;
  getDisabledExtensions: () => Promise<string[]>;
  setDisabledExtensions: (extensionIds: string[]) => Promise<{ success: boolean; requiresRestart: boolean }>;
  executeExtensionTool: (
    toolName: string,
    args?: Record<string, unknown>
  ) => Promise<{ success: boolean; error?: string }>;

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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
