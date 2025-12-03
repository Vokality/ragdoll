/**
 * Spotify Extension - Provides music playback tools for AI assistants.
 *
 * Tools:
 * - playSpotify: Start or resume playback
 * - pauseSpotify: Pause playback
 * - skipSpotify: Skip to next or previous track
 * - searchSpotify: Search for tracks, albums, artists, or playlists
 * - getSpotifyPlayback: Get current playback state
 */

import { createExtension } from "../../create-extension.js";
import type {
  RagdollExtension,
  ExtensionTool,
  ValidationResult,
} from "../../types.js";
import {
  SpotifyManager,
  createSpotifyManager,
  type SpotifyManagerConfig,
} from "./spotify-manager.js";

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
  SpotifyTokens,
  SpotifyConnectionStatus,
  SpotifyState,
  SpotifyEventType,
  SpotifyEvent,
  SpotifyEventCallback,
  PlaySpotifyArgs,
  PauseSpotifyArgs,
  SearchSpotifyArgs,
  GetSpotifyPlaybackArgs,
  SkipSpotifyArgs,
  SpotifyToolHandler,
  SpotifyToolResult,
  SpotifyExtensionOptions,
  StatefulSpotifyExtensionOptions,
} from "./types.js";

export {
  EMPTY_PLAYBACK_STATE,
  INITIAL_SPOTIFY_STATE,
} from "./types.js";

// Re-export manager
export { SpotifyManager, createSpotifyManager };
export type { SpotifyManagerConfig };

// =============================================================================
// Tool Argument Types (local for extension)
// =============================================================================

import type {
  PlaySpotifyArgs,
  PauseSpotifyArgs,
  SearchSpotifyArgs,
  SkipSpotifyArgs,
  SpotifyToolHandler,
  SpotifyExtensionOptions,
  SpotifyEventCallback,
} from "./types.js";

// =============================================================================
// Validators
// =============================================================================

function validatePlay(args: Record<string, unknown>): ValidationResult {
  // uri is optional, deviceId is optional
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

function validateNoArgs(): ValidationResult {
  return { valid: true };
}

// =============================================================================
// Tool Definitions
// =============================================================================

function createSpotifyTools(handler: SpotifyToolHandler): ExtensionTool[] {
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
      handler: (args, _ctx) => handler.playSpotify(args as PlaySpotifyArgs),
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
      handler: (args, _ctx) => handler.pauseSpotify(args as PauseSpotifyArgs),
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
      handler: (args, _ctx) => handler.skipSpotify(args as unknown as SkipSpotifyArgs),
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
      handler: (args, _ctx) => handler.searchSpotify(args as unknown as SearchSpotifyArgs),
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
      handler: (_args, _ctx) => handler.getSpotifyPlayback({}),
      validate: validateNoArgs,
    },
  ];
}

// =============================================================================
// Extension Factory
// =============================================================================

/**
 * Create a Spotify extension with the provided handler.
 *
 * @example
 * ```ts
 * const spotifyExtension = createSpotifyExtension({
 *   handler: {
 *     playSpotify: async ({ uri }) => {
 *       await spotifyManager.play({ uri });
 *       return { success: true };
 *     },
 *     pauseSpotify: async () => {
 *       await spotifyManager.pause();
 *       return { success: true };
 *     },
 *     // ... other handlers
 *   },
 * });
 *
 * await registry.register(spotifyExtension);
 * ```
 */
export function createSpotifyExtension(
  options: SpotifyExtensionOptions
): RagdollExtension {
  const { handler, id = "spotify" } = options;

  return createExtension({
    id,
    name: "Spotify",
    version: "1.0.0",
    tools: createSpotifyTools(handler),
  });
}

// =============================================================================
// Stateful Extension Factory
// =============================================================================

export interface StatefulSpotifyOptions {
  /** Optional extension ID override (default: "spotify") */
  id?: string;
  /** Spotify Client ID */
  clientId: string;
  /** Redirect URI for OAuth (e.g., "ragdoll://spotify-callback") */
  redirectUri: string;
  /** Callback when state changes */
  onStateChange?: SpotifyEventCallback;
}

/**
 * Create a stateful Spotify extension with built-in SpotifyManager.
 *
 * This version manages OAuth PKCE flow, tokens, and API calls internally.
 * No client secret is needed - uses PKCE for secure authorization.
 *
 * @example
 * ```ts
 * const { extension, manager } = createStatefulSpotifyExtension({
 *   clientId: "your-spotify-client-id",
 *   redirectUri: "ragdoll://spotify-callback",
 *   onStateChange: (event) => {
 *     mainWindow?.webContents.send("spotify:state-changed", event.state);
 *   },
 * });
 *
 * await registry.register(extension);
 *
 * // Start OAuth flow
 * const authUrl = await manager.getAuthorizationUrl();
 * ```
 */
export function createStatefulSpotifyExtension(
  options: StatefulSpotifyOptions
): { extension: RagdollExtension; manager: SpotifyManager } {
  const {
    id = "spotify",
    clientId,
    redirectUri,
    onStateChange,
  } = options;

  // Create the manager
  const manager = createSpotifyManager({
    clientId,
    redirectUri,
    onStateChange,
  });

  // Create handler that uses the manager
  const handler: SpotifyToolHandler = {
    playSpotify: async ({ uri, deviceId }) => {
      try {
        await manager.play({ uri, deviceId });
        const playback = await manager.getPlaybackState();
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

    pauseSpotify: async ({ deviceId }) => {
      try {
        await manager.pause(deviceId);
        return {
          success: true,
          data: { message: "Playback paused" },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to pause",
        };
      }
    },

    skipSpotify: async ({ direction, deviceId }) => {
      try {
        if (direction === "next") {
          await manager.skipToNext(deviceId);
        } else {
          await manager.skipToPrevious(deviceId);
        }
        const playback = await manager.getPlaybackState();
        return {
          success: true,
          data: {
            message: `Skipped to ${direction} track`,
            playback,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to skip",
        };
      }
    },

    searchSpotify: async ({ query, types, limit }) => {
      try {
        const results = await manager.search(query, types ?? ["track"], limit ?? 5);
        return {
          success: true,
          data: results,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Search failed",
        };
      }
    },

    getSpotifyPlayback: async () => {
      try {
        const playback = await manager.getPlaybackState();
        return {
          success: true,
          data: playback,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get playback state",
        };
      }
    },
  };

  const extension = createExtension({
    id,
    name: "Spotify",
    version: "1.0.0",
    tools: createSpotifyTools(handler),
    onDestroy: () => {
      manager.destroy();
    },
  });

  return { extension, manager };
}
