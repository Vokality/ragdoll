import { describe, expect, it } from "bun:test";
import {
  createExtension,
  createSlotState,
  type ExtensionHostEnvironment,
} from "@vokality/ragdoll-extensions";
import {
  ExtensionManager,
  type BuiltInExtensionDefinition,
} from "./extension-manager.js";
import { ExtensionStorage } from "../infrastructure/extension-storage.js";
import { ExtensionMessageBus } from "./extension-message-bus.js";
import type { ExtensionConversationEventPublisher } from "./conversation-event-service.js";

const host: ExtensionHostEnvironment = { capabilities: new Set() };

function createManager(
  onSlotStateChange?: () => void,
  builtInExtensions: readonly BuiltInExtensionDefinition[] = [],
  conversationEvents: ExtensionConversationEventPublisher = {
    publish: async () => ({ eventId: "event-id" }),
  },
): ExtensionManager {
  return new ExtensionManager({
    packageRoots: [],
    builtInExtensions,
    fileSystem: {
      readFile: async () => "",
      readDirectory: async () => [],
      pathExists: async () => false,
    },
    storage: new ExtensionStorage("/tmp/ragdoll-extension-manager-test"),
    messageBus: new ExtensionMessageBus(() => undefined),
    conversationEvents,
    openExternal: async () => {},
    oauthRedirectBase: "lumen://oauth",
    onSlotStateChange: onSlotStateChange
      ? () => onSlotStateChange()
      : undefined,
  });
}

describe("ExtensionManager slot integration", () => {
  it("subscribes and unsubscribes as slot capabilities change", async () => {
    let stateChangeCount = 0;
    const manager = createManager(() => {
      stateChangeCount += 1;
    });
    await manager.initialize();

    const slotState = createSlotState({
      badge: null,
      visible: true,
      panel: { type: "list", title: "Dynamic", items: [] },
    });
    const extension = createExtension({
      id: "dynamic-slot",
      name: "Dynamic Slot",
      version: "1.0.0",
      slots: [
        {
          id: "dynamic-slot.main",
          label: "Dynamic",
          icon: "star",
          state: slotState,
        },
      ],
    });

    await manager.getRegistry().register(extension, { host });
    slotState.setBadge(1);
    expect(stateChangeCount).toBe(1);

    await manager.getRegistry().unregister("dynamic-slot");
    slotState.setBadge(2);
    expect(stateChangeCount).toBe(1);

    await manager.destroy();
  });

  it("routes every supported list-panel action", async () => {
    const calls: string[] = [];
    const manager = createManager();
    await manager.initialize();

    const slotState = createSlotState({
      badge: null,
      visible: true,
      panel: {
        type: "list",
        title: "Actions",
        actions: [
          { id: "panel", label: "Panel", onClick: () => calls.push("panel") },
        ],
        items: [
          {
            id: "root-item",
            label: "Root item",
            onClick: () => calls.push("root-click"),
          },
        ],
        sections: [
          {
            id: "section",
            title: "Section",
            actions: [
              {
                id: "section",
                label: "Section",
                onClick: () => calls.push("section"),
              },
            ],
            items: [
              {
                id: "section-item",
                label: "Section item",
                onClick: () => calls.push("section-click"),
                onToggle: () => calls.push("section-toggle"),
              },
            ],
          },
        ],
      },
    });
    await manager.getRegistry().register(
      createExtension({
        id: "actions",
        name: "Actions",
        version: "1.0.0",
        slots: [
          {
            id: "actions.main",
            label: "Actions",
            icon: "star",
            state: slotState,
          },
        ],
      }),
      { host },
    );

    expect(
      await manager.executeSlotAction("actions.main", "panel-action", "panel"),
    ).toEqual({ success: true });
    expect(
      await manager.executeSlotAction(
        "actions.main",
        "section-action",
        "section",
      ),
    ).toEqual({ success: true });
    expect(
      await manager.executeSlotAction(
        "actions.main",
        "item-click",
        "root-item",
      ),
    ).toEqual({ success: true });
    expect(
      await manager.executeSlotAction(
        "actions.main",
        "item-click",
        "section-item",
      ),
    ).toEqual({ success: true });
    expect(
      await manager.executeSlotAction(
        "actions.main",
        "item-toggle",
        "section-item",
      ),
    ).toEqual({ success: true });
    expect(calls).toEqual([
      "panel",
      "section",
      "root-click",
      "section-click",
      "section-toggle",
    ]);
    expect(manager.getSlotState("actions.main")?.panel).toMatchObject({
      actions: [{ id: "panel" }],
      items: [{ id: "root-item", canClick: true, canToggle: false }],
      sections: [
        {
          id: "section",
          items: [{ id: "section-item", canClick: true, canToggle: true }],
        },
      ],
    });

    await manager.destroy();
  });
});

describe("ExtensionManager built-in boundaries", () => {
  it("registers built-ins directly and enforces declared capabilities", async () => {
    const manager = createManager(undefined, [
      {
        packageName: "@example/builtin",
        canDisable: false,
        capabilities: ["tools"],
        createExtension: () =>
          createExtension({
            id: "builtin",
            name: "Built in",
            version: "1.0.0",
            tools: [
              {
                definition: {
                  type: "function",
                  function: {
                    name: "builtinTool",
                    description: "Built in tool",
                    parameters: { type: "object", properties: {} },
                  },
                },
                handler: () => ({ success: true }),
              },
            ],
          }),
      },
    ]);

    await manager.initialize();
    expect(manager.getAvailableExtensions().map(({ id }) => id)).toEqual([
      "builtin",
    ]);
    expect(manager.getLoadedPackages()).toEqual([]);
    await manager.destroy();
  });

  it("grants conversation events only when declared and binds the source extension", async () => {
    const published: Array<{ extensionId: string; type: string }> = [];
    let undeclaredCapabilityWasPresent = false;
    const conversationEvents: ExtensionConversationEventPublisher = {
      publish: async (extensionId, event) => {
        published.push({ extensionId, type: event.type });
        return { eventId: "event-id" };
      },
    };
    const tool = {
      definition: {
        type: "function" as const,
        function: {
          name: "noop",
          description: "No operation",
          parameters: { type: "object" as const, properties: {} },
        },
      },
      handler: () => ({ success: true }),
    };
    const manager = createManager(
      undefined,
      [
        {
          packageName: "@example/publisher",
          canDisable: false,
          capabilities: ["tools"],
          createExtension: () =>
            createExtension({
              id: "publisher",
              name: "Publisher",
              version: "1.0.0",
              requiredCapabilities: ["conversationEvents"],
              tools: [tool],
              onInitialize: async (_context, hostEnvironment) => {
                if (!hostEnvironment.conversationEvents) {
                  throw new Error("conversationEvents was not granted");
                }
                await hostEnvironment.conversationEvents.publish({
                  type: "test.completed",
                  payload: {},
                  turnPolicy: "record-only",
                });
              },
            }),
        },
        {
          packageName: "@example/non-publisher",
          canDisable: false,
          capabilities: ["tools"],
          createExtension: () =>
            createExtension({
              id: "non-publisher",
              name: "Non-publisher",
              version: "1.0.0",
              tools: [
                {
                  ...tool,
                  definition: {
                    ...tool.definition,
                    function: {
                      ...tool.definition.function,
                      name: "otherNoop",
                    },
                  },
                },
              ],
              onInitialize: (_context, hostEnvironment) => {
                undeclaredCapabilityWasPresent = Boolean(
                  hostEnvironment.conversationEvents,
                );
              },
            }),
        },
      ],
      conversationEvents,
    );

    await manager.initialize();

    expect(published).toEqual([
      { extensionId: "publisher", type: "test.completed" },
    ]);
    expect(undeclaredCapabilityWasPresent).toBe(false);
    await manager.destroy();
  });
});
