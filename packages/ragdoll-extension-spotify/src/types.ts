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
  type: "track";
  id: string;
  name: string;
  uri: string;
  durationMs: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  artworkUrl: string | null;
}

export interface SpotifyShow {
  id: string;
  name: string;
  uri: string;
}

export interface SpotifyEpisode {
  type: "episode";
  id: string;
  name: string;
  uri: string;
  durationMs: number;
  show: SpotifyShow;
  artworkUrl: string | null;
}

export type SpotifyPlaybackItem = SpotifyTrack | SpotifyEpisode;

// =============================================================================
// Playback State Types
// =============================================================================

export interface SpotifyDevice {
  id: string | null;
  name: string;
  type: string;
  isActive: boolean;
  volumePercent: number | null;
}

export interface SpotifyPlaybackState {
  isPlaying: boolean;
  item: SpotifyPlaybackItem | null;
  progressMs: number;
  device: SpotifyDevice | null;
  shuffleState: boolean;
  repeatState: "off" | "track" | "context";
  timestamp: number;
}

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
  itemsTotal: number | null;
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
