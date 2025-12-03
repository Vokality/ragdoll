/**
 * Spotify Extension UI Slot
 *
 * Provides a UI slot for the Spotify extension that displays:
 * - Setup form (client ID input) when not configured
 * - Connect button when configured but not authenticated
 * - Playback info and controls when connected
 */

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import {
  createSlotState,
  type ExtensionUISlot,
  type MutableSlotStateStore,
} from "../../ui/index.js";
import type { SpotifyPlaybackState, SpotifyTrack } from "./types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Controls interface for playback actions.
 */
export interface SpotifyPlaybackControls {
  /** Resume or start playback */
  play(): void;
  /** Pause playback */
  pause(): void;
  /** Skip to next track */
  next(): void;
  /** Skip to previous track */
  previous(): void;
}

/**
 * Setup/auth actions for the Spotify panel
 */
export interface SpotifySetupActions {
  /** Get stored client ID */
  getClientId(): Promise<string | null>;
  /** Save client ID and reload */
  saveClientId(clientId: string): Promise<void>;
  /** Check if Spotify is enabled (has client ID) */
  isEnabled(): Promise<boolean>;
  /** Check if authenticated */
  isAuthenticated(): Promise<boolean>;
  /** Get OAuth authorization URL */
  getAuthUrl(): Promise<string | null>;
  /** Disconnect and clear tokens */
  disconnect(): Promise<void>;
  /** Get current playback state */
  getPlaybackState(): Promise<SpotifyPlaybackState | null>;
}

export interface SpotifyUISlotOptions {
  /** Playback controls */
  controls: SpotifyPlaybackControls;
  /** Setup/auth actions */
  setupActions: SpotifySetupActions;
  /** Current playback state */
  playback: SpotifyPlaybackState;
  /** Whether Spotify has ever been connected in this session */
  hasConnected?: boolean;
  /** Connection error message, if any */
  error?: string | null;
  /** Optional slot ID (default: "spotify.main") */
  id?: string;
  /** Optional slot label (default: "Spotify") */
  label?: string;
  /** Optional slot priority (default: 80) */
  priority?: number;
}

export interface SpotifyUISlotResult {
  /** The UI slot definition */
  slot: ExtensionUISlot;
  /** The slot state store (for updating state) */
  stateStore: MutableSlotStateStore;
}

// =============================================================================
// Helpers
// =============================================================================

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatArtists(track: SpotifyTrack): string {
  return track.artists.map((a) => a.name).join(", ");
}

// =============================================================================
// Spotify Panel Component
// =============================================================================

export interface SpotifyPanelProps {
  onClose: () => void;
  controls: SpotifyPlaybackControls;
  setupActions: SpotifySetupActions;
  playback: SpotifyPlaybackState;
  error: string | null;
}

function SpotifyPanelComponent({
  onClose: _onClose,
  controls,
  setupActions,
  playback: initialPlayback,
  error: initialError,
}: SpotifyPanelProps) {
  const [clientId, setClientId] = useState("");
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [playback, setPlayback] = useState<SpotifyPlaybackState>(initialPlayback);
  
  // Refs for smooth progress updates without re-renders
  const progressRef = useRef<HTMLDivElement>(null);
  const timeCurrentRef = useRef<HTMLSpanElement>(null);
  // Track the "base" progress and when we received it, for smooth local counting
  const progressBaseRef = useRef({ progressMs: initialPlayback.progressMs, timestamp: Date.now() });

  // Suppress unused var warning - available for future use
  void _onClose;
  
  // Update progress bar via DOM refs (no re-render)
  const updateProgressDisplay = useCallback((progressMs: number, durationMs: number) => {
    const clampedProgress = Math.min(progressMs, durationMs);
    if (progressRef.current) {
      progressRef.current.style.width = `${(clampedProgress / durationMs) * 100}%`;
    }
    if (timeCurrentRef.current) {
      timeCurrentRef.current.textContent = formatTime(clampedProgress);
    }
  }, []);

  // Sync local playback + progress baseline whenever upstream props change
  useEffect(() => {
    setPlayback(initialPlayback);
    progressBaseRef.current = { progressMs: initialPlayback.progressMs, timestamp: Date.now() };

    if (initialPlayback.track) {
      updateProgressDisplay(initialPlayback.progressMs, initialPlayback.track.durationMs);
    } else {
      if (progressRef.current) {
        progressRef.current.style.width = "0%";
      }
      if (timeCurrentRef.current) {
        timeCurrentRef.current.textContent = "0:00";
      }
    }
  }, [initialPlayback, updateProgressDisplay]);

  // Load status and playback on mount
  useEffect(() => {
    async function loadStatus() {
      const [enabled, authenticated, storedClientId] = await Promise.all([
        setupActions.isEnabled(),
        setupActions.isAuthenticated(),
        setupActions.getClientId(),
      ]);
      setIsEnabled(enabled);
      setIsAuthenticated(authenticated);
      if (storedClientId) setClientId(storedClientId);

      // If authenticated, fetch fresh playback state
      if (authenticated) {
        const freshPlayback = await setupActions.getPlaybackState();
        if (freshPlayback) {
          setPlayback(freshPlayback);
          progressBaseRef.current = { progressMs: freshPlayback.progressMs, timestamp: Date.now() };
        }
      }
    }
    loadStatus();
  }, [setupActions]);

  // Smooth local progress counter (ticks every second when playing)
  useEffect(() => {
    if (!playback.isPlaying || !playback.track) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - progressBaseRef.current.timestamp;
      const currentProgress = progressBaseRef.current.progressMs + elapsed;
      updateProgressDisplay(currentProgress, playback.track!.durationMs);
    }, 1000);

    return () => clearInterval(interval);
  }, [playback.isPlaying, playback.track, updateProgressDisplay]);

  // Poll API less frequently - only to sync track/play state changes
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(async () => {
      const freshPlayback = await setupActions.getPlaybackState();
      if (freshPlayback) {
        setPlayback((prev) => {
          const trackChanged = prev.track?.id !== freshPlayback.track?.id;
          const playStateChanged = prev.isPlaying !== freshPlayback.isPlaying;
          
          // Only update state (trigger re-render) if track or play state changed
          if (trackChanged || playStateChanged) {
            // Reset progress base for the new state
            progressBaseRef.current = { progressMs: freshPlayback.progressMs, timestamp: Date.now() };
            return freshPlayback;
          }
          
          // Silently sync progress base (no re-render) to prevent drift
          progressBaseRef.current = { progressMs: freshPlayback.progressMs, timestamp: Date.now() };
          return prev;
        });
      }
    }, 5000); // Poll every 5s instead of 3s since we count locally

    return () => clearInterval(interval);
  }, [isAuthenticated, setupActions]);

  const handleSaveClientId = async () => {
    if (!clientId.trim()) {
      setError("Please enter a Client ID");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await setupActions.saveClientId(clientId.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const authUrl = await setupActions.getAuthUrl();
      if (authUrl) {
        window.open(authUrl, "_blank");
      } else {
        setError("Failed to get authorization URL");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeClientId = async () => {
    setClientId("");
    await setupActions.saveClientId("");
  };

  // Loading state - centered in the container
  if (isEnabled === null || isAuthenticated === null) {
    return (
      <div style={{ ...styles.container, ...styles.loadingContainer }}>
        <p style={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  // Not configured - show client ID input
  if (!isEnabled) {
    return (
      <div style={styles.container}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Setup Spotify</h3>
          <p style={styles.description}>
            Enter your Spotify Client ID to enable music integration.
            Get one from the{" "}
            <a
              href="https://developer.spotify.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              Spotify Developer Dashboard
            </a>
            .
          </p>
          <p style={styles.hint}>
            Create an app and add <code style={styles.code}>ragdoll://spotify-callback</code> as a Redirect URI.
          </p>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Enter your Spotify Client ID"
              style={styles.input}
              disabled={isLoading}
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button
            onClick={handleSaveClientId}
            disabled={isLoading || !clientId.trim()}
            style={{
              ...styles.button,
              ...styles.primaryButton,
              opacity: isLoading || !clientId.trim() ? 0.5 : 1,
            }}
          >
            {isLoading ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      </div>
    );
  }

  // Configured but not authenticated - show connect button
  if (!isAuthenticated) {
    return (
      <div style={styles.container}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Connect Spotify</h3>
          <p style={styles.description}>
            Click below to authorize Ragdoll to access your Spotify account.
          </p>

          {error && <p style={styles.error}>{error}</p>}

          <button
            onClick={handleConnect}
            disabled={isLoading}
            style={{
              ...styles.button,
              ...styles.spotifyButton,
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {isLoading ? "Connecting..." : "Connect with Spotify"}
          </button>

          <button
            onClick={handleChangeClientId}
            style={{ ...styles.button, ...styles.textButton }}
          >
            Change Client ID
          </button>
        </div>
      </div>
    );
  }

  // Authenticated - show playback info
  const { track, isPlaying, progressMs } = playback;

  return (
    <div style={styles.container}>
      {track ? (
        <div style={styles.nowPlaying}>
          {track.artworkUrl && (
            <img
              src={track.artworkUrl}
              alt={`${track.album.name} artwork`}
              style={styles.artwork}
            />
          )}
          <div style={styles.trackInfo}>
            <p style={styles.trackName}>{track.name}</p>
            <p style={styles.artistName}>{formatArtists(track)}</p>
            <p style={styles.albumName}>{track.album.name}</p>
          </div>

          {/* Progress bar */}
          <div style={styles.progressContainer}>
            <div
              ref={progressRef}
              style={{
                ...styles.progressBar,
                width: `${(progressMs / track.durationMs) * 100}%`,
              }}
            />
          </div>
          <div style={styles.timeInfo}>
            <span ref={timeCurrentRef}>{formatTime(progressMs)}</span>
            <span>{formatTime(track.durationMs)}</span>
          </div>

          {/* Playback controls */}
          <div style={styles.controls}>
            <button onClick={() => controls.previous()} style={styles.controlButton}>
              ⏮
            </button>
            <button
              onClick={() => (isPlaying ? controls.pause() : controls.play())}
              style={{ ...styles.controlButton, ...styles.playButton }}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button onClick={() => controls.next()} style={styles.controlButton}>
              ⏭
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.section}>
          <p style={styles.emptyState}>Nothing playing</p>
          <p style={styles.description}>
            Start playing music from any Spotify app to see it here.
          </p>
        </div>
      )}

    </div>
  );
}

// =============================================================================
// UI Slot Factory
// =============================================================================

/**
 * Create a UI slot for the Spotify extension.
 *
 * Shows different UI based on connection state:
 * - Setup form when not configured
 * - Connect button when not authenticated
 * - Playback controls when connected
 */
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

// =============================================================================
// Styles
// =============================================================================

const styles: Record<string, CSSProperties> = {
  container: {
    padding: "20px",
    minHeight: "300px", // Prevent resize jitter during async loading
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "var(--text-primary, #f1f5f9)",
    margin: 0,
  },
  description: {
    fontSize: "14px",
    color: "var(--text-muted, #94a3b8)",
    margin: 0,
    lineHeight: 1.5,
  },
  hint: {
    fontSize: "12px",
    color: "var(--text-dim, #64748b)",
    margin: 0,
    lineHeight: 1.5,
  },
  code: {
    backgroundColor: "var(--bg-tertiary, #334155)",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "11px",
  },
  link: {
    color: "var(--accent, #5a9bc4)",
    textDecoration: "none",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "500",
    color: "var(--text-muted, #94a3b8)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    padding: "12px 16px",
    fontSize: "14px",
    borderRadius: "var(--radius-md, 10px)",
    border: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
    backgroundColor: "var(--bg-glass, rgba(30, 41, 59, 0.8))",
    color: "var(--text-primary, #f1f5f9)",
    outline: "none",
  },
  error: {
    fontSize: "13px",
    color: "var(--error, #f87171)",
    margin: 0,
  },
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: "14px",
    color: "var(--text-muted, #94a3b8)",
    textAlign: "center",
  },
  button: {
    padding: "12px 20px",
    fontSize: "14px",
    fontWeight: "500",
    borderRadius: "var(--radius-md, 10px)",
    border: "none",
    cursor: "pointer",
    transition: "opacity 150ms ease",
  },
  primaryButton: {
    backgroundColor: "var(--accent, #5a9bc4)",
    color: "var(--bg-primary, #0f172a)",
  },
  spotifyButton: {
    backgroundColor: "#1DB954",
    color: "#000",
  },
  textButton: {
    backgroundColor: "transparent",
    color: "var(--text-muted, #94a3b8)",
    padding: "8px",
  },
  nowPlaying: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
  },
  artwork: {
    width: "180px",
    height: "180px",
    borderRadius: "var(--radius-md, 10px)",
    objectFit: "cover",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
  },
  trackInfo: {
    textAlign: "center",
  },
  trackName: {
    fontSize: "16px",
    fontWeight: "600",
    color: "var(--text-primary, #f1f5f9)",
    margin: "0 0 4px 0",
  },
  artistName: {
    fontSize: "14px",
    color: "var(--text-muted, #94a3b8)",
    margin: "0 0 2px 0",
  },
  albumName: {
    fontSize: "12px",
    color: "var(--text-dim, #64748b)",
    margin: 0,
  },
  progressContainer: {
    width: "100%",
    height: "4px",
    backgroundColor: "var(--bg-tertiary, #334155)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "var(--accent, #5a9bc4)",
    transition: "width 1s linear",
  },
  timeInfo: {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    fontSize: "11px",
    color: "var(--text-dim, #64748b)",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  controlButton: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    border: "none",
    backgroundColor: "var(--bg-glass, rgba(30, 41, 59, 0.8))",
    color: "var(--text-primary, #f1f5f9)",
    fontSize: "18px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: "56px",
    height: "56px",
    backgroundColor: "var(--accent, #5a9bc4)",
    color: "var(--bg-primary, #0f172a)",
    fontSize: "22px",
  },
  emptyState: {
    fontSize: "16px",
    fontWeight: "500",
    color: "var(--text-muted, #94a3b8)",
    margin: 0,
    textAlign: "center",
  },
};

// =============================================================================
// Panel Component Export (for external state management)
// =============================================================================

export { SpotifyPanelComponent };

// =============================================================================
// Convenience Export
// =============================================================================

export { createSpotifyUISlot as createSpotifySlot };
