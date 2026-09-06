import { describe, expect, it } from "bun:test";
import {
  SpotifyApiError,
  type SpotifyApiClient,
} from "../src/spotify-api-client.js";
import { createExtension } from "../src/index.js";
import { createSpotifyTools } from "../src/spotify-tools.js";

function createApi(
  overrides: Partial<SpotifyApiClient> = {},
): SpotifyApiClient {
  return {
    resume: async () => undefined,
    playSearch: async () => true,
    pause: async () => undefined,
    skipToNext: async () => undefined,
    skipToPrevious: async () => undefined,
    getCurrentPlayback: async () => ({ status: "idle", item: null }),
    ...overrides,
  };
}

describe("Spotify tools", () => {
  it("wires the minimal playback tools through the public extension runtime", async () => {
    const runtime = await createExtension().activate(
      {
        capabilities: new Set(["oauth"]),
        oauth: {
          getState: () => ({ status: "connected", isAuthenticated: true }),
          subscribe: () => () => undefined,
          startFlow: async () => "",
          getAccessToken: async () => "access-token",
          disconnect: async () => undefined,
          isAuthenticated: () => true,
        },
      },
      { instanceId: "test", createdAt: Date.now() },
    );

    expect(
      runtime.tools?.map(({ definition }) => definition.function.name),
    ).toEqual([
      "playSpotify",
      "pauseSpotify",
      "skipSpotify",
      "getSpotifyCurrentPlayback",
    ]);
  });

  it("exposes controls and current playback without a metadata search tool", () => {
    const names = createSpotifyTools(createApi()).map(
      ({ definition }) => definition.function.name,
    );

    expect(names).toEqual([
      "playSpotify",
      "pauseSpotify",
      "skipSpotify",
      "getSpotifyCurrentPlayback",
    ]);
  });

  it("resolves track playback locally by default and returns status only", async () => {
    const calls: unknown[][] = [];
    const playSearch = async (...args: unknown[]) => {
      calls.push(args);
      return true;
    };
    const play = createSpotifyTools(createApi({ playSearch })).find(
      ({ definition }) => definition.function.name === "playSpotify",
    );

    expect(await play?.handler({ query: "jazz" }, {})).toEqual({
      success: true,
      data: { status: "playback_started" },
    });
    expect(calls).toEqual([["jazz", "track"]]);
  });

  it("rejects legacy URI arguments", () => {
    const play = createSpotifyTools(createApi()).find(
      ({ definition }) => definition.function.name === "playSpotify",
    );

    expect(play?.validate?.({ uri: "spotify:track:track-id" })).toEqual({
      valid: false,
      error: "unsupported argument: uri",
    });
  });

  it("returns only the current title and artist names", async () => {
    const currentPlayback = createSpotifyTools(
      createApi({
        getCurrentPlayback: async () => ({
          status: "playing",
          item: {
            type: "track",
            title: "So What",
            artists: ["Miles Davis"],
          },
        }),
      }),
    ).find(
      ({ definition }) =>
        definition.function.name === "getSpotifyCurrentPlayback",
    );

    expect(await currentPlayback?.handler({}, {})).toEqual({
      success: true,
      data: {
        status: "playing",
        item: {
          type: "track",
          title: "So What",
          artists: ["Miles Davis"],
        },
      },
    });
  });

  it("does not expose provider error messages to the agent", async () => {
    const pause = createSpotifyTools(
      createApi({
        pause: async () => {
          throw new SpotifyApiError("provider metadata", 500);
        },
      }),
    ).find(({ definition }) => definition.function.name === "pauseSpotify");

    expect(await pause?.handler({}, {})).toEqual({
      success: false,
      error: "spotify_unavailable",
    });
  });
});

it("validates playback arguments before handlers call the provider", async () => {
  const calls: string[] = [];
  const tools = createSpotifyTools(
    createApi({
      resume: async () => {
        calls.push("resume");
      },
      playSearch: async () => {
        calls.push("search");
        return true;
      },
      skipToNext: async () => {
        calls.push("next");
      },
      skipToPrevious: async () => {
        calls.push("previous");
      },
    }),
  );
  const play = tools.find(
    ({ definition }) => definition.function.name === "playSpotify",
  );
  const skip = tools.find(
    ({ definition }) => definition.function.name === "skipSpotify",
  );
  if (!play || !skip) throw new Error("Missing Spotify playback tools");
  for (const args of [
    { query: 123 },
    { query: "" },
    { query: "jazz", type: "invalid" },
    { type: "track" },
  ]) {
    const validation = play.validate?.(args);
    expect(validation?.valid).toBe(false);
    expect(await play.handler(args, {})).toEqual({
      success: false,
      error: validation?.error,
    });
  }
  for (const args of [{}, { direction: "invalid" }, { direction: 1 }]) {
    const validation = skip.validate?.(args);
    expect(validation?.valid).toBe(false);
    expect(await skip.handler(args, {})).toEqual({
      success: false,
      error: validation?.error,
    });
  }
  expect(calls).toEqual([]);
  await skip.handler({ direction: "next" }, {});
  await skip.handler({ direction: "previous" }, {});
  expect(calls).toEqual(["next", "previous"]);
});
