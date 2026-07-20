import { z, type HostOAuthCapability } from "@vokality/ragdoll-extensions";
import type { SpotifyCurrentPlayback, SpotifySearchType } from "./types.js";

const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";

const apiSearchItemSchema = z.object({ uri: z.string() });
const apiSearchPageSchema = z.object({
  items: z.array(apiSearchItemSchema),
});
const apiPlaybackStatusSchema = z.object({
  is_playing: z.boolean(),
  item: z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("track"),
        name: z.string(),
        artists: z.array(z.object({ name: z.string() })),
      }),
      z.object({
        type: z.literal("episode"),
        name: z.string(),
        show: z.object({ name: z.string() }),
      }),
    ])
    .nullable(),
});

type ApiSearchItem = z.infer<typeof apiSearchItemSchema>;
type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface SpotifyApiClient {
  resume(): Promise<void>;
  playSearch(query: string, type: SpotifySearchType): Promise<boolean>;
  pause(): Promise<void>;
  skipToNext(): Promise<void>;
  skipToPrevious(): Promise<void>;
  getCurrentPlayback(): Promise<SpotifyCurrentPlayback>;
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
): SpotifyApiClient {
  async function apiRequest<T>(
    endpoint: string,
    responseSchema: z.ZodType<T> | null,
    options: RequestInit = {},
  ): Promise<T | null> {
    const accessToken = await oauth.getAccessToken();
    if (!accessToken) {
      throw new SpotifyApiError("Spotify is not authenticated", 401);
    }

    const response = await fetchRequest(`${SPOTIFY_API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (response.status === 204) return null;
    if (!response.ok) throw createApiError(response);
    if (!responseSchema) {
      throw new Error("Spotify API returned an unexpected response body");
    }
    return responseSchema.parse(await response.json());
  }

  async function playUri(uri: string): Promise<void> {
    const body = uri.startsWith("spotify:track:")
      ? { uris: [uri] }
      : { context_uri: uri };

    await apiRequest("/me/player/play", null, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  return {
    async resume() {
      await apiRequest("/me/player/play", null, { method: "PUT" });
    },

    async playSearch(query, type) {
      const search = new URLSearchParams({ q: query, type, limit: "1" });
      const items = await apiRequest(
        `/search?${search.toString()}`,
        searchResponseSchema(type),
      );
      if (!items) {
        throw new Error("Spotify search returned no response body");
      }

      const uri = items[0]?.uri;
      if (!uri) return false;
      if (!uri.startsWith(`spotify:${type}:`)) {
        throw new Error("Spotify search returned an unexpected item URI");
      }

      await playUri(uri);
      return true;
    },

    async pause() {
      await apiRequest("/me/player/pause", null, { method: "PUT" });
    },

    async skipToNext() {
      await apiRequest("/me/player/next", null, { method: "POST" });
    },

    async skipToPrevious() {
      await apiRequest("/me/player/previous", null, { method: "POST" });
    },

    async getCurrentPlayback() {
      const query = new URLSearchParams({
        additional_types: "track,episode",
      });
      const data = await apiRequest(
        `/me/player?${query.toString()}`,
        apiPlaybackStatusSchema,
      );
      if (!data || data.item === null) {
        return { status: "idle", item: null };
      }

      const status = data.is_playing ? "playing" : "paused";
      return data.item.type === "track"
        ? {
            status,
            item: {
              type: "track",
              title: data.item.name,
              artists: data.item.artists.map(({ name }) => name),
            },
          }
        : {
            status,
            item: {
              type: "episode",
              title: data.item.name,
              show: data.item.show.name,
            },
          };
    },
  };
}

function searchResponseSchema(
  type: SpotifySearchType,
): z.ZodType<ApiSearchItem[]> {
  switch (type) {
    case "track":
      return z
        .object({ tracks: apiSearchPageSchema })
        .transform(({ tracks }) => tracks.items);
    case "album":
      return z
        .object({ albums: apiSearchPageSchema })
        .transform(({ albums }) => albums.items);
    case "artist":
      return z
        .object({ artists: apiSearchPageSchema })
        .transform(({ artists }) => artists.items);
    case "playlist":
      return z
        .object({ playlists: apiSearchPageSchema })
        .transform(({ playlists }) => playlists.items);
  }
}

function createApiError(response: Response): SpotifyApiError {
  const retryAfter = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfter
    ? Number.parseInt(retryAfter, 10)
    : undefined;
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
    `Spotify API request failed with status ${response.status}`,
    response.status,
  );
}
