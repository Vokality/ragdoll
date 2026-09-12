/**
 * Working list — a short ranked snapshot the agent fills, then shows as a card.
 *
 * Tools:
 * - working_list_set_items: Replace the list (at most five items)
 * - working_list_remove_item: Drop one item after it is handled
 * - working_list_clear: Empty the list
 * - working_list_get: Read the current snapshot
 *
 * Selecting an item publishes list.item.selected with start-turn.
 */

import {
  createExtension as defineExtension,
  z,
  type ExtensionHostEnvironment,
  type ExtensionRuntimeContribution,
  type ExtensionTool,
  type JsonObject,
  type RagdollExtension,
  type ToolParameterSchema,
  type ToolResult,
} from "@vokality/ragdoll-extensions";
import {
  createSlotState,
  type SlotState,
} from "@vokality/ragdoll-extensions/slots";
import {
  emptyArgsSchema,
  emptyParameters,
  emptyWorkingListState,
  removeItemArgsSchema,
  removeItemParameters,
  setItemsArgsSchema,
  setItemsParameters,
  workingListStateSchema,
  type WorkingListItem,
  type WorkingListState,
} from "./working-list-state.js";

export {
  DEFAULT_WORKING_LIST_TITLE,
  MAX_WORKING_LIST_ITEMS,
  emptyWorkingListState,
  removeItemArgsSchema,
  setItemsArgsSchema,
  workingListItemSchema,
  workingListStateSchema,
} from "./working-list-state.js";
export type {
  WorkingListItem,
  WorkingListState,
} from "./working-list-state.js";

const DEFAULT_EXTENSION_ID = "working-list";
const DEFAULT_STORAGE_KEY = "state";
const REQUIRED_HOST_CAPABILITIES = [
  "storage",
  "logger",
  "conversationEvents",
] as const;

function toItemPayload(item: WorkingListItem, title: string): JsonObject {
  return {
    itemId: item.id,
    label: item.label,
    sublabel: item.sublabel ?? null,
    ref: item.ref ?? null,
    title,
  };
}

async function createRuntime(
  host: ExtensionHostEnvironment,
): Promise<ExtensionRuntimeContribution> {
  if (!host.storage || !host.logger || !host.conversationEvents) {
    throw new Error(
      "Working list requires host storage, logger, and conversationEvents",
    );
  }
  const storage = host.storage;
  const logger = host.logger;
  const conversationEvents = host.conversationEvents;
  const saved = await storage.read(DEFAULT_EXTENSION_ID, DEFAULT_STORAGE_KEY);
  let state: WorkingListState =
    saved === undefined
      ? emptyWorkingListState(Date.now())
      : workingListStateSchema.parse(saved);
  let queue = Promise.resolve();
  let disposed = false;

  const slotState = createSlotState(listPanel(state), (error) => {
    logger.error("Working list slot listener failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  function listPanel(next: WorkingListState): SlotState {
    return {
      badge: next.items.length || null,
      visible: true,
      panel: {
        type: "list",
        title: next.title,
        emptyMessage: "Ask Lumen to fill this list.",
        items: next.items.map((item) => ({
          id: item.id,
          label: item.label,
          sublabel: item.sublabel,
          onClick: () => selectItem(item.id),
        })),
        ...(next.items.length > 0
          ? {
              status: {
                label:
                  next.items.length === 1
                    ? "1 item"
                    : `${next.items.length} items`,
              },
              actions: [
                {
                  id: "clear",
                  label: "Clear",
                  variant: "secondary",
                  onClick: async () => {
                    await clearList();
                  },
                },
              ],
            }
          : {}),
      },
    };
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = queue.then(() => {
      if (disposed) throw new Error("Working list extension is unloaded");
      return operation();
    });
    queue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  async function commit(next: WorkingListState): Promise<ToolResult> {
    const parsed = workingListStateSchema.parse(next);
    const snapshot = structuredClone(parsed);
    await storage.write(DEFAULT_EXTENSION_ID, DEFAULT_STORAGE_KEY, snapshot);
    state = snapshot;
    slotState.replaceState(listPanel(state));
    return { success: true, data: structuredClone(state) };
  }

  function clearList(): Promise<ToolResult> {
    return enqueue(() => commit(emptyWorkingListState(Date.now())));
  }

  async function selectItem(itemId: string): Promise<void> {
    await enqueue(async () => {
      const item = state.items.find((candidate) => candidate.id === itemId);
      if (!item) return;
      try {
        await conversationEvents.publish({
          type: "list.item.selected",
          payload: toItemPayload(item, state.title),
          turnPolicy: "start-turn",
          deduplicationKey: globalThis.crypto.randomUUID(),
        });
      } catch (error) {
        logger.error("Failed to publish working list selection", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  }

  function tool<T extends z.ZodType>(
    name: string,
    description: string,
    schema: T,
    parameters: ToolParameterSchema,
    run: (args: z.output<T>) => Promise<ToolResult>,
  ): ExtensionTool {
    return {
      definition: {
        type: "function",
        function: { name, description, parameters },
      },
      validate: (args) => {
        const result = schema.safeParse(args);
        return result.success
          ? { valid: true }
          : { valid: false, error: result.error.message, retryable: true };
      },
      handler: async (args) => {
        try {
          return await run(schema.parse(args));
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            retryable: error instanceof z.ZodError,
          };
        }
      },
    };
  }

  return {
    tools: [
      tool(
        "working_list_set_items",
        "Replace the working list with up to 5 short items (for example emails to reply to after calling a connection). Then open the card with lumen_open_card using slotId working-list.main. Opening is a separate app tool. Store a stable item id and optional ref from the source system so a later selection can continue the work.",
        setItemsArgsSchema,
        setItemsParameters,
        ({ title, items }) =>
          enqueue(() =>
            commit({
              title,
              items,
              updatedAt: Date.now(),
            }),
          ),
      ),
      tool(
        "working_list_remove_item",
        "Remove one working-list item after it has been handled. Does not call the source connection.",
        removeItemArgsSchema,
        removeItemParameters,
        ({ itemId }) =>
          enqueue(async () => {
            if (!state.items.some((item) => item.id === itemId)) {
              return { success: false, error: `Item not found: ${itemId}` };
            }
            return commit({
              ...state,
              items: state.items.filter((item) => item.id !== itemId),
              updatedAt: Date.now(),
            });
          }),
      ),
      tool(
        "working_list_clear",
        "Empty the working list. Does not call remote tools or connections.",
        emptyArgsSchema,
        emptyParameters,
        () => clearList(),
      ),
      tool(
        "working_list_get",
        "Read the current working list snapshot.",
        emptyArgsSchema,
        emptyParameters,
        () =>
          enqueue(async () => ({
            success: true,
            data: structuredClone(state),
          })),
      ),
    ],
    slots: [
      {
        id: `${DEFAULT_EXTENSION_ID}.main`,
        label: "Working list",
        icon: "list",
        priority: 90,
        state: slotState,
      },
    ],
    dispose: () => {
      disposed = true;
    },
  };
}

export function createExtension(): RagdollExtension {
  return defineExtension({
    id: DEFAULT_EXTENSION_ID,
    name: "Working List",
    version: "0.1.0",
    description:
      "A short list the agent fills from tools or connections, then shows as a card",
    requiredCapabilities: [...REQUIRED_HOST_CAPABILITIES],
    optionalCapabilities: [],
    createRuntime,
  });
}
