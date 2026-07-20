/** Spotify item types that can be resolved locally for playback. */
export type SpotifySearchType = "track" | "album" | "artist" | "playlist";

export type SpotifyPlaybackStatus = "playing" | "paused" | "idle";

export interface SpotifyTrackSummary {
  type: "track";
  title: string;
  artists: string[];
}

export interface SpotifyEpisodeSummary {
  type: "episode";
  title: string;
  show: string;
}

export interface SpotifyCurrentPlayback {
  status: SpotifyPlaybackStatus;
  item: SpotifyTrackSummary | SpotifyEpisodeSummary | null;
}

export interface PlaySpotifyArgs {
  query?: string;
  type?: SpotifySearchType;
}

export type PauseSpotifyArgs = Record<string, never>;

export interface SkipSpotifyArgs {
  direction: "next" | "previous";
}

export type GetSpotifyCurrentPlaybackArgs = Record<string, never>;
