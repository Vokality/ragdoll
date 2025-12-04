import { createElement } from "react";
import { createSlotState, type ExtensionUISlot, type MutableSlotStateStore, type PanelConfig } from "../index.js";
import { SpotifyPanelComponent } from "../../extensions/spotify/panel.js";
import type { SpotifyPlaybackControls, SpotifySetupActions } from "../../extensions/spotify/ui-types.js";
import type { UseSpotifyPlaybackState } from "../hooks/use-spotify-playback.js";
import { EMPTY_PLAYBACK_STATE } from "../hooks/use-spotify-playback.js";

export interface SpotifySlotHandle {
  slot: ExtensionUISlot;
  stateStore: MutableSlotStateStore;
  update: (options: SpotifySlotUpdate) => void;
  dispose: () => void;
}

export interface SpotifySlotUpdate {
  playbackState: UseSpotifyPlaybackState;
  controls: SpotifyPlaybackControls;
  setupActions: SpotifySetupActions;
}

export interface SpotifySlotOptions {
  id?: string;
  label?: string;
  priority?: number;
}

export function createSpotifySlot(options?: SpotifySlotOptions): SpotifySlotHandle {
  const store = createSlotState({
    badge: null,
    visible: false,
    panel: buildPanel({
      playbackState: {
        isReady: false,
        isConnected: false,
        hasConnected: false,
        playback: EMPTY_PLAYBACK_STATE,
        error: null,
      },
      controls: createNoopControls(),
      setupActions: createNoopSetupActions(),
    }),
  });

  const slot: ExtensionUISlot = {
    id: options?.id ?? "spotify.main",
    label: options?.label ?? "Spotify",
    icon: "music",
    priority: options?.priority ?? 80,
    state: store,
  };

  const update = ({ playbackState, controls, setupActions }: SpotifySlotUpdate) => {
    const track = playbackState.playback.track;
    const badge = track ? (playbackState.playback.isPlaying ? "▶" : "❚❚") : null;
    const visible = !playbackState.hasConnected || Boolean(track);

    store.setBadge(badge);
    store.setVisible(visible);
    store.setPanel(buildPanel({ playbackState, controls, setupActions }));
  };

  const dispose = () => {
    // no resources to clean currently
  };

  return { slot, stateStore: store, update, dispose };
}

function buildPanel({
  playbackState,
  controls,
  setupActions,
}: SpotifySlotUpdate): PanelConfig {
  return {
    type: "custom",
    title: "Spotify",
    component: ({ onClose }) =>
      createElement(SpotifyPanelComponent, {
        onClose,
        controls,
        setupActions,
        playback: playbackState.playback,
        error: playbackState.error,
      }),
  };
}

function createNoopControls(): SpotifyPlaybackControls {
  return {
    play: () => undefined,
    pause: () => undefined,
    next: () => undefined,
    previous: () => undefined,
  };
}

function createNoopSetupActions(): SpotifySetupActions {
  return {
    getClientId: async () => null,
    saveClientId: async () => undefined,
    isEnabled: async () => false,
    isAuthenticated: async () => false,
    getAuthUrl: async () => null,
    disconnect: async () => undefined,
    getPlaybackState: async () => EMPTY_PLAYBACK_STATE,
  };
}
