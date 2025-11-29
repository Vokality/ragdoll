import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "url";
import type { FacialStatePayload, FacialMood } from "@vokality/ragdoll";

// MCP Tool argument types
interface SetMoodArgs {
  mood: string;
  duration?: number;
  sessionId?: string;
}

interface TriggerActionArgs {
  action: "wink" | "talk";
  duration?: number;
  sessionId?: string;
}

interface ClearActionArgs {
  sessionId?: string;
}

interface SetHeadPoseArgs {
  yawDegrees?: number;
  pitchDegrees?: number;
  duration?: number;
  sessionId?: string;
}

interface SetSpeechBubbleArgs {
  text?: string;
  tone?: "default" | "whisper" | "shout";
  sessionId?: string;
}

export class RagdollMCPServer {
  private server: Server;
  private apiBaseUrl: string;

  constructor(apiBaseUrl?: string) {
    // Read from environment variable, constructor parameter, or default
    this.apiBaseUrl =
      apiBaseUrl || process.env.RAGDOLL_API_URL || "http://localhost:3001";
    this.server = new Server(
      {
        name: "ragdoll-face-controller",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "setMood",
          description: "Set the facial mood (smile, laugh, sad, etc.)",
          inputSchema: {
            type: "object",
            properties: {
              mood: {
                type: "string",
                enum: [
                  "neutral",
                  "smile",
                  "frown",
                  "laugh",
                  "angry",
                  "sad",
                  "surprise",
                  "confusion",
                  "thinking",
                ],
              },
              duration: {
                type: "number",
                description: "Transition duration in seconds",
                minimum: 0,
              },
              sessionId: {
                type: "string",
                description:
                  "Optional session ID. If not provided, uses default session.",
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
              sessionId: {
                type: "string",
                description:
                  "Optional session ID. If not provided, uses default session.",
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
            properties: {
              sessionId: {
                type: "string",
                description:
                  "Optional session ID. If not provided, uses default session.",
              },
            },
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
              sessionId: {
                type: "string",
                description:
                  "Optional session ID. If not provided, uses default session.",
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
              sessionId: {
                type: "string",
                description:
                  "Optional session ID. If not provided, uses default session.",
              },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "setMood":
            return await this.handleSetMood(args as unknown as SetMoodArgs);
          case "triggerAction":
            return await this.handleTriggerAction(
              args as unknown as TriggerActionArgs,
            );
          case "clearAction":
            return await this.handleClearAction(
              args as unknown as ClearActionArgs | undefined,
            );
          case "setHeadPose":
            return await this.handleHeadPose(
              args as unknown as SetHeadPoseArgs,
            );
          case "setSpeechBubble":
            return await this.handleSpeechBubble(
              args as unknown as SetSpeechBubbleArgs,
            );
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async handleSetMood(args: SetMoodArgs) {
    await this.postFacialState(
      {
        mood: { value: args.mood as FacialMood, duration: args.duration },
      },
      args.sessionId,
    );

    return {
      content: [
        {
          type: "text",
          text: `Mood set to ${args.mood}${args.sessionId ? ` (session: ${args.sessionId})` : ""}`,
        },
      ],
    };
  }

  private async handleTriggerAction(args: TriggerActionArgs) {
    await this.postFacialState(
      {
        action: { type: args.action, duration: args.duration },
      },
      args.sessionId,
    );

    return {
      content: [
        {
          type: "text",
          text: `Action triggered: ${args.action}${args.sessionId ? ` (session: ${args.sessionId})` : ""}`,
        },
      ],
    };
  }

  private async handleClearAction(args?: ClearActionArgs) {
    await this.postFacialState({ clearAction: true }, args?.sessionId);

    return {
      content: [{ type: "text", text: "Active action cleared" }],
    };
  }

  private async handleHeadPose(args: SetHeadPoseArgs) {
    await this.postFacialState(
      {
        headPose: {
          yaw:
            args.yawDegrees !== undefined
              ? this.degToRad(args.yawDegrees)
              : undefined,
          pitch:
            args.pitchDegrees !== undefined
              ? this.degToRad(args.pitchDegrees)
              : undefined,
          duration: args.duration,
        },
      },
      args.sessionId,
    );

    return {
      content: [{ type: "text", text: "Head pose updated" }],
    };
  }

  private async handleSpeechBubble(args: SetSpeechBubbleArgs) {
    await this.postFacialState(
      {
        bubble: {
          text: args.text?.trim() ? args.text : null,
          tone: args.tone,
        },
      },
      args.sessionId,
    );

    return {
      content: [
        {
          type: "text",
          text: args.text?.trim()
            ? `Bubble text set to: "${args.text}"`
            : "Speech bubble cleared",
        },
      ],
    };
  }

  private async postFacialState(
    payload: FacialStatePayload,
    sessionId?: string,
  ): Promise<void> {
    const url = new URL(`${this.apiBaseUrl}/api/facial-state`);
    if (sessionId) {
      url.searchParams.set("sessionId", sessionId);
    }
    await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  private degToRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Ragdoll MCP Server running on stdio");
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
const executedFilePath = process.argv[1];
const isMainModule =
  currentFilePath === executedFilePath ||
  executedFilePath?.endsWith("ragdoll-mcp-server.ts");

if (isMainModule) {
  // API URL can be set via RAGDOLL_API_URL environment variable
  const apiUrl = process.env.RAGDOLL_API_URL;
  const server = new RagdollMCPServer(apiUrl);
  server.start().catch(console.error);
}
