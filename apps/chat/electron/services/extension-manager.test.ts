import { describe, expect, it } from "bun:test";
import {
  createExtension,
  createSlotState,
  type ConfigSchema,
  type ExtensionHostEnvironment,
} from "@vokality/ragdoll-extensions";
import type { ExtensionPackageDescriptor } from "@vokality/ragdoll-extensions/loader";
import {
  ExtensionManager,
  type BuiltInExtensionDefinition,
} from "./extension-manager.js";
import { ExtensionStorage } from "../infrastructure/extension-storage.js";
import { ExtensionMessageBus } from "./extension-message-bus.js";
import type { ExtensionConversationEventPublisher } from "./conversation-event-service.js";
import type { ExtensionHostDataStore } from "../infrastructure/extension-host-data-repository.js";
import type { OAuthRedirectService } from "./oauth-loopback-service.js";

const host: ExtensionHostEnvironment = { capabilities: new Set() };

const hostData: ExtensionHostDataStore = {
  loadConfig: async () => null,
  saveConfig: async () => undefined,
  loadOAuthTokens: async () => null,
  saveOAuthTokens: async () => undefined,
  clearOAuthTokens: async () => undefined,
};

const oauthRedirects: OAuthRedirectService = {
  createSession: async () => {
    throw new Error("OAuth redirect was not expected");
  },
  destroy: () => undefined,
};

function descriptor(
  id: string,
  capabilities: ExtensionPackageDescriptor["capabilities"],
  options: {
    name?: string;
    canDisable?: boolean;
    requiredCapabilities?: ExtensionPackageDescriptor["requiredCapabilities"];
    configSchema?: ConfigSchema;
    oauth?: ExtensionPackageDescriptor["oauth"];
  } = {},
): ExtensionPackageDescriptor {
  return {
    packageName: `@example/${id}`,
    extensionId: id,
    name: options.name ?? id,
    version: "1.0.0",
    canDisable: options.canDisable ?? false,
    capabilities,
    requiredCapabilities: options.requiredCapabilities ?? [],
    configSchema: options.configSchema,
    oauth: options.oauth,
  };
}

function createManager(
  onSlotStateChange?: () => void,
  builtInExtensions: readonly BuiltInExtensionDefinition[] = [],
  conversationEvents: ExtensionConversationEventPublisher = {
    publish: async () => ({ eventId: "event-id" }),
  },
  hostDataStore: ExtensionHostDataStore = hostData,
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
    hostData: hostDataStore,
    oauthRedirects,
    openExternal: async () => {},
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
  it("disables and re-enables an unconfigured extension without activating it", async () => {
    let activationCount = 0;
    const manager = createManager(undefined, [
      {
        descriptor: descriptor("configurable", ["tools"], {
          canDisable: true,
          configSchema: {
            apiKey: {
              type: "string",
              label: "API key",
              required: true,
            },
          },
        }),
        createExtension: () =>
          createExtension({
            id: "configurable",
            name: "configurable",
            version: "1.0.0",
            onInitialize: () => {
              activationCount += 1;
            },
            tools: [
              {
                definition: {
                  type: "function",
                  function: {
                    name: "configuredTool",
                    description: "Configured tool",
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
    await manager.setDisabledExtensions(["configurable"]);
    expect(manager.getDisabledExtensions()).toEqual(["configurable"]);
    expect(activationCount).toBe(0);

    await manager.setDisabledExtensions([]);
    expect(manager.getDisabledExtensions()).toEqual([]);
    expect(activationCount).toBe(0);

    await manager.destroy();
  });

  it("registers built-ins directly and enforces declared capabilities", async () => {
    const manager = createManager(undefined, [
      {
        descriptor: descriptor("builtin", ["tools"], { name: "Built in" }),
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
          descriptor: descriptor("publisher", ["tools"], {
            name: "Publisher",
            requiredCapabilities: ["conversationEvents"],
          }),
          createExtension: () =>
            createExtension({
              id: "publisher",
              name: "Publisher",
              version: "1.0.0",
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
          descriptor: descriptor("non-publisher", ["tools"], {
            name: "Non-publisher",
          }),
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

  it("discovers a configurable OAuth built-in and activates it after configuration", async () => {
    let values: Record<string, string | number | boolean> | null = null;
    let receivedOAuth = false;
    let receivedConfig = false;
    const configSchema = {
      clientId: {
        type: "string" as const,
        label: "Client ID",
        required: true,
      },
    };
    const oauth = {
      provider: "example",
      authorizationUrl: "https://accounts.example.com/authorize",
      tokenUrl: "https://accounts.example.com/token",
      scopes: ["playback"],
      clientIdConfigKey: "clientId",
      pkce: true as const,
    };
    const configurableHostData: ExtensionHostDataStore = {
      ...hostData,
      loadConfig: async () => values,
      saveConfig: async (_extensionId, _schema, next) => {
        values = structuredClone(next);
      },
    };
    const manager = createManager(
      undefined,
      [
        {
          descriptor: descriptor("oauth-built-in", ["tools"], {
            name: "OAuth built-in",
            requiredCapabilities: ["oauth"],
            configSchema,
            oauth,
          }),
          createExtension: () =>
            createExtension({
              id: "oauth-built-in",
              name: "OAuth built-in",
              version: "1.0.0",
              requiredCapabilities: ["oauth"],
              onInitialize: (_context, environment) => {
                receivedOAuth = Boolean(environment.oauth);
                receivedConfig = Boolean(environment.config);
              },
              tools: [
                {
                  definition: {
                    type: "function",
                    function: {
                      name: "oauthTool",
                      description: "OAuth tool",
                      parameters: { type: "object", properties: {} },
                    },
                  },
                  handler: () => ({ success: true }),
                },
              ],
            }),
        },
      ],
      undefined,
      configurableHostData,
    );

    await manager.initialize();
    expect(manager.getAvailableExtensions()).toHaveLength(0);
    expect(manager.getDiscoveredExtensions()).toMatchObject([
      { id: "oauth-built-in", hasConfigSchema: true, hasOAuth: true },
    ]);

    await manager.setConfigValues("oauth-built-in", {
      clientId: "client-id",
    });
    expect(manager.getAvailableExtensions()).toMatchObject([
      { id: "oauth-built-in", hasConfigSchema: true, hasOAuth: true },
    ]);
    expect(receivedOAuth).toBe(true);
    expect(receivedConfig).toBe(true);
    await manager.destroy();
  });
});
