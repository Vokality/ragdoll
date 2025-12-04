import { useEffect, useMemo, useState } from "react";
import type { ExtensionUISlot } from "../index.js";
import { createTaskSlot, type TaskSlotHandle } from "../slots/task-slot.js";
import { createPomodoroSlot, type PomodoroSlotHandle } from "../slots/pomodoro-slot.js";
import { createSpotifySlot, type SpotifySlotHandle } from "../slots/spotify-slot.js";
import { useSpotifyPlayback } from "../hooks/use-spotify-playback.js";
import type { SpotifySetupActions } from "../../extensions/spotify/ui-types.js";
import type { ExtensionHostBridge } from "./extension-host.js";

const log = (...args: unknown[]): void => {
  if (typeof console !== "undefined") {
    console.info("[ExtensionSlots]", ...args);
  }
};

export function useExtensionSlots(host?: ExtensionHostBridge): ExtensionUISlot[] {
  const executeTool = host?.executeTool;

  const [taskSlot, setTaskSlot] = useState<ExtensionUISlot | null>(null);
  useEffect(() => {
    if (!host?.taskSource || !executeTool) {
      log("Task slot unavailable", {
        hasSource: !!host?.taskSource,
        hasExecuteTool: !!executeTool,
      });
      setTaskSlot(null);
      return;
    }
    log("Creating task slot handle");
    const handle: TaskSlotHandle = createTaskSlot({ source: host.taskSource, executeTool });
    setTaskSlot(handle.slot);
    return () => {
      log("Disposing task slot handle");
      handle.dispose();
    };
  }, [host?.taskSource, executeTool]);

  const [pomodoroSlot, setPomodoroSlot] = useState<ExtensionUISlot | null>(null);
  useEffect(() => {
    if (!host?.pomodoroSource || !executeTool) {
      log("Pomodoro slot unavailable", {
        hasSource: !!host?.pomodoroSource,
        hasExecuteTool: !!executeTool,
      });
      setPomodoroSlot(null);
      return;
    }
    log("Creating pomodoro slot handle");
    const handle: PomodoroSlotHandle = createPomodoroSlot({ source: host.pomodoroSource, executeTool });
    setPomodoroSlot(handle.slot);
    return () => {
      log("Disposing pomodoro slot handle");
      handle.dispose();
    };
  }, [host?.pomodoroSource, executeTool]);

  const spotifyHandle = useMemo<SpotifySlotHandle | null>(() => {
    if (!host?.spotify) {
      log("Spotify slot unavailable", { hasSpotifyHost: false });
      return null;
    }
    log("Creating Spotify slot handle");
    return createSpotifySlot();
  }, [host?.spotify]);

  const [spotifySlot, setSpotifySlot] = useState<ExtensionUISlot | null>(null);
  useEffect(() => {
    if (!spotifyHandle) {
      setSpotifySlot(null);
      return;
    }
    log("Attaching Spotify slot to registry");
    setSpotifySlot(spotifyHandle.slot);
    return () => {
      log("Disposing Spotify slot handle");
      spotifyHandle.dispose();
    };
  }, [spotifyHandle]);

  const { state: spotifyState, controls: spotifyControls } = useSpotifyPlayback(host?.spotify);

  const spotifySetupActions = useMemo<SpotifySetupActions | null>(() => {
    if (!host?.spotify) {
      return null;
    }
    const api = host.spotify;
    const actions: SpotifySetupActions = {
      getClientId: () => api.getClientId(),
      saveClientId: async (clientId: string) => {
        await api.saveClientId(clientId);
        api.reload?.();
      },
      isEnabled: () => api.isEnabled(),
      isAuthenticated: () => api.isAuthenticated(),
      getAuthUrl: () => api.getAuthUrl(),
      disconnect: async () => {
        await api.disconnect();
        api.reload?.();
      },
      getPlaybackState: () => api.getPlaybackState(),
    };
    return actions;
  }, [host?.spotify]);

  useEffect(() => {
    if (!spotifyHandle || !spotifySetupActions) {
      return;
    }
    log("Updating Spotify slot state", {
      hasPlayback: !!spotifyState,
    });
    spotifyHandle.update({
      playbackState: spotifyState,
      controls: spotifyControls,
      setupActions: spotifySetupActions,
    });
  }, [spotifyHandle, spotifySetupActions, spotifyControls, spotifyState]);

  useEffect(() => {
    log("Slot availability updated", {
      tasks: !!taskSlot,
      pomodoro: !!pomodoroSlot,
      spotify: !!spotifySlot,
    });
  }, [taskSlot, pomodoroSlot, spotifySlot]);

  return useMemo(() => {
    const slots: ExtensionUISlot[] = [];
    if (taskSlot) slots.push(taskSlot);
    if (pomodoroSlot) slots.push(pomodoroSlot);
    if (spotifySlot) slots.push(spotifySlot);
    return slots;
  }, [taskSlot, pomodoroSlot, spotifySlot]);
}
