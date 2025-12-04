import { createSlotState, type ExtensionUISlot } from "../../ui/index.js";
import { SpotifyPanelComponent } from "./panel.js";
import type { SpotifyUISlotOptions, SpotifyUISlotResult } from "./ui-types.js";

export function createSpotifyUISlot(options: SpotifyUISlotOptions): SpotifyUISlotResult {
  const {
    controls,
    setupActions,
    playback,
    hasConnected = false,
    error = null,
    id = "spotify.main",
    label = "Spotify",
    priority = 80,
  } = options;

  const hasTrack = playback.track !== null;

  // Badge shows play state indicator
  let badge: number | string | null = null;
  if (hasTrack) {
    badge = playback.isPlaying ? "▶" : "❚❚";
  }

  // Visibility: always show until connected, then only when playing
  const visible = !hasConnected || hasTrack;

  // Create mutable state store
  const stateStore = createSlotState({
    badge,
    visible,
    panel: {
      type: "custom" as const,
      title: "Spotify",
      component: ({ onClose }) => (
        <SpotifyPanelComponent
          onClose={onClose}
          controls={controls}
          setupActions={setupActions}
          playback={playback}
          error={error}
        />
      ),
    },
  });

  const slot: ExtensionUISlot = {
    id,
    label,
    icon: "music",
    priority,
    state: stateStore,
  };

  return { slot, stateStore };
}

export { createSpotifyUISlot as createSpotifySlot };
