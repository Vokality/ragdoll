/**
 * Spotify Extension Types
 */

// =============================================================================
// Track & Artist Types
// =============================================================================

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  uri: string;
  images: SpotifyImage[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  durationMs: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  artworkUrl: string | null;
}

// =============================================================================
// Playback State Types
// =============================================================================

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
// Search Types
// =============================================================================

export type SpotifySearchType = "track" | "album" | "artist" | "playlist";

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

export interface SpotifySearchResults {
  tracks: SpotifyTrack[];
  albums: SpotifyAlbum[];
  artists: SpotifyArtist[];
  playlists: SpotifyPlaylist[];
}

// =============================================================================
// Tool Argument Types
// =============================================================================

export interface PlaySpotifyArgs {
  uri?: string;
  deviceId?: string;
}

export interface PauseSpotifyArgs {
  deviceId?: string;
}

export interface SearchSpotifyArgs {
  query: string;
  types?: SpotifySearchType[];
  limit?: number;
}

export interface GetSpotifyPlaybackArgs {}

export interface SkipSpotifyArgs {
  direction: "next" | "previous";
  deviceId?: string;
}
