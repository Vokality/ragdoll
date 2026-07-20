import type {
  ExtensionTool,
  ToolResult,
  ValidationResult,
} from "@vokality/ragdoll-extensions";
import {
  SpotifyApiError,
  type SpotifyApiClient,
} from "./spotify-api-client.js";
import type {
  PlaySpotifyArgs,
  SkipSpotifyArgs,
  SpotifySearchType,
} from "./types.js";

const SEARCH_TYPES: readonly SpotifySearchType[] = [
  "track",
  "album",
  "artist",
  "playlist",
];

export function createSpotifyTools(api: SpotifyApiClient): ExtensionTool[] {
  return [
    {
      definition: {
        type: "function",
        function: {
          name: "playSpotify",
          description:
            "Start Spotify playback. Provide the user's search terms to play something new; omit query to resume. Search defaults to tracks. Use album, artist, or playlist only when the user explicitly requests that context.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The user's requested music search terms.",
              },
              type: {
                type: "string",
                enum: [...SEARCH_TYPES],
                description: "Playback context. Defaults to track.",
              },
            },
            additionalProperties: false,
          },
        },
      },
      handler: async (args) => {
        const { query, type } = args as PlaySpotifyArgs;
        try {
          if (!query) {
            await api.resume();
          } else if (!(await api.playSearch(query, type ?? "track"))) {
            return { success: false, error: "spotify_no_results" };
          }
          return { success: true, data: { status: "playback_started" } };
        } catch (error) {
          return toolFailure(error);
        }
      },
      validate: validatePlay,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "pauseSpotify",
          description: "Pause Spotify playback on the active device.",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      },
      handler: async () => {
        try {
          await api.pause();
          return { success: true, data: { status: "playback_paused" } };
        } catch (error) {
          return toolFailure(error);
        }
      },
      validate: validateNoArguments,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "skipSpotify",
          description:
            "Skip to the next or previous item on the active Spotify device.",
          parameters: {
            type: "object",
            properties: {
              direction: {
                type: "string",
                enum: ["next", "previous"],
                description: "Direction to skip.",
              },
            },
            required: ["direction"],
            additionalProperties: false,
          },
        },
      },
      handler: async (args) => {
        const { direction } = args as unknown as SkipSpotifyArgs;
        try {
          if (direction === "next") {
            await api.skipToNext();
          } else {
            await api.skipToPrevious();
          }
          return {
            success: true,
            data: {
              status:
                direction === "next" ? "skipped_next" : "skipped_previous",
            },
          };
        } catch (error) {
          return toolFailure(error);
        }
      },
      validate: validateSkip,
    },
    {
      definition: {
        type: "function",
        function: {
          name: "getSpotifyCurrentPlayback",
          description:
            "Get the current Spotify playback status and the playing track title and artist names, or episode title and show. Does not return Spotify IDs, URIs, artwork, album, device, or progress data.",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      },
      handler: async () => {
        try {
          return {
            success: true,
            data: await api.getCurrentPlayback(),
          };
        } catch (error) {
          return toolFailure(error);
        }
      },
      validate: validateNoArguments,
    },
  ];
}

function validatePlay(args: Record<string, unknown>): ValidationResult {
  const unsupported = unsupportedArgument(args, ["query", "type"]);
  if (unsupported) return unsupported;
  if (
    args.query !== undefined &&
    (typeof args.query !== "string" || args.query.trim().length === 0)
  ) {
    return { valid: false, error: "query must be a non-empty string" };
  }
  if (
    args.type !== undefined &&
    !SEARCH_TYPES.includes(args.type as SpotifySearchType)
  ) {
    return {
      valid: false,
      error: `type must be one of: ${SEARCH_TYPES.join(", ")}`,
    };
  }
  if (args.type !== undefined && args.query === undefined) {
    return { valid: false, error: "type requires query" };
  }
  return { valid: true };
}

function validateSkip(args: Record<string, unknown>): ValidationResult {
  const unsupported = unsupportedArgument(args, ["direction"]);
  if (unsupported) return unsupported;
  if (args.direction !== "next" && args.direction !== "previous") {
    return { valid: false, error: "direction must be 'next' or 'previous'" };
  }
  return { valid: true };
}

function validateNoArguments(args: Record<string, unknown>): ValidationResult {
  return unsupportedArgument(args, []) ?? { valid: true };
}

function unsupportedArgument(
  args: Record<string, unknown>,
  supported: readonly string[],
): ValidationResult | null {
  const argument = Object.keys(args).find((key) => !supported.includes(key));
  return argument
    ? { valid: false, error: `unsupported argument: ${argument}` }
    : null;
}

function toolFailure(error: unknown): ToolResult {
  if (error instanceof SpotifyApiError) {
    switch (error.status) {
      case 401:
        return { success: false, error: "spotify_authentication_required" };
      case 403:
        return { success: false, error: "spotify_action_not_allowed" };
      case 404:
        return { success: false, error: "spotify_playback_unavailable" };
      case 429:
        return { success: false, error: "spotify_rate_limited" };
    }
  }
  return { success: false, error: "spotify_unavailable" };
}
