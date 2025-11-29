/**
 * Emote MCP server - Give AI the ability to express itself
 * 
 * This server communicates with the VS Code extension via Unix socket (or named pipe on Windows).
 * Commands are sent directly to the extension for immediate processing.
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
import * as net from "net";
import * as path from "path";
import * as os from "os";

// Socket-based IPC - must match the extension
const IPC_DIR = path.join(os.tmpdir(), "ragdoll-vscode");
const SOCKET_PATH = os.platform() === "win32"
  ? "\\\\.\\pipe\\ragdoll-emote"
  : path.join(IPC_DIR, "emote.sock");

const SOCKET_TIMEOUT_MS = 3000;

const LOG_PREFIX = "[Emote MCP]";
const VALID_MOODS = ["neutral", "smile", "frown", "laugh", "angry", "sad", "surprise", "confusion", "thinking"] as const;
const VALID_ACTIONS = ["wink", "talk"] as const;
const VALID_TONES = ["default", "whisper", "shout"] as const;
const VALID_THEMES = ["default", "robot", "alien", "monochrome"] as const;

type MoodId = (typeof VALID_MOODS)[number];
type ActionId = (typeof VALID_ACTIONS)[number];
type ToneId = (typeof VALID_TONES)[number];
type ThemeId = (typeof VALID_THEMES)[number];
type PomodoroDuration = 15 | 30 | 60 | 120;

type CommandPayload =
  | { type: "show" | "hide" | "clearAction" }
  | { type: "setMood"; mood: MoodId; duration?: number }
  | { type: "triggerAction"; action: ActionId; duration?: number }
  | { type: "setHeadPose"; yawDegrees?: number; pitchDegrees?: number; duration?: number }
  | { type: "setSpeechBubble"; text: string | null; tone?: ToneId }
  | { type: "setTheme"; themeId: ThemeId }
  | { type: "startPomodoro"; sessionDuration?: PomodoroDuration; breakDuration?: PomodoroDuration }
  | { type: "pausePomodoro" }
  | { type: "resetPomodoro" };

function log(level: "info" | "error" | "warn", message: string, details?: Record<string, unknown>): void {
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.error(`${LOG_PREFIX} [${level.toUpperCase()}] ${message}${suffix}`);
}

type SocketResponse = { ok: boolean; type?: string; error?: string };

function sendCommand(command: CommandPayload): Promise<SocketResponse> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let responseBuffer = "";
    let resolved = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error("Connection timeout - is the Emote extension running?"));
      }
    }, SOCKET_TIMEOUT_MS);

    socket.on("connect", () => {
      socket.write(JSON.stringify(command) + "\n");
    });

    socket.on("data", (data) => {
      responseBuffer += data.toString();
      const newlineIndex = responseBuffer.indexOf("\n");
      if (newlineIndex !== -1) {
        const message = responseBuffer.slice(0, newlineIndex).trim();
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          try {
            const response = JSON.parse(message) as SocketResponse;
            log("info", "Command dispatched", { type: command.type, response });
            cleanup();
            resolve(response);
          } catch {
            cleanup();
            resolve({ ok: true, type: command.type });
          }
        }
      }
    });

    socket.on("error", (error: NodeJS.ErrnoException) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        if (error.code === "ECONNREFUSED" || error.code === "ENOENT") {
          reject(new Error("Emote extension not running - open VS Code with the Emote extension"));
        } else {
          reject(error);
        }
      }
    });

    socket.on("close", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        resolve({ ok: true, type: command.type });
      }
    });

    socket.connect(SOCKET_PATH);
  });
}

function successResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: `Error: ${message}` }] };
}

async function getHealthReport(): Promise<{
  status: string;
  socketPath: string;
  connected?: boolean;
  message?: string;
}> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({
        status: "error",
        socketPath: SOCKET_PATH,
        connected: false,
        message: "Connection timeout",
      });
    }, 1000);

    socket.on("connect", () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({
        status: "ok",
        socketPath: SOCKET_PATH,
        connected: true,
      });
    });

    socket.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      socket.destroy();
      const message = error.code === "ECONNREFUSED" || error.code === "ENOENT"
        ? "Extension not running"
        : error.message;
      resolve({
        status: "error",
        socketPath: SOCKET_PATH,
        connected: false,
        message,
      });
    });

    socket.connect(SOCKET_PATH);
  });
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
    {
      name: "startPomodoro",
      description: "Start a pomodoro timer session",
      inputSchema: {
        type: "object",
        properties: {
          sessionDuration: {
            type: "number",
            enum: [15, 30, 60, 120],
            description: "Session duration in minutes (15, 30, 60, or 120)",
          },
          breakDuration: {
            type: "number",
            enum: [5, 10, 15, 30],
            description: "Break duration in minutes (5, 10, 15, or 30)",
          },
        },
      },
    },
    {
      name: "pausePomodoro",
      description: "Pause the active pomodoro timer",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "resetPomodoro",
      description: "Reset the pomodoro timer to idle state",
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
        await sendCommand({
          type: "setMood",
          mood: (args as { mood: MoodId }).mood,
          duration: (args as { duration?: number }).duration,
        });
        return successResponse(`Mood set to ${(args as { mood: MoodId }).mood}`);

      case "triggerAction":
        await sendCommand({
          type: "triggerAction",
          action: (args as { action: ActionId }).action,
          duration: (args as { duration?: number }).duration,
        });
        return successResponse(`Action triggered: ${(args as { action: ActionId }).action}`);

      case "clearAction":
        await sendCommand({ type: "clearAction" });
        return successResponse("Action cleared");

      case "setHeadPose":
        await sendCommand({
          type: "setHeadPose",
          yawDegrees: (args as { yawDegrees?: number }).yawDegrees,
          pitchDegrees: (args as { pitchDegrees?: number }).pitchDegrees,
          duration: (args as { duration?: number }).duration,
        });
        return successResponse("Head pose updated");

      case "setSpeechBubble":
        await sendCommand({
          type: "setSpeechBubble",
          text: (args as { text?: string | null }).text ?? null,
          tone: (args as { tone?: ToneId }).tone,
        });
        {
          const text = (args as { text?: string }).text;
          return successResponse(text ? `Speech bubble: "${text}"` : "Speech bubble cleared");
        }

      case "show":
        await sendCommand({ type: "show" });
        return successResponse("Emote panel shown");

      case "hide":
        await sendCommand({ type: "hide" });
        return successResponse("Emote panel hidden");

      case "setTheme":
        await sendCommand({
          type: "setTheme",
          themeId: (args as { themeId: ThemeId }).themeId,
        });
        return successResponse(`Theme changed to: ${(args as { themeId: ThemeId }).themeId}`);

      case "health": {
        const report = await getHealthReport();
        return successResponse(JSON.stringify(report, null, 2));
      }

      case "startPomodoro": {
        const sessionDuration = (args as { sessionDuration?: number }).sessionDuration as PomodoroDuration | undefined;
        const breakDuration = (args as { breakDuration?: number }).breakDuration as PomodoroDuration | undefined;
        await sendCommand({
          type: "startPomodoro",
          sessionDuration,
          breakDuration,
        });
        const sessionLabel = sessionDuration ? `${sessionDuration} min` : "default";
        const breakLabel = breakDuration ? `${breakDuration} min` : "default";
        return successResponse(`Pomodoro started: ${sessionLabel} session, ${breakLabel} break`);
      }

      case "pausePomodoro":
        await sendCommand({ type: "pausePomodoro" });
        return successResponse("Pomodoro paused");

      case "resetPomodoro":
        await sendCommand({ type: "resetPomodoro" });
        return successResponse("Pomodoro reset");

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
  log("info", "Emote MCP Server running", { socketPath: SOCKET_PATH });
}).catch((error) => {
  log("error", "Failed to start Emote MCP Server", { error: String(error) });
});
