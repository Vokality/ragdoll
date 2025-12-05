/**
 * Spotify Extension - Provides music playback tools for AI assistants.
 *
 * Tools:
 * - playSpotify: Start or resume playback
 * - pauseSpotify: Pause playback
 * - skipSpotify: Skip to next or previous track
 * - searchSpotify: Search for tracks, albums, artists, or playlists
 * - getSpotifyPlayback: Get current playback state
 *
 * This extension requires the host to provide OAuth capability.
 * Configure OAuth requirements in package.json.
 */

import { createExtension } from "@vokality/ragdoll-extensions/core";
import type {
  ExtensionTool,
  ValidationResult,
  RagdollExtension,
  HostOAuthCapability,
} from "@vokality/ragdoll-extensions/core";
import type {
  SpotifyPlaybackState,
  SpotifySearchResults,
  SpotifyTrack,
  SpotifyArtist,
  SpotifyAlbum,
  PlaySpotifyArgs,
  PauseSpotifyArgs,
  SkipSpotifyArgs,
  SearchSpotifyArgs,
} from "./types.js";

// Re-export types
export type {
  SpotifyImage,
  SpotifyArtist,
  SpotifyAlbum,
  SpotifyTrack,
  SpotifyDevice,
  SpotifyPlaybackState,
  SpotifyPlaylist,
  SpotifySearchResults,
  PlaySpotifyArgs,
  PauseSpotifyArgs,
  SearchSpotifyArgs,
  GetSpotifyPlaybackArgs,
  SkipSpotifyArgs,
} from "./types.js";

export { EMPTY_PLAYBACK_STATE } from "./types.js";

// =============================================================================
// Validators
// =============================================================================

function validatePlay(args: Record<string, unknown>): ValidationResult {
  if (args.uri !== undefined && typeof args.uri !== "string") {
    return { valid: false, error: "uri must be a string" };
  }
  if (args.deviceId !== undefined && typeof args.deviceId !== "string") {
    return { valid: false, error: "deviceId must be a string" };
  }
  return { valid: true };
}

function validatePause(args: Record<string, unknown>): ValidationResult {
  if (args.deviceId !== undefined && typeof args.deviceId !== "string") {
    return { valid: false, error: "deviceId must be a string" };
  }
  return { valid: true };
}

function validateSkip(args: Record<string, unknown>): ValidationResult {
  if (!args.direction || !["next", "previous"].includes(args.direction as string)) {
    return { valid: false, error: "direction must be 'next' or 'previous'" };
  }
  if (args.deviceId !== undefined && typeof args.deviceId !== "string") {
    return { valid: false, error: "deviceId must be a string" };
  }
  return { valid: true };
}

function validateSearch(args: Record<string, unknown>): ValidationResult {
  if (!args.query || typeof args.query !== "string") {
    return { valid: false, error: "query is required and must be a string" };
  }
  if (args.types !== undefined) {
    if (!Array.isArray(args.types)) {
      return { valid: false, error: "types must be an array" };
    }
    const validTypes = ["track", "album", "artist", "playlist"];
    for (const t of args.types) {
      if (!validTypes.includes(t as string)) {
        return { valid: false, error: `Invalid type: ${t}. Valid types: ${validTypes.join(", ")}` };
      }
    }
  }
  if (args.limit !== undefined && (typeof args.limit !== "number" || args.limit < 1 || args.limit > 50)) {
    return { valid: false, error: "limit must be a number between 1 and 50" };
  }
  return { valid: true };
}

// =============================================================================
// Tool Definitions
// =============================================================================

function createSpotifyTools(api: SpotifyApiClient): ExtensionTool[] {
  return [
    {
      definition: {
        type: "function",
        function: {
          name: "playSpotify",
          description: "Start or resume Spotify playback. Optionally specify a track, album, artist, or playlist URI to play.",
          parameters: {
            type: "object",
            properties: {
              uri: {
                type: "string",
                description: "Spotify URI to play (e.g., 'spotify:track:xxx', 'spotify:album:xxx'). If omitted, resumes current playback.",
              },
              deviceId: {
                type: "string",
                description: "Device ID to play on. If omitted, uses the active device.",
              },
            },
          },
        },
      },
      handler: async (args) => {
        const { uri, deviceId } = args as PlaySpotifyArgs;
        try {
          await api.play({ uri, deviceId });
          const playback = await api.getPlaybackState();
          return {
            success: true,
            data: {
              message: uri ? `Now playing: ${uri}` : "Playback resumed",
              playback,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to play",
          };
        }
      },
      validate: validatePlay,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "pauseSpotify",
          description: "Pause Spotify playback.",
          parameters: {
            type: "object",
            properties: {
              deviceId: {
                type: "string",
                description: "Device ID to pause. If omitted, pauses the active device.",
              },
            },
          },
        },
      },
      handler: async (args) => {
        const { deviceId } = args as PauseSpotifyArgs;
        try {
          await api.pause(deviceId);
          return { success: true, data: { message: "Playback paused" } };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to pause",
          };
        }
      },
      validate: validatePause,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "skipSpotify",
          description: "Skip to the next or previous track.",
          parameters: {
            type: "object",
            properties: {
              direction: {
                type: "string",
                enum: ["next", "previous"],
                description: "Direction to skip: 'next' or 'previous'.",
              },
              deviceId: {
                type: "string",
                description: "Device ID. If omitted, uses the active device.",
              },
            },
            required: ["direction"],
          },
        },
      },
      handler: async (args) => {
        const { direction, deviceId } = args as unknown as SkipSpotifyArgs;
        try {
          if (direction === "next") {
            await api.skipToNext(deviceId);
          } else {
            await api.skipToPrevious(deviceId);
          }
          const playback = await api.getPlaybackState();
          return {
            success: true,
            data: { message: `Skipped to ${direction} track`, playback },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to skip",
          };
        }
      },
      validate: validateSkip,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "searchSpotify",
          description: "Search Spotify for tracks, albums, artists, or playlists.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query (e.g., artist name, song title, album name).",
              },
              types: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["track", "album", "artist", "playlist"],
                },
                description: "Types to search for. Defaults to ['track'].",
              },
              limit: {
                type: "number",
                description: "Maximum results per type (1-50). Defaults to 5.",
              },
            },
            required: ["query"],
          },
        },
      },
      handler: async (args) => {
        const { query, types, limit } = args as unknown as SearchSpotifyArgs;
        try {
          const results = await api.search(query, types ?? ["track"], limit ?? 5);
          return { success: true, data: results };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Search failed",
          };
        }
      },
      validate: validateSearch,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "getSpotifyPlayback",
          description: "Get the current Spotify playback state including the currently playing track, progress, and device info.",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
      handler: async () => {
        try {
          const playback = await api.getPlaybackState();
          return { success: true, data: playback };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to get playback state",
          };
        }
      },
      validate: () => ({ valid: true }),
    },
  ];
}

// =============================================================================
// Extension Factory
// =============================================================================

/**
 * Create the Spotify extension.
 *
 * This extension requires the host to provide OAuth capability.
 * The host handles OAuth flow and token management based on
 * the oauth configuration in package.json.
 */
export function createSpotifyExtension(): RagdollExtension {
  return createExtension({
    id: "spotify",
    name: "Spotify",
    version: "1.0.0",
    requiredCapabilities: ["oauth"],

    createRuntime: async (host) => {
      if (!host.oauth) {
        throw new Error(
          "Spotify extension requires OAuth capability. " +
          "Ensure the host is configured to provide OAuth for this extension."
        );
      }

      const api = createSpotifyApiClient(host.oauth);

      return {
        tools: createSpotifyTools(api),
      };
    },
  });
}

// Default export for extension loader
export default createSpotifyExtension;

// =============================================================================
// Spotify API Client
// =============================================================================

interface SpotifyApiClient {
  play(options?: { uri?: string; deviceId?: string }): Promise<void>;
  pause(deviceId?: string): Promise<void>;
  skipToNext(deviceId?: string): Promise<void>;
  skipToPrevious(deviceId?: string): Promise<void>;
  getPlaybackState(): Promise<SpotifyPlaybackState>;
  search(query: string, types: string[], limit: number): Promise<SpotifySearchResults>;
}

function createSpotifyApiClient(oauth: HostOAuthCapability): SpotifyApiClient {
  const EMPTY_PLAYBACK: SpotifyPlaybackState = {
    isPlaying: false,
    track: null,
    progressMs: 0,
    device: null,
    shuffleState: false,
    repeatState: "off",
    timestamp: Date.now(),
  };

  async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const accessToken = await oauth.getAccessToken();
    if (!accessToken) {
      throw new Error("Not authenticated with Spotify");
    }

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 401) {
      throw new Error("Spotify authentication expired");
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Spotify API error: ${response.status} - ${error}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  function mapTrack(track: ApiTrack): SpotifyTrack {
    return {
      id: track.id,
      name: track.name,
      uri: track.uri,
      durationMs: track.duration_ms,
      artists: track.artists.map(mapArtist),
      album: mapAlbum(track.album),
      artworkUrl: track.album.images[0]?.url ?? null,
    };
  }

  function mapArtist(artist: ApiArtist): SpotifyArtist {
    return { id: artist.id, name: artist.name, uri: artist.uri };
  }

  function mapAlbum(album: ApiAlbum): SpotifyAlbum {
    return {
      id: album.id,
      name: album.name,
      uri: album.uri,
      images: album.images.map((img) => ({
        url: img.url,
        height: img.height,
        width: img.width,
      })),
    };
  }

  return {
    async play(options = {}) {
      const { uri, deviceId } = options;
      const params = deviceId ? `?device_id=${deviceId}` : "";
      const body: Record<string, unknown> = {};

      if (uri) {
        if (uri.includes(":track:")) {
          body.uris = [uri];
        } else {
          body.context_uri = uri;
        }
      }

      await apiRequest(`/me/player/play${params}`, {
        method: "PUT",
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });
    },

    async pause(deviceId) {
      const params = deviceId ? `?device_id=${deviceId}` : "";
      await apiRequest(`/me/player/pause${params}`, { method: "PUT" });
    },

    async skipToNext(deviceId) {
      const params = deviceId ? `?device_id=${deviceId}` : "";
      await apiRequest(`/me/player/next${params}`, { method: "POST" });
    },

    async skipToPrevious(deviceId) {
      const params = deviceId ? `?device_id=${deviceId}` : "";
      await apiRequest(`/me/player/previous${params}`, { method: "POST" });
    },

    async getPlaybackState(): Promise<SpotifyPlaybackState> {
      try {
        const data = await apiRequest<ApiPlaybackState | null>("/me/player");
        if (!data) return EMPTY_PLAYBACK;

        return {
          isPlaying: data.is_playing,
          track: data.item ? mapTrack(data.item) : null,
          progressMs: data.progress_ms ?? 0,
          device: data.device
            ? {
                id: data.device.id,
                name: data.device.name,
                type: data.device.type,
                isActive: data.device.is_active,
                volumePercent: data.device.volume_percent,
              }
            : null,
          shuffleState: data.shuffle_state,
          repeatState: data.repeat_state,
          timestamp: Date.now(),
        };
      } catch {
        return EMPTY_PLAYBACK;
      }
    },

    async search(query, types, limit): Promise<SpotifySearchResults> {
      const params = new URLSearchParams({
        q: query,
        type: types.join(","),
        limit: limit.toString(),
      });

      const data = await apiRequest<ApiSearchResponse>(`/search?${params.toString()}`);

      return {
        tracks: data.tracks?.items.map(mapTrack) ?? [],
        albums: data.albums?.items.map(mapAlbum) ?? [],
        artists: data.artists?.items.map(mapArtist) ?? [],
        playlists: data.playlists?.items.map((p) => ({
          id: p.id,
          name: p.name,
          uri: p.uri,
          description: p.description,
          images: p.images.map((img) => ({
            url: img.url,
            height: img.height,
            width: img.width,
          })),
          owner: { id: p.owner.id, displayName: p.owner.display_name },
          tracksTotal: p.tracks.total,
        })) ?? [],
      };
    },
  };
}

// =============================================================================
// Spotify API Types (internal)
// =============================================================================

interface ApiImage {
  url: string;
  height: number | null;
  width: number | null;
}

interface ApiArtist {
  id: string;
  name: string;
  uri: string;
}

interface ApiAlbum {
  id: string;
  name: string;
  uri: string;
  images: ApiImage[];
}

interface ApiTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: ApiArtist[];
  album: ApiAlbum;
}

interface ApiDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

interface ApiPlaylist {
  id: string;
  name: string;
  uri: string;
  description: string | null;
  images: ApiImage[];
  owner: { id: string; display_name: string | null };
  tracks: { total: number };
}

interface ApiPlaybackState {
  is_playing: boolean;
  item: ApiTrack | null;
  progress_ms: number;
  device: ApiDevice | null;
  shuffle_state: boolean;
  repeat_state: "off" | "track" | "context";
}

interface ApiSearchResponse {
  tracks?: { items: ApiTrack[] };
  albums?: { items: ApiAlbum[] };
  artists?: { items: ApiArtist[] };
  playlists?: { items: ApiPlaylist[] };
}
