import { z } from "zod";
import type { ToolDefinition, ToolResult } from "@vokality/ragdoll-extensions";
import type { AgentToolService } from "./openai-service.js";
import type { ExtensionCardService } from "./extension-card-service.js";

const openCardSchema = z.object({ slotId: z.string().min(1) }).strict();
const emptySchema = z.object({}).strict();
const CARD_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "lumen_list_cards",
      description:
        "List available extension cards and the currently open card. Use the returned slotId to open a card. This does not execute extension actions.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lumen_open_card",
      description:
        "Open an extension card alongside the chat. Replaces the currently open card. Only changes what the user sees; call extension tools separately to read data or perform actions. Use an available slotId listed below, or refresh the list with lumen_list_cards.",
      parameters: {
        type: "object",
        properties: {
          slotId: {
            type: "string",
            description:
              "An available card's slotId returned by lumen_list_cards.",
          },
        },
        required: ["slotId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lumen_close_card",
      description:
        "Close, hide, or dismiss the currently open extension card and restore the full character. Call this whenever the user asks to close the card, including a bare close command. This action is idempotent: call it even if earlier messages say the card was closed, because the user can reopen cards manually. Does not stop timers, games, music, or other extension activity.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

/** Adds host presentation tools without contributing an extension or altering its tools. */
export class AppToolService implements AgentToolService {
  constructor(
    private readonly extensions: AgentToolService,
    private readonly cards: ExtensionCardService,
  ) {}

  getTools(): readonly ToolDefinition[] {
    const extensionTools = this.extensions.getTools();
    for (const tool of extensionTools) {
      if (
        CARD_TOOLS.some((host) => host.function.name === tool.function.name)
      ) {
        throw new Error(
          `Extension tool '${tool.function.name}' conflicts with an app tool.`,
        );
      }
    }
    const available = this.cards.list();
    const hostTools = CARD_TOOLS.map((tool): ToolDefinition => {
      if (tool.function.name === "lumen_close_card") {
        return {
          ...tool,
          function: {
            ...tool.function,
            description: `${tool.function.description} Current open card: ${JSON.stringify(this.cards.getActive())}.`,
          },
        };
      }
      if (tool.function.name !== "lumen_open_card") return tool;
      return {
        ...tool,
        function: {
          ...tool.function,
          description: `${tool.function.description} Available cards: ${JSON.stringify(available.map(({ slotId, label }) => ({ slotId, label })))}.`,
        },
      };
    });
    return [...extensionTools, ...hostTools];
  }

  getToolsForExtension(extensionId: string): readonly ToolDefinition[] {
    return this.extensions.getToolsForExtension(extensionId);
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    if (!CARD_TOOLS.some((tool) => tool.function.name === name)) {
      return this.extensions.executeTool(name, args);
    }
    try {
      if (name === "lumen_open_card") {
        const { slotId } = openCardSchema.parse(args);
        this.cards.select(slotId);
      } else {
        emptySchema.parse(args);
        if (name === "lumen_close_card") this.cards.select(null);
      }
      return {
        success: true,
        data: { cards: this.cards.list(), activeCard: this.cards.getActive() },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        retryable: error instanceof z.ZodError,
      };
    }
  }
}
