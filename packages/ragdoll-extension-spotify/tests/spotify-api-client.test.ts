import { describe, expect, it } from "bun:test";
import type { HostOAuthCapability } from "@vokality/ragdoll-extensions";
import { createExtension } from "../src/index.js";
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
  it("treats only a 204 response as empty playback", async () => {
    const emptyClient = createSpotifyApiClient(
      oauth,
      async () => new Response(null, { status: 204 }),
      () => 123,
    );
    expect(await emptyClient.getPlaybackState()).toMatchObject({
      isPlaying: false,
      item: null,
      device: null,
    });

    const failedClient = createSpotifyApiClient(
      oauth,
      async () =>
        Response.json({ error: { message: "token expired" } }, { status: 401 }),
      () => 123,
    );
    await expect(failedClient.getPlaybackState()).rejects.toThrow(
      "Spotify authentication expired",
    );
  });

  it("maps episode playback and requests every supported playback item type", async () => {
    let requestedUrl = "";
    const client = createSpotifyApiClient(
      oauth,
      async (input) => {
        requestedUrl = String(input);
        return Response.json({
          is_playing: true,
          progress_ms: 2_000,
          timestamp: 123,
          shuffle_state: false,
          repeat_state: "off",
          device: {
            id: null,
            name: "Desktop",
            type: "Computer",
            is_active: true,
            volume_percent: null,
          },
          item: {
            type: "episode",
            id: "episode-id",
            name: "Episode",
            uri: "spotify:episode:episode-id",
            duration_ms: 60_000,
            images: [{ url: "https://image", height: 300, width: 300 }],
            show: {
              id: "show-id",
              name: "Show",
              uri: "spotify:show:show-id",
            },
          },
        });
      },
      () => 123,
    );

    expect(await client.getPlaybackState()).toMatchObject({
      item: {
        type: "episode",
        id: "episode-id",
        show: { id: "show-id" },
      },
      device: { id: null, volumePercent: null },
      timestamp: 123,
    });
    expect(new URL(requestedUrl).searchParams.get("additional_types")).toBe(
      "track,episode",
    );
  });

  it("encodes device identifiers in playback commands", async () => {
    let requestedUrl = "";
    const client = createSpotifyApiClient(
      oauth,
      async (input) => {
        requestedUrl = String(input);
        return new Response(null, { status: 204 });
      },
      () => 123,
    );

    await client.pause("living room/device");
    expect(new URL(requestedUrl).searchParams.get("device_id")).toBe(
      "living room/device",
    );
  });
});

describe("Spotify tools", () => {
  it("enforces the current development-mode search limit", async () => {
    const runtime = await createExtension().activate(
      { capabilities: new Set(["oauth"]), oauth },
      { instanceId: "test", createdAt: Date.now() },
    );
    const search = runtime.tools?.find(
      ({ definition }) => definition.function.name === "searchSpotify",
    );

    expect(search?.validate?.({ query: "music", limit: 10 })).toEqual({
      valid: true,
    });
    expect(search?.validate?.({ query: "music", limit: 11 })).toEqual({
      valid: false,
      error: "limit must be a number between 1 and 10",
    });
  });
});
