import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'url';
import type { FacialStatePayload } from '../character/types';

export class RagdollMCPServer {
  private server: Server;
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = 'http://localhost:3001') {
    this.apiBaseUrl = apiBaseUrl;
    this.server = new Server(
      {
        name: 'ragdoll-face-controller',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'setMood',
          description: 'Set the facial mood (smile, laugh, sad, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              mood: {
                type: 'string',
                enum: ['neutral', 'smile', 'frown', 'laugh', 'angry', 'sad'],
              },
              duration: {
                type: 'number',
                description: 'Transition duration in seconds',
                minimum: 0,
              },
            },
            required: ['mood'],
          },
        },
        {
          name: 'triggerAction',
          description: 'Trigger a facial action like wink or talk',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['wink', 'talk'],
              },
              duration: {
                type: 'number',
                minimum: 0.2,
              },
            },
            required: ['action'],
          },
        },
        {
          name: 'clearAction',
          description: 'Clear the active facial action (stop talking, etc.)',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'setHeadPose',
          description: 'Rotate the head a few degrees to the side or up/down',
          inputSchema: {
            type: 'object',
            properties: {
              yawDegrees: {
                type: 'number',
                description: 'Horizontal rotation (-35 to 35 degrees)',
                minimum: -35,
                maximum: 35,
              },
              pitchDegrees: {
                type: 'number',
                description: 'Vertical rotation (-20 to 20 degrees)',
                minimum: -20,
                maximum: 20,
              },
              duration: {
                type: 'number',
                minimum: 0.1,
              },
            },
          },
        },
        {
          name: 'setSpeechBubble',
          description: 'Show or clear the speech bubble text',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Bubble contents. Leave empty/null to clear.',
              },
              tone: {
                type: 'string',
                enum: ['default', 'whisper', 'shout'],
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
          case 'setMood':
            return await this.handleSetMood(args as any);
          case 'triggerAction':
            return await this.handleTriggerAction(args as any);
          case 'clearAction':
            return await this.handleClearAction();
          case 'setHeadPose':
            return await this.handleHeadPose(args as any);
          case 'setSpeechBubble':
            return await this.handleSpeechBubble(args as any);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async handleSetMood(args: { mood: string; duration?: number }) {
    await this.postFacialState({
      mood: { value: args.mood as any, duration: args.duration },
    });

    return {
      content: [{ type: 'text', text: `Mood set to ${args.mood}` }],
    };
  }

  private async handleTriggerAction(args: { action: 'wink' | 'talk'; duration?: number }) {
    await this.postFacialState({
      action: { type: args.action, duration: args.duration },
    });

    return {
      content: [{ type: 'text', text: `Action triggered: ${args.action}` }],
    };
  }

  private async handleClearAction() {
    await this.postFacialState({ clearAction: true });

    return {
      content: [{ type: 'text', text: 'Active action cleared' }],
    };
  }

  private async handleHeadPose(args: { yawDegrees?: number; pitchDegrees?: number; duration?: number }) {
    await this.postFacialState({
      headPose: {
        yaw: args.yawDegrees !== undefined ? this.degToRad(args.yawDegrees) : undefined,
        pitch: args.pitchDegrees !== undefined ? this.degToRad(args.pitchDegrees) : undefined,
        duration: args.duration,
      },
    });

    return {
      content: [{ type: 'text', text: 'Head pose updated' }],
    };
  }

  private async handleSpeechBubble(args: { text?: string; tone?: 'default' | 'whisper' | 'shout' }) {
    await this.postFacialState({
      bubble: {
        text: args.text?.trim() ? args.text : null,
        tone: args.tone,
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: args.text?.trim() ? `Bubble text set to: "${args.text}"` : 'Speech bubble cleared',
        },
      ],
    };
  }

  private async postFacialState(payload: FacialStatePayload): Promise<void> {
    await fetch(`${this.apiBaseUrl}/api/facial-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  private degToRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Ragdoll MCP Server running on stdio');
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
const executedFilePath = process.argv[1];
const isMainModule = currentFilePath === executedFilePath ||
                     executedFilePath?.endsWith('ragdoll-mcp-server.ts');

if (isMainModule) {
  const server = new RagdollMCPServer();
  server.start().catch(console.error);
}
