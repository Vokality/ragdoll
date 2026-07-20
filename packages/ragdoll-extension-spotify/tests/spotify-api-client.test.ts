import { describe, expect, it } from "bun:test";
import type { HostOAuthCapability } from "@vokality/ragdoll-extensions";
import { createSpotifyApiClient } from "../src/spotify-api-client.js";

const oauth: HostOAuthCapability = {
  getState: () => ({ status: "connected", isAuthenticated: true }),
  subscribe: () => () => undefined,
  startFlow: async () => "",
  getAccessToken: async () => "access-token",
  disconnect: async () => undefined,
  isAuthenticated: () => true,
};

describe("SpotifyApiClient", () => {
  it("distinguishes empty playback from an API failure", async () => {
    const emptyClient = createSpotifyApiClient(
      oauth,
      async () => new Response(null, { status: 204 }),
    );
    expect(await emptyClient.getCurrentPlayback()).toEqual({
      status: "idle",
      item: null,
    });

    const failedClient = createSpotifyApiClient(oauth, async () =>
      Response.json({ error: { message: "token expired" } }, { status: 401 }),
    );
    await expect(failedClient.getCurrentPlayback()).rejects.toThrow(
      "Spotify authentication expired",
    );
  });

  it("returns only the current track title and artist names", async () => {
    let requestedUrl = "";
    const client = createSpotifyApiClient(oauth, async (input) => {
      requestedUrl = String(input);
      return Response.json({
        is_playing: true,
        item: {
          type: "track",
          id: "must-not-leak",
          uri: "spotify:track:must-not-leak",
          name: "So What",
          artists: [
            { id: "must-not-leak", name: "Miles Davis" },
            { id: "must-not-leak", name: "John Coltrane" },
          ],
          album: { name: "Must Not Leak" },
        },
        device: { id: "must-not-leak", name: "Must Not Leak" },
        progress_ms: 12_345,
      });
    });

    expect(await client.getCurrentPlayback()).toEqual({
      status: "playing",
      item: {
        type: "track",
        title: "So What",
        artists: ["Miles Davis", "John Coltrane"],
      },
    });
    expect(new URL(requestedUrl).searchParams.get("additional_types")).toBe(
      "track,episode",
    );
  });

  it("returns episode title and show without additional metadata", async () => {
    const client = createSpotifyApiClient(oauth, async () =>
      Response.json({
        is_playing: false,
        item: {
          type: "episode",
          id: "must-not-leak",
          name: "Episode title",
          show: { id: "must-not-leak", name: "Show name" },
          images: [{ url: "https://must-not-leak" }],
        },
      }),
    );

    expect(await client.getCurrentPlayback()).toEqual({
      status: "paused",
      item: {
        type: "episode",
        title: "Episode title",
        show: "Show name",
      },
    });
  });

  it("resolves and plays the first matching track inside the service", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const client = createSpotifyApiClient(oauth, async (input, init) => {
      requests.push({ url: String(input), init });
      if (requests.length === 1) {
        return Response.json({
          tracks: {
            items: [
              {
                uri: "spotify:track:track-id",
                name: "Must remain inside the Spotify client",
              },
            ],
          },
        });
      }
      return new Response(null, { status: 204 });
    });

    expect(await client.playSearch("jazz", "track")).toBe(true);
    expect(new URL(requests[0]!.url).searchParams.get("q")).toBe("jazz");
    expect(new URL(requests[0]!.url).searchParams.get("type")).toBe("track");
    expect(new URL(requests[0]!.url).searchParams.get("limit")).toBe("1");
    expect(requests[1]!.url).toEndWith("/me/player/play");
    expect(JSON.parse(String(requests[1]!.init?.body))).toEqual({
      uris: ["spotify:track:track-id"],
    });
  });

  it("uses context playback for albums, artists, and playlists", async () => {
    const requestBodies: string[] = [];
    const client = createSpotifyApiClient(oauth, async (_input, init) => {
      if (init?.method === "PUT") {
        requestBodies.push(String(init.body));
        return new Response(null, { status: 204 });
      }
      return Response.json({
        playlists: { items: [{ uri: "spotify:playlist:playlist-id" }] },
      });
    });

    expect(await client.playSearch("focus", "playlist")).toBe(true);
    expect(JSON.parse(requestBodies[0]!)).toEqual({
      context_uri: "spotify:playlist:playlist-id",
    });
  });

  it("returns no match without issuing a playback request", async () => {
    let requestCount = 0;
    const client = createSpotifyApiClient(oauth, async () => {
      requestCount += 1;
      return Response.json({ tracks: { items: [] } });
    });

    expect(await client.playSearch("missing", "track")).toBe(false);
    expect(requestCount).toBe(1);
  });

  it("rejects undocumented null search entries as provider contract violations", async () => {
    const client = createSpotifyApiClient(oauth, async () =>
      Response.json({ playlists: { items: [null] } }),
    );

    await expect(client.playSearch("jazz", "playlist")).rejects.toThrow();
  });
});
