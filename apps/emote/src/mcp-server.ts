/**
 * Emote MCP server - Give AI the ability to express itself
 * 
 * This server communicates with the VS Code extension via file-based IPC.
 * No HTTP server required - just file writes!
 * 
 * Usage: Add to your MCP config:
 * {
 *   "emote": {
 *     "command": "node",
 *     "args": ["/path/to/vscode-extension/dist/mcp-server.js"]
 *   }
 * }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// File-based IPC - must match the extension
const IPC_DIR = path.join(os.tmpdir(), "ragdoll-vscode");
const COMMAND_FILE = path.join(IPC_DIR, "command.json");

const LOG_PREFIX = "[Emote MCP]";
const VALID_MOODS = ["neutral", "smile", "frown", "laugh", "angry", "sad", "surprise", "confusion", "thinking"] as const;
const VALID_ACTIONS = ["wink", "talk"] as const;
const VALID_TONES = ["default", "whisper", "shout"] as const;
const VALID_THEMES = ["default", "robot", "alien", "monochrome"] as const;

type MoodId = (typeof VALID_MOODS)[number];
type ActionId = (typeof VALID_ACTIONS)[number];
type ToneId = (typeof VALID_TONES)[number];
type ThemeId = (typeof VALID_THEMES)[number];
type CommandPayload =
  | { type: "show" | "hide" | "clearAction" }
  | { type: "setMood"; mood: MoodId; duration?: number }
  | { type: "triggerAction"; action: ActionId; duration?: number }
  | { type: "setHeadPose"; yawDegrees?: number; pitchDegrees?: number; duration?: number }
  | { type: "setSpeechBubble"; text: string | null; tone?: ToneId }
  | { type: "setTheme"; themeId: ThemeId };

function log(level: "info" | "error" | "warn", message: string, details?: Record<string, unknown>): void {
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.error(`${LOG_PREFIX} [${level.toUpperCase()}] ${message}${suffix}`);
}

function ensureIpcReady(): void {
  if (!fs.existsSync(IPC_DIR)) {
    fs.mkdirSync(IPC_DIR, { recursive: true });
  }
  if (!fs.existsSync(COMMAND_FILE)) {
    fs.writeFileSync(COMMAND_FILE, "");
  }
  fs.accessSync(COMMAND_FILE, fs.constants.R_OK | fs.constants.W_OK);
}

function sendCommand(command: CommandPayload): void {
  ensureIpcReady();
  fs.writeFileSync(COMMAND_FILE, JSON.stringify(command));
  log("info", "Command dispatched", { type: command.type });
}

function successResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: `Error: ${message}` }] };
}

function getHealthReport() {
  try {
    ensureIpcReady();
    const stats = fs.statSync(COMMAND_FILE);
    return {
      status: "ok",
      ipcDir: IPC_DIR,
      commandFile: COMMAND_FILE,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch (error) {
    return {
      status: "error",
      ipcDir: IPC_DIR,
      commandFile: COMMAND_FILE,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

const server = new Server(
  {
    name: "emote",
    version: "0.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "setMood",
      description: "Set the character's facial mood (smile, laugh, sad, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          mood: {
            type: "string",
            enum: [...VALID_MOODS],
          },
          duration: {
            type: "number",
            description: "Transition duration in seconds",
            minimum: 0,
          },
        },
        required: ["mood"],
      },
    },
    {
      name: "triggerAction",
      description: "Trigger a facial action like wink or talk",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [...VALID_ACTIONS],
          },
          duration: {
            type: "number",
            minimum: 0.2,
          },
        },
        required: ["action"],
      },
    },
    {
      name: "clearAction",
      description: "Clear the active facial action (stop talking, etc.)",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "setHeadPose",
      description: "Rotate the head a few degrees to the side or up/down",
      inputSchema: {
        type: "object",
        properties: {
          yawDegrees: {
            type: "number",
            description: "Horizontal rotation (-35 to 35 degrees)",
            minimum: -35,
            maximum: 35,
          },
          pitchDegrees: {
            type: "number",
            description: "Vertical rotation (-20 to 20 degrees)",
            minimum: -20,
            maximum: 20,
          },
          duration: {
            type: "number",
            minimum: 0.1,
          },
        },
      },
    },
    {
      name: "setSpeechBubble",
      description: "Show or clear the speech bubble text",
      inputSchema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Bubble contents. Leave empty/null to clear.",
            maxLength: 240,
          },
          tone: {
            type: "string",
            enum: [...VALID_TONES],
          },
        },
      },
    },
    {
      name: "show",
      description: "Show the Emote character panel in VS Code",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "hide",
      description: "Hide the Emote character panel",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "setTheme",
      description: "Change the character's visual theme",
      inputSchema: {
        type: "object",
        properties: {
          themeId: {
            type: "string",
            enum: [...VALID_THEMES],
            description: "Theme identifier: default (warm human), robot (metallic), alien (green), monochrome (grayscale)",
          },
        },
        required: ["themeId"],
      },
    },
    {
      name: "health",
      description: "Report MCP server readiness and IPC file status",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "setMood":
        sendCommand({
          type: "setMood",
          mood: (args as { mood: MoodId }).mood,
          duration: (args as { duration?: number }).duration,
        });
        return successResponse(`Mood set to ${(args as { mood: MoodId }).mood}`);

      case "triggerAction":
        sendCommand({
          type: "triggerAction",
          action: (args as { action: ActionId }).action,
          duration: (args as { duration?: number }).duration,
        });
        return successResponse(`Action triggered: ${(args as { action: ActionId }).action}`);

      case "clearAction":
        sendCommand({ type: "clearAction" });
        return successResponse("Action cleared");

      case "setHeadPose":
        sendCommand({
          type: "setHeadPose",
          yawDegrees: (args as { yawDegrees?: number }).yawDegrees,
          pitchDegrees: (args as { pitchDegrees?: number }).pitchDegrees,
          duration: (args as { duration?: number }).duration,
        });
        return successResponse("Head pose updated");

      case "setSpeechBubble":
        sendCommand({
          type: "setSpeechBubble",
          text: (args as { text?: string | null }).text ?? null,
          tone: (args as { tone?: ToneId }).tone,
        });
        {
          const text = (args as { text?: string }).text;
          return successResponse(text ? `Speech bubble: "${text}"` : "Speech bubble cleared");
        }

      case "show":
        sendCommand({ type: "show" });
        return successResponse("Emote panel shown");

      case "hide":
        sendCommand({ type: "hide" });
        return successResponse("Emote panel hidden");

      case "setTheme":
        sendCommand({
          type: "setTheme",
          themeId: (args as { themeId: ThemeId }).themeId,
        });
        return successResponse(`Theme changed to: ${(args as { themeId: ThemeId }).themeId}`);

      case "health":
        return successResponse(JSON.stringify(getHealthReport(), null, 2));

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    log("error", "Tool call failed", { tool: name, error: String(error) });
    return errorResponse(error);
  }
});

// Start the server
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  log("info", "Emote MCP Server running", { commandFile: COMMAND_FILE });
}).catch((error) => {
  log("error", "Failed to start Emote MCP Server", { error: String(error) });
});
