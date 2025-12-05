/**
 * Spotify Extension Types
 *
 * Type definitions for Spotify integration including tracks, playback state,
 * and API responses.
 */

// =============================================================================
// Track & Artist Types
// =============================================================================

/**
 * Spotify image object
 */
export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

/**
 * Simplified artist representation
 */
export interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
}

/**
 * Simplified album representation
 */
export interface SpotifyAlbum {
  id: string;
  name: string;
  uri: string;
  images: SpotifyImage[];
}

/**
 * Track representation used throughout the extension
 */
export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  durationMs: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  /** Primary artwork URL (convenience accessor) */
  artworkUrl: string | null;
}

// =============================================================================
// Playback State Types
// =============================================================================

/**
 * Device information
 */
export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  volumePercent: number;
}

/**
 * Current playback state
 */
export interface SpotifyPlaybackState {
  /** Whether playback is active */
  isPlaying: boolean;
  /** Current track (null if nothing playing) */
  track: SpotifyTrack | null;
  /** Progress in milliseconds */
  progressMs: number;
  /** Current device */
  device: SpotifyDevice | null;
  /** Shuffle state */
  shuffleState: boolean;
  /** Repeat state: off, track, context */
  repeatState: "off" | "track" | "context";
  /** Timestamp when state was captured */
  timestamp: number;
}

/**
 * Empty/disconnected playback state
 */
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
// Search Types
// =============================================================================

/**
 * Search result item types
 */
export type SpotifySearchType = "track" | "album" | "artist" | "playlist";

/**
 * Simplified playlist representation
 */
export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  description: string | null;
  images: SpotifyImage[];
  owner: {
    id: string;
    displayName: string | null;
  };
  tracksTotal: number;
}

/**
 * Search results
 */
export interface SpotifySearchResults {
  tracks: SpotifyTrack[];
  albums: SpotifyAlbum[];
  artists: SpotifyArtist[];
  playlists: SpotifyPlaylist[];
}

// =============================================================================
// Auth Types
// =============================================================================

/**
 * OAuth token data
 */
export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

/**
 * Connection status
 */
export type SpotifyConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/**
 * Overall Spotify state for the extension
 */
export interface SpotifyState {
  /** Connection/auth status */
  connectionStatus: SpotifyConnectionStatus;
  /** Current playback state */
  playback: SpotifyPlaybackState;
  /** Error message if status is 'error' */
  error: string | null;
  /** Whether we have valid tokens */
  isAuthenticated: boolean;
}

/**
 * Initial/empty Spotify state
 */
export const INITIAL_SPOTIFY_STATE: SpotifyState = {
  connectionStatus: "disconnected",
  playback: EMPTY_PLAYBACK_STATE,
  error: null,
  isAuthenticated: false,
};

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event types emitted by SpotifyManager
 */
export type SpotifyEventType =
  | "spotify:connected"
  | "spotify:disconnected"
  | "spotify:playback-changed"
  | "spotify:error"
  | "spotify:token-refreshed";

/**
 * Event payload
 */
export interface SpotifyEvent {
  type: SpotifyEventType;
  state: SpotifyState;
  timestamp: number;
}

/**
 * Event callback
 */
export type SpotifyEventCallback = (event: SpotifyEvent) => void;

// =============================================================================
// Tool Argument Types
// =============================================================================

export interface PlaySpotifyArgs {
  /** Track, album, artist, or playlist URI to play */
  uri?: string;
  /** Device ID to play on (optional) */
  deviceId?: string;
}

export interface PauseSpotifyArgs {
  /** Device ID (optional) */
  deviceId?: string;
}

export interface SearchSpotifyArgs {
  /** Search query */
  query: string;
  /** Types to search for */
  types?: SpotifySearchType[];
  /** Max results per type (default: 5) */
  limit?: number;
}

export interface GetSpotifyPlaybackArgs {
  // No arguments needed
}

export interface SkipSpotifyArgs {
  /** Direction to skip */
  direction: "next" | "previous";
  /** Device ID (optional) */
  deviceId?: string;
}

// =============================================================================
// Handler Types
// =============================================================================

/**
 * Result type for tool execution
 */
export interface SpotifyToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Handler interface for Spotify tool execution
 */
export interface SpotifyToolHandler {
  playSpotify(args: PlaySpotifyArgs): Promise<SpotifyToolResult> | SpotifyToolResult;
  pauseSpotify(args: PauseSpotifyArgs): Promise<SpotifyToolResult> | SpotifyToolResult;
  searchSpotify(args: SearchSpotifyArgs): Promise<SpotifyToolResult> | SpotifyToolResult;
  getSpotifyPlayback(args: GetSpotifyPlaybackArgs): Promise<SpotifyToolResult> | SpotifyToolResult;
  skipSpotify(args: SkipSpotifyArgs): Promise<SpotifyToolResult> | SpotifyToolResult;
}

// =============================================================================
// Extension Options
// =============================================================================

export interface SpotifyExtensionOptions {
  /** Handler that executes the Spotify tools */
  handler: SpotifyToolHandler;
  /** Optional extension ID override (default: "spotify") */
  id?: string;
}

export interface StatefulSpotifyExtensionOptions {
  /** Optional extension ID override (default: "spotify") */
  id?: string;
  /** Spotify Client ID */
  clientId: string;
  /** Redirect URI for OAuth (PKCE flow - no client secret needed) */
  redirectUri: string;
  /** Initial tokens (if already authenticated) */
  initialTokens?: SpotifyTokens;
  /** Callback when state changes */
  onStateChange?: SpotifyEventCallback;
}
