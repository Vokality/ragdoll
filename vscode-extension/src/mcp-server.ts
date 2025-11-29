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

interface MCPCommand {
  type: string;
  [key: string]: unknown;
}

function sendCommand(command: MCPCommand): void {
  // Ensure directory exists
  if (!fs.existsSync(IPC_DIR)) {
    fs.mkdirSync(IPC_DIR, { recursive: true });
  }
  // Write command to file (extension watches this)
  fs.writeFileSync(COMMAND_FILE, JSON.stringify(command));
}

const server = new Server(
  {
    name: "emote",
    version: "1.0.0",
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
            enum: ["neutral", "smile", "frown", "laugh", "angry", "sad", "surprise", "confusion", "thinking"],
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
            enum: ["wink", "talk"],
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
          },
          tone: {
            type: "string",
            enum: ["default", "whisper", "shout"],
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
            enum: ["default", "robot", "alien", "monochrome"],
            description: "Theme identifier: default (warm human), robot (metallic), alien (green), monochrome (grayscale)",
          },
        },
        required: ["themeId"],
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
          mood: (args as { mood: string }).mood,
          duration: (args as { duration?: number }).duration,
        });
        return { content: [{ type: "text", text: `Mood set to ${(args as { mood: string }).mood}` }] };

      case "triggerAction":
        sendCommand({
          type: "triggerAction",
          action: (args as { action: string }).action,
          duration: (args as { duration?: number }).duration,
        });
        return { content: [{ type: "text", text: `Action triggered: ${(args as { action: string }).action}` }] };

      case "clearAction":
        sendCommand({ type: "clearAction" });
        return { content: [{ type: "text", text: "Action cleared" }] };

      case "setHeadPose":
        sendCommand({
          type: "setHeadPose",
          yawDegrees: (args as { yawDegrees?: number }).yawDegrees,
          pitchDegrees: (args as { pitchDegrees?: number }).pitchDegrees,
          duration: (args as { duration?: number }).duration,
        });
        return { content: [{ type: "text", text: "Head pose updated" }] };

      case "setSpeechBubble":
        sendCommand({
          type: "setSpeechBubble",
          text: (args as { text?: string }).text,
          tone: (args as { tone?: string }).tone,
        });
        const text = (args as { text?: string }).text;
        return {
          content: [{
            type: "text",
            text: text ? `Speech bubble: "${text}"` : "Speech bubble cleared",
          }],
        };

      case "show":
        sendCommand({ type: "show" });
        return { content: [{ type: "text", text: "Emote panel shown" }] };

      case "hide":
        sendCommand({ type: "hide" });
        return { content: [{ type: "text", text: "Emote panel hidden" }] };

      case "setTheme":
        sendCommand({
          type: "setTheme",
          themeId: (args as { themeId: string }).themeId,
        });
        return { content: [{ type: "text", text: `Theme changed to: ${(args as { themeId: string }).themeId}` }] };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }],
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error("Emote MCP Server running (file-based IPC)");
  console.error(`Command file: ${COMMAND_FILE}`);
});
