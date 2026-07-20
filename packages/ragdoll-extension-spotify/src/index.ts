/** Spotify playback controls backed by host-provided OAuth. */

import { createExtension as defineExtension } from "@vokality/ragdoll-extensions";
import type { RagdollExtension } from "@vokality/ragdoll-extensions";
import { createSpotifyApiClient } from "./spotify-api-client.js";
import { createSpotifyTools } from "./spotify-tools.js";

export type {
  GetSpotifyCurrentPlaybackArgs,
  PauseSpotifyArgs,
  PlaySpotifyArgs,
  SkipSpotifyArgs,
  SpotifyCurrentPlayback,
  SpotifyEpisodeSummary,
  SpotifyPlaybackStatus,
  SpotifySearchType,
  SpotifyTrackSummary,
} from "./types.js";

export function createExtension(): RagdollExtension {
  return defineExtension({
    id: "spotify",
    name: "Spotify",
    version: "0.1.0",
    requiredCapabilities: ["oauth"],
    optionalCapabilities: [],

    createRuntime: async (host) => {
      if (!host.oauth) {
        throw new Error(
          "Spotify extension requires OAuth capability. " +
            "Ensure the host is configured to provide OAuth for this extension.",
        );
      }

      const api = createSpotifyApiClient(host.oauth, fetch);
      return { tools: createSpotifyTools(api) };
    },
  });
}
