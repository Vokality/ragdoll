/**
 * useSpotifyPlayback - React hook for Spotify playback integration.
 *
 * This hook uses the Spotify REST API (via main process) to:
 * 1. Fetch current playback state from any device
 * 2. Control playback (play, pause, skip)
 * 3. Poll for updates every few seconds
 *
 * Note: We don't use the Web Playback SDK because it requires Widevine DRM
 * which isn't available in Electron by default. Instead, we just show what's
 * playing on other devices and control playback remotely.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// =============================================================================
// Local Type Definitions (mirrors types from extension but browser-safe)
// =============================================================================

export interface SpotifyTrack {
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
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  volumePercent: number;
}

export interface SpotifyPlaybackState {
  isPlaying: boolean;
  track: SpotifyTrack | null;
  progressMs: number;
  device: SpotifyDevice | null;
  shuffleState: boolean;
  repeatState: "off" | "track" | "context";
  timestamp: number;
}

export const EMPTY_PLAYBACK_STATE: SpotifyPlaybackState = {
  isPlaying: false,
  track: null,
  progressMs: 0,
  device: null,
  shuffleState: false,
  repeatState: "off",
  timestamp: Date.now(),
};

// =============================================================================
// Hook State
// =============================================================================

export interface UseSpotifyPlaybackState {
  /** Whether we've successfully fetched playback at least once */
  isReady: boolean;
  /** Whether we're currently connected (have valid playback data) */
  isConnected: boolean;
  /** Whether player has ever connected in this session */
  hasConnected: boolean;
  /** Current playback state */
  playback: SpotifyPlaybackState;
  /** Error message if any */
  error: string | null;
}

export interface UseSpotifyPlaybackControls {
  /** Resume playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Skip to next track */
  next: () => void;
  /** Skip to previous track */
  previous: () => void;
}

export interface UseSpotifyPlaybackResult {
  state: UseSpotifyPlaybackState;
  controls: UseSpotifyPlaybackControls;
}

// =============================================================================
// Hook Implementation
// =============================================================================

const POLL_INTERVAL_MS = 3000; // Poll every 3 seconds

export function useSpotifyPlayback(): UseSpotifyPlaybackResult {
  const [state, setState] = useState<UseSpotifyPlaybackState>({
    isReady: false,
    isConnected: false,
    hasConnected: false,
    playback: EMPTY_PLAYBACK_STATE,
    error: null,
  });

  const mountedRef = useRef(true);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch playback state from Spotify REST API via main process
  const fetchPlaybackState = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const playback = await window.electronAPI.spotifyGetPlaybackState();
      
      if (!mountedRef.current) return;

      if (playback) {
        setState((prev) => ({
          ...prev,
          isReady: true,
          isConnected: true,
          hasConnected: true,
          playback,
          error: null,
        }));
      } else {
        // No active playback, but we're still connected
        setState((prev) => ({
          ...prev,
          isReady: true,
          // Keep hasConnected true if it was ever true
          playback: prev.hasConnected ? { ...EMPTY_PLAYBACK_STATE, timestamp: Date.now() } : prev.playback,
        }));
      }
    } catch (error) {
      console.error("[useSpotifyPlayback] Failed to fetch playback state:", error);
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to fetch playback",
        }));
      }
    }
  }, []);

  // Start/stop polling based on auth state
  useEffect(() => {
    mountedRef.current = true;

    async function startPolling() {
      // Check if Spotify is enabled and authenticated
      const isEnabled = await window.electronAPI.spotifyIsEnabled();
      const isAuthenticated = await window.electronAPI.spotifyIsAuthenticated();

      if (!isEnabled || !isAuthenticated) {
        return;
      }

      if (!mountedRef.current) return;

      // Fetch immediately
      await fetchPlaybackState();

      // Then poll at interval
      pollIntervalRef.current = setInterval(() => {
        if (mountedRef.current) {
          fetchPlaybackState();
        }
      }, POLL_INTERVAL_MS);
    }

    startPolling();

    return () => {
      mountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchPlaybackState]);

  // Controls - these call the main process which uses the Spotify API
  const controls: UseSpotifyPlaybackControls = {
    play: async () => {
      const result = await window.electronAPI.spotifyPlay();
      if (!result.success) {
        console.error("[useSpotifyPlayback] Play failed:", result.error);
      }
      // Refresh playback state after action
      fetchPlaybackState();
    },
    pause: async () => {
      const result = await window.electronAPI.spotifyPause();
      if (!result.success) {
        console.error("[useSpotifyPlayback] Pause failed:", result.error);
      }
      // Refresh playback state after action
      fetchPlaybackState();
    },
    next: async () => {
      const result = await window.electronAPI.spotifyNext();
      if (!result.success) {
        console.error("[useSpotifyPlayback] Next failed:", result.error);
      }
      // Refresh playback state after action
      fetchPlaybackState();
    },
    previous: async () => {
      const result = await window.electronAPI.spotifyPrevious();
      if (!result.success) {
        console.error("[useSpotifyPlayback] Previous failed:", result.error);
      }
      // Refresh playback state after action
      fetchPlaybackState();
    },
  };

  return { state, controls };
}
