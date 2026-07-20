import { z, type HostOAuthCapability } from "@vokality/ragdoll-extensions";
import type {
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyEpisode,
  SpotifyPlaybackItem,
  SpotifyPlaybackState,
  SpotifySearchResults,
  SpotifyTrack,
} from "./types.js";

const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";

const apiImageSchema = z.object({
  url: z.string().url(),
  height: z.number().nullable(),
  width: z.number().nullable(),
});
const apiArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
});
const apiAlbumSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  images: z.array(apiImageSchema),
});
const apiTrackSchema = z.object({
  type: z.literal("track"),
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  duration_ms: z.number(),
  artists: z.array(apiArtistSchema),
  album: apiAlbumSchema,
});
const apiEpisodeSchema = z.object({
  type: z.literal("episode"),
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  duration_ms: z.number(),
  images: z.array(apiImageSchema),
  show: z.object({ id: z.string(), name: z.string(), uri: z.string() }),
});
const apiPlaybackStateSchema = z.object({
  is_playing: z.boolean(),
  item: z
    .discriminatedUnion("type", [apiTrackSchema, apiEpisodeSchema])
    .nullable(),
  progress_ms: z.number().nullable(),
  device: z
    .object({
      id: z.string().nullable(),
      name: z.string(),
      type: z.string(),
      is_active: z.boolean(),
      volume_percent: z.number().nullable(),
    })
    .nullable(),
  shuffle_state: z.boolean(),
  repeat_state: z.enum(["off", "track", "context"]),
  timestamp: z.number(),
});
const apiPlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  description: z.string().nullable(),
  images: z.array(apiImageSchema),
  owner: z.object({ id: z.string(), display_name: z.string().nullable() }),
  items: z.object({ total: z.number() }).optional(),
});
const apiSearchResponseSchema = z.object({
  tracks: z.object({ items: z.array(apiTrackSchema) }).optional(),
  albums: z.object({ items: z.array(apiAlbumSchema) }).optional(),
  artists: z.object({ items: z.array(apiArtistSchema) }).optional(),
  playlists: z.object({ items: z.array(apiPlaylistSchema) }).optional(),
});

type ApiArtist = z.infer<typeof apiArtistSchema>;
type ApiAlbum = z.infer<typeof apiAlbumSchema>;
type ApiTrack = z.infer<typeof apiTrackSchema>;
type ApiEpisode = z.infer<typeof apiEpisodeSchema>;

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface SpotifyApiClient {
  play(options?: { uri?: string; deviceId?: string }): Promise<void>;
  pause(deviceId?: string): Promise<void>;
  skipToNext(deviceId?: string): Promise<void>;
  skipToPrevious(deviceId?: string): Promise<void>;
  getPlaybackState(): Promise<SpotifyPlaybackState>;
  search(
    query: string,
    types: string[],
    limit: number,
  ): Promise<SpotifySearchResults>;
}

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

export function createSpotifyApiClient(
  oauth: HostOAuthCapability,
  fetchRequest: Fetch,
  now: () => number,
): SpotifyApiClient {
  async function apiRequest<T>(
    endpoint: string,
    responseSchema: z.ZodType<T> | null,
    options: RequestInit = {},
  ): Promise<T | null> {
    const accessToken = await oauth.getAccessToken();
    if (!accessToken) throw new Error("Spotify is not authenticated");

    const response = await fetchRequest(`${SPOTIFY_API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (response.status === 204) return null;
    if (!response.ok) throw await createApiError(response);
    if (!responseSchema) {
      throw new Error("Spotify API returned an unexpected response body");
    }
    return responseSchema.parse(await response.json());
  }

  return {
    async play(options = {}) {
      const body: Record<string, unknown> = {};
      if (options.uri) {
        if (options.uri.startsWith("spotify:track:")) {
          body.uris = [options.uri];
        } else if (/^spotify:(album|artist|playlist):/.test(options.uri)) {
          body.context_uri = options.uri;
        } else {
          throw new Error(
            "Spotify playback URI must identify a track, album, artist, or playlist",
          );
        }
      }
      await apiRequest(playerEndpoint("/play", options.deviceId), null, {
        method: "PUT",
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });
    },

    async pause(deviceId) {
      await apiRequest(playerEndpoint("/pause", deviceId), null, {
        method: "PUT",
      });
    },

    async skipToNext(deviceId) {
      await apiRequest(playerEndpoint("/next", deviceId), null, {
        method: "POST",
      });
    },

    async skipToPrevious(deviceId) {
      await apiRequest(playerEndpoint("/previous", deviceId), null, {
        method: "POST",
      });
    },

    async getPlaybackState() {
      const query = new URLSearchParams({ additional_types: "track,episode" });
      const data = await apiRequest(
        `/me/player?${query.toString()}`,
        apiPlaybackStateSchema,
      );
      if (!data) return emptyPlaybackState(now());

      return {
        isPlaying: data.is_playing,
        item: data.item ? mapPlaybackItem(data.item) : null,
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
        timestamp: data.timestamp,
      };
    },

    async search(query, types, limit) {
      const search = new URLSearchParams({
        q: query,
        type: types.join(","),
        limit: String(limit),
      });
      const data = await apiRequest(
        `/search?${search.toString()}`,
        apiSearchResponseSchema,
      );
      if (!data) throw new Error("Spotify search returned no response body");

      return {
        tracks: data.tracks?.items.map(mapTrack) ?? [],
        albums: data.albums?.items.map(mapAlbum) ?? [],
        artists: data.artists?.items.map(mapArtist) ?? [],
        playlists:
          data.playlists?.items.map((playlist) => ({
            id: playlist.id,
            name: playlist.name,
            uri: playlist.uri,
            description: playlist.description,
            images: playlist.images,
            owner: {
              id: playlist.owner.id,
              displayName: playlist.owner.display_name,
            },
            itemsTotal: playlist.items?.total ?? null,
          })) ?? [],
      };
    },
  };
}

function playerEndpoint(action: string, deviceId?: string): string {
  const query = new URLSearchParams();
  if (deviceId) query.set("device_id", deviceId);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return `/me/player${action}${suffix}`;
}

function emptyPlaybackState(timestamp: number): SpotifyPlaybackState {
  return {
    isPlaying: false,
    item: null,
    progressMs: 0,
    device: null,
    shuffleState: false,
    repeatState: "off",
    timestamp,
  };
}

function mapPlaybackItem(item: ApiTrack | ApiEpisode): SpotifyPlaybackItem {
  if (item.type === "track") return mapTrack(item);
  if (item.type === "episode") return mapEpisode(item);
  throw new Error("Spotify returned an unsupported playback item type");
}

function mapTrack(track: ApiTrack): SpotifyTrack {
  return {
    type: "track",
    id: track.id,
    name: track.name,
    uri: track.uri,
    durationMs: track.duration_ms,
    artists: track.artists.map(mapArtist),
    album: mapAlbum(track.album),
    artworkUrl: track.album.images[0]?.url ?? null,
  };
}

function mapEpisode(episode: ApiEpisode): SpotifyEpisode {
  return {
    type: "episode",
    id: episode.id,
    name: episode.name,
    uri: episode.uri,
    durationMs: episode.duration_ms,
    show: {
      id: episode.show.id,
      name: episode.show.name,
      uri: episode.show.uri,
    },
    artworkUrl: episode.images[0]?.url ?? null,
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
    images: album.images,
  };
}

async function createApiError(response: Response): Promise<SpotifyApiError> {
  const retryAfter = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfter
    ? Number.parseInt(retryAfter, 10)
    : undefined;
  const providerMessage = await readProviderError(response);
  if (response.status === 401) {
    return new SpotifyApiError("Spotify authentication expired", 401);
  }
  if (response.status === 429) {
    return new SpotifyApiError(
      retryAfterSeconds === undefined
        ? "Spotify rate limit exceeded"
        : `Spotify rate limit exceeded; retry after ${retryAfterSeconds} seconds`,
      429,
      retryAfterSeconds,
    );
  }
  return new SpotifyApiError(
    `Spotify API request failed with status ${response.status}: ${providerMessage}`,
    response.status,
  );
}

async function readProviderError(response: Response): Promise<string> {
  const body = await response.text();
  if (!body) return response.statusText || "unknown error";
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string } | string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    return parsed.error?.message ?? "unknown error";
  } catch {
    return "provider returned a non-JSON error";
  }
}
