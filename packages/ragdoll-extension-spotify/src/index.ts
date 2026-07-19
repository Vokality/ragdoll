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

import { createExtension as defineExtension } from "@vokality/ragdoll-extensions";
import type {
  ExtensionTool,
  ValidationResult,
  RagdollExtension,
} from "@vokality/ragdoll-extensions";
import type {
  PlaySpotifyArgs,
  PauseSpotifyArgs,
  SkipSpotifyArgs,
  SearchSpotifyArgs,
} from "./types.js";
import {
  createSpotifyApiClient,
  type SpotifyApiClient,
} from "./spotify-api-client.js";

// Re-export types
export type {
  SpotifyImage,
  SpotifyArtist,
  SpotifyAlbum,
  SpotifyTrack,
  SpotifyShow,
  SpotifyEpisode,
  SpotifyPlaybackItem,
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
  if (
    !args.direction ||
    !["next", "previous"].includes(args.direction as string)
  ) {
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
        return {
          valid: false,
          error: `Invalid type: ${t}. Valid types: ${validTypes.join(", ")}`,
        };
      }
    }
  }
  if (
    args.limit !== undefined &&
    (typeof args.limit !== "number" || args.limit < 1 || args.limit > 10)
  ) {
    return { valid: false, error: "limit must be a number between 1 and 10" };
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
          description:
            "Start or resume Spotify playback. Optionally specify a track, album, artist, or playlist URI to play.",
          parameters: {
            type: "object",
            properties: {
              uri: {
                type: "string",
                description:
                  "Spotify URI to play (e.g., 'spotify:track:xxx', 'spotify:album:xxx'). If omitted, resumes current playback.",
              },
              deviceId: {
                type: "string",
                description:
                  "Device ID to play on. If omitted, uses the active device.",
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
                description:
                  "Device ID to pause. If omitted, pauses the active device.",
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
          description:
            "Search Spotify for tracks, albums, artists, or playlists.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "Search query (e.g., artist name, song title, album name).",
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
                description: "Maximum results per type (1-10). Defaults to 5.",
              },
            },
            required: ["query"],
          },
        },
      },
      handler: async (args) => {
        const { query, types, limit } = args as unknown as SearchSpotifyArgs;
        try {
          const results = await api.search(
            query,
            types ?? ["track"],
            limit ?? 5,
          );
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
          description:
            "Get the current Spotify playback state including the currently playing track, progress, and device info.",
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
            error:
              error instanceof Error
                ? error.message
                : "Failed to get playback state",
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

      const api = createSpotifyApiClient(host.oauth);

      return {
        tools: createSpotifyTools(api),
      };
    },
  });
}
