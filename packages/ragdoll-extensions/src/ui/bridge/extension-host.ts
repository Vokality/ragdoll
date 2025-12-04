import type { TaskState, TaskEvent } from "../../extensions/tasks/index.js";
import type { PomodoroState, PomodoroEvent } from "../../extensions/pomodoro/index.js";
import type { SpotifyPlaybackState } from "../../extensions/spotify/types.js";
import type { TaskSlotSource, ExecuteToolFn } from "../slots/task-slot.js";
import type { PomodoroSlotSource } from "../slots/pomodoro-slot.js";
import type { SpotifyHostAPI } from "../hooks/use-spotify-playback.js";

const log = (...args: unknown[]): void => {
  if (typeof console !== "undefined") {
    console.info("[ExtensionHost]", ...args);
  }
};

const logError = (...args: unknown[]): void => {
  if (typeof console !== "undefined") {
    console.error("[ExtensionHost]", ...args);
  }
};

export interface ExtensionHostBridge {
  executeTool?: ExecuteToolFn;
  taskSource?: TaskSlotSource;
  pomodoroSource?: PomodoroSlotSource;
  spotify?: SpotifyExtensionHost;
}

export interface SpotifyExtensionHost extends SpotifyHostAPI {
  getClientId(): Promise<string | null>;
  saveClientId(clientId: string): Promise<void>;
  getAuthUrl(): Promise<string | null>;
  disconnect(): Promise<void>;
  reload?: () => void;
}

export interface ElectronHostAPI {
  executeExtensionTool?: ExecuteToolFn;
  getTaskState?: () => Promise<TaskState>;
  onTaskStateChanged?: (callback: (event: TaskEvent) => void) => () => void;
  getPomodoroState?: () => Promise<PomodoroState | null>;
  onPomodoroStateChanged?: (callback: (event: PomodoroEvent) => void) => () => void;
  spotifyIsEnabled?: () => Promise<boolean>;
  spotifyIsAuthenticated?: () => Promise<boolean>;
  spotifyGetAuthUrl?: (state?: string) => Promise<string | null>;
  spotifyDisconnect?: () => Promise<{ success: boolean; error?: string }>;
  spotifyGetClientId?: () => Promise<string | null>;
  spotifySetClientId?: (clientId: string) => Promise<{ success: boolean; error?: string }>;
  spotifyGetPlaybackState?: () => Promise<SpotifyPlaybackState | null>;
  spotifyPlay?: () => Promise<{ success: boolean; error?: string }>;
  spotifyPause?: () => Promise<{ success: boolean; error?: string }>;
  spotifyNext?: () => Promise<{ success: boolean; error?: string }>;
  spotifyPrevious?: () => Promise<{ success: boolean; error?: string }>;
}

export interface ElectronHostOptions {
  api: ElectronHostAPI;
  reload?: () => void;
}

export function createElectronHostBridge({ api, reload }: ElectronHostOptions): ExtensionHostBridge {
  const bridge: ExtensionHostBridge = {};
  const capabilityDetails = {
    hasExecuteTool: typeof api.executeExtensionTool,
    hasTaskStateGetter: typeof api.getTaskState,
    hasTaskStateListener: typeof api.onTaskStateChanged,
    hasPomodoroGetter: typeof api.getPomodoroState,
    hasPomodoroListener: typeof api.onPomodoroStateChanged,
    hasSpotifyEnabled: typeof api.spotifyIsEnabled,
    hasSpotifyAuthenticated: typeof api.spotifyIsAuthenticated,
    hasSpotifyPlayback: typeof api.spotifyGetPlaybackState,
  };
  const capabilities = {
    executeTool: capabilityDetails.hasExecuteTool === "function",
    taskState:
      capabilityDetails.hasTaskStateGetter === "function" &&
      capabilityDetails.hasTaskStateListener === "function",
    pomodoroState:
      capabilityDetails.hasPomodoroGetter === "function" &&
      capabilityDetails.hasPomodoroListener === "function",
    spotify:
      capabilityDetails.hasSpotifyEnabled === "function" &&
      capabilityDetails.hasSpotifyAuthenticated === "function" &&
      capabilityDetails.hasSpotifyPlayback === "function",
  };
  log("Initializing Electron host bridge", { capabilities, capabilityDetails });

  if (api.executeExtensionTool) {
    log("Connecting executeTool bridge");
    bridge.executeTool = (tool, args) => api.executeExtensionTool!(tool, args);
  } else {
    log("executeExtensionTool is not available on host API");
  }

  if (api.getTaskState && api.onTaskStateChanged) {
    log("Connecting task slot source");
    bridge.taskSource = {
      getInitialState: async () => {
        try {
          const state = await api.getTaskState!();
          log("Loaded initial task state", {
            tasks: state?.tasks?.length ?? 0,
            hasState: !!state,
          });
          return state;
        } catch (error) {
          logError("Failed to load task state", error);
          return null;
        }
      },
      subscribe: (callback) => {
        log("Subscribed to task state events");
        const unsubscribe = api.onTaskStateChanged!((event) => {
          log("Task event", event.type, {
            tasks: event.state.tasks?.length ?? 0,
          });
          callback(event);
        });
        return () => {
          log("Unsubscribing from task state events");
          unsubscribe();
        };
      },
    } satisfies TaskSlotSource;
  } else {
    log("Task APIs unavailable; task slot disabled");
  }

  if (api.getPomodoroState && api.onPomodoroStateChanged) {
    log("Connecting pomodoro slot source");
    bridge.pomodoroSource = {
      getInitialState: async () => {
        try {
          const state = await api.getPomodoroState!();
          log("Loaded initial pomodoro state", {
            phase: state?.phase ?? "none",
            isBreak: state?.isBreak ?? false,
          });
          return state;
        } catch (error) {
          logError("Failed to load pomodoro state", error);
          return null;
        }
      },
      subscribe: (callback) => {
        log("Subscribed to pomodoro events");
        const unsubscribe = api.onPomodoroStateChanged!((event) => {
          log("Pomodoro event", event.type, {
            phase: event.state.phase,
            isBreak: event.state.isBreak,
          });
          callback(event);
        });
        return () => {
          log("Unsubscribing from pomodoro events");
          unsubscribe();
        };
      },
    } satisfies PomodoroSlotSource;
  } else {
    log("Pomodoro APIs unavailable; pomodoro slot disabled");
  }

  if (
    api.spotifyIsEnabled &&
    api.spotifyIsAuthenticated &&
    api.spotifyGetPlaybackState &&
    api.spotifyPlay &&
    api.spotifyPause &&
    api.spotifyNext &&
    api.spotifyPrevious
  ) {
    log("Connecting Spotify slot source");
    bridge.spotify = {
      isEnabled: () => api.spotifyIsEnabled!(),
      isAuthenticated: () => api.spotifyIsAuthenticated!(),
      getPlaybackState: () => api.spotifyGetPlaybackState!(),
      play: () => api.spotifyPlay!(),
      pause: () => api.spotifyPause!(),
      next: () => api.spotifyNext!(),
      previous: () => api.spotifyPrevious!(),
      getClientId: () => (api.spotifyGetClientId ? api.spotifyGetClientId() : Promise.resolve(null)),
      saveClientId: async (clientId: string) => {
        if (api.spotifySetClientId) {
          await api.spotifySetClientId(clientId);
        }
      },
      getAuthUrl: () => (api.spotifyGetAuthUrl ? api.spotifyGetAuthUrl() : Promise.resolve(null)),
      disconnect: async () => {
        if (api.spotifyDisconnect) {
          await api.spotifyDisconnect();
          reload?.();
        }
      },
      reload,
    } satisfies SpotifyExtensionHost;
  } else {
    log("Spotify APIs unavailable; spotify slot disabled");
  }

  return bridge;
}
