/**
 * Shared Spotify UI types used by the slot factory and panel component.
 */

import type { SpotifyPlaybackState } from "./types.js";
import type { ExtensionUISlot, MutableSlotStateStore } from "@vokality/ragdoll-extensions/ui";

export interface SpotifyPlaybackControls {
  play(): void;
  pause(): void;
  next(): void;
  previous(): void;
}

export interface SpotifySetupActions {
  getClientId(): Promise<string | null>;
  saveClientId(clientId: string): Promise<void>;
  isEnabled(): Promise<boolean>;
  isAuthenticated(): Promise<boolean>;
  getAuthUrl(): Promise<string | null>;
  disconnect(): Promise<void>;
  getPlaybackState(): Promise<SpotifyPlaybackState | null>;
}

export interface SpotifyUISlotOptions {
  controls: SpotifyPlaybackControls;
  setupActions: SpotifySetupActions;
  playback: SpotifyPlaybackState;
  hasConnected?: boolean;
  error?: string | null;
  id?: string;
  label?: string;
  priority?: number;
}

export interface SpotifyUISlotResult {
  slot: ExtensionUISlot;
  stateStore: MutableSlotStateStore;
}
