import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { SpotifyPlaybackState } from "../../extensions/spotify/types.js";

export interface SpotifyHostAPI {
  isEnabled(): Promise<boolean>;
  isAuthenticated(): Promise<boolean>;
  getPlaybackState(): Promise<SpotifyPlaybackState | null>;
  play(): Promise<{ success: boolean; error?: string }>;
  pause(): Promise<{ success: boolean; error?: string }>;
  next(): Promise<{ success: boolean; error?: string }>;
  previous(): Promise<{ success: boolean; error?: string }>;
}

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

export const EMPTY_PLAYBACK_STATE: SpotifyPlaybackState = {
  isPlaying: false,
  track: null,
  progressMs: 0,
  device: null,
  shuffleState: false,
  repeatState: "off",
  timestamp: Date.now(),
};

export interface UseSpotifyPlaybackState {
  isReady: boolean;
  isConnected: boolean;
  hasConnected: boolean;
  playback: SpotifyPlaybackState;
  error: string | null;
}

export interface UseSpotifyPlaybackControls {
  play(): void;
  pause(): void;
  next(): void;
  previous(): void;
}

export interface UseSpotifyPlaybackResult {
  state: UseSpotifyPlaybackState;
  controls: UseSpotifyPlaybackControls;
}

const POLL_INTERVAL_MS = 3000;

export function useSpotifyPlayback(host?: SpotifyHostAPI): UseSpotifyPlaybackResult {
  const [state, setState] = useState<UseSpotifyPlaybackState>({
    isReady: false,
    isConnected: false,
    hasConnected: false,
    playback: EMPTY_PLAYBACK_STATE,
    error: null,
  });

  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPlaybackState = useCallback(async () => {
    if (!mountedRef.current || !host) return;

    try {
      const playback = await host.getPlaybackState();
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
        setState((prev) => ({
          ...prev,
          isReady: true,
          playback: prev.hasConnected ? { ...EMPTY_PLAYBACK_STATE, timestamp: Date.now() } : prev.playback,
        }));
      }
    } catch (error) {
      console.error("[useSpotifyPlayback] Failed to fetch playback state", error);
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to fetch playback",
        }));
      }
    }
  }, [host]);

  useEffect(() => {
    mountedRef.current = true;

    if (!host) {
      return () => {
        mountedRef.current = false;
      };
    }

    const api = host;

    async function start() {
      const [enabled, authenticated] = await Promise.all([
        api.isEnabled(),
        api.isAuthenticated(),
      ]);

      if (!mountedRef.current || !enabled || !authenticated) {
        return;
      }

      await fetchPlaybackState();

      pollRef.current = setInterval(() => {
        if (mountedRef.current) {
          void fetchPlaybackState();
        }
      }, POLL_INTERVAL_MS);
    }

    void start();

    return () => {
      mountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [host, fetchPlaybackState]);

  const controls: UseSpotifyPlaybackControls = useMemo(() => {
    if (!host) {
      return createNoopControls();
    }

    return {
      play: async () => {
        const result = await host.play();
        if (!result.success) {
          console.error("[useSpotifyPlayback] Play failed", result.error);
        }
        await fetchPlaybackState();
      },
      pause: async () => {
        const result = await host.pause();
        if (!result.success) {
          console.error("[useSpotifyPlayback] Pause failed", result.error);
        }
        await fetchPlaybackState();
      },
      next: async () => {
        const result = await host.next();
        if (!result.success) {
          console.error("[useSpotifyPlayback] Next failed", result.error);
        }
        await fetchPlaybackState();
      },
      previous: async () => {
        const result = await host.previous();
        if (!result.success) {
          console.error("[useSpotifyPlayback] Previous failed", result.error);
        }
        await fetchPlaybackState();
      },
    };
  }, [host, fetchPlaybackState]);

  return { state, controls };
}

function createNoopControls(): UseSpotifyPlaybackControls {
  return {
    play: () => undefined,
    pause: () => undefined,
    next: () => undefined,
    previous: () => undefined,
  };
}
