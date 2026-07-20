# @vokality/ragdoll-extensions

React-free extension contracts, lifecycle management, capability registration, and serializable slot state for Ragdoll hosts.

## Package boundaries

- `@vokality/ragdoll-extensions` — extension contracts, registry, host capabilities, config schemas, and React-free slot state.
- `@vokality/ragdoll-extensions/loader` — package discovery and loading through host-supplied filesystem and import adapters.
- `@vokality/ragdoll-extensions/slots` — explicit React-free slot entrypoint.
- `@vokality/ragdoll-extensions/ui` — optional React components and hooks.

Built-in extensions are independent packages. Import them directly from `@vokality/ragdoll-extension-character`, `@vokality/ragdoll-extension-tasks`, `@vokality/ragdoll-extension-pomodoro`, `@vokality/ragdoll-extension-spotify`, or `@vokality/ragdoll-extension-tic-tac-toe`.

## Installation

```bash
bun add @vokality/ragdoll-extensions
```

Add React only if the host uses the `/ui` entrypoint:

```bash
bun add react
```

## Create and register an extension

```ts
import {
  createExtension,
  createRegistry,
  type ExtensionHostEnvironment,
} from "@vokality/ragdoll-extensions";

const weather = createExtension({
  id: "weather",
  name: "Weather",
  version: "1.0.0",
  tools: [
    {
      definition: {
        type: "function",
        function: {
          name: "getWeather",
          description: "Get weather for a city",
          parameters: {
            type: "object",
            properties: { location: { type: "string" } },
            required: ["location"],
          },
        },
      },
      validate: (args) =>
        typeof args.location === "string"
          ? { valid: true }
          : { valid: false, error: "location is required" },
      handler: async ({ location }) => ({
        success: true,
        data: { location, condition: "sunny" },
      }),
    },
  ],
});

const host: ExtensionHostEnvironment = { capabilities: new Set() };
const registry = createRegistry({
  now: Date.now,
  onListenerError: console.error,
});
await registry.register(weather, { host });

const tools = registry.getAllTools();
const result = await registry.executeTool("getWeather", { location: "Paris" });
```

Registration is transactional: invalid, duplicate, conflicting, or partially activated contributions are rejected and cleaned up. Unregistration removes capability indexes before invoking extension cleanup.

## Host capabilities

Extensions access runtime services only through `ExtensionHostEnvironment`. Declare required capabilities in the runtime manifest and package manifest. The registry rejects activation when the host does not provide them.

Supported host boundaries include storage, logging, timers, scheduling, IPC, notifications, conversation events, OAuth, and config. Extension packages should not import an app or host implementation.

### Publish conversation events

Declare `conversationEvents` in `requiredCapabilities` when an extension needs
to record agent-visible activity:

```ts
if (!host.conversationEvents) {
  throw new Error("This extension requires conversationEvents");
}

await host.conversationEvents.publish({
  type: "sync.completed",
  payload: { changed: 3 },
  turnPolicy: "record-only",
});
```

Every accepted event becomes internal conversation context. Use `record-only`
when the next normal turn can consume the event. Use `start-turn` when core
should immediately ask the agent to evaluate the event. The agent can still
finish an event-triggered turn silently.

Core owns event IDs, source attribution, timestamps, persistence, model turns,
and renderer projection. Extensions cannot create visible messages directly.

## Load extension packages

The loader does not own a filesystem or assume a runtime. A Bun service, Electron main process, or another host supplies the adapter:

```ts
import { createLoader } from "@vokality/ragdoll-extensions/loader";

const loader = createLoader(registry, {
  packageRoots: [{ path: extensionsDirectory, layout: "installed" }],
  fileSystem: hostFileSystem,
  hostEnvironment: host,
});

const discovered = await loader.discoverPackages();
const result = await loader.loadPackage(discovered[0], {
  defaultUnits: "celsius",
});
```

An extension package declares `ragdollExtension` metadata in `package.json`. The loader verifies required host capabilities and checks that declared runtime capability types match the contribution before considering the package loaded.

## Slot state across IPC

Use the React-free state helpers inside extensions and serialize before crossing a process boundary:

```ts
import {
  createSlotState,
  serializeSlotState,
} from "@vokality/ragdoll-extensions/slots";

const state = createSlotState(
  {
    badge: 1,
    visible: true,
    panel: { type: "list", title: "Tasks", items: [] },
  },
  console.error,
);

const payload = serializeSlotState(state.getState());
```

Serialization removes callbacks while preserving `canClick` and `canToggle`. The host routes action IDs back to the owning slot; executable functions never cross IPC.

## Events and cleanup

```ts
const unsubscribe = registry.on("capability:registered", (event) => {
  console.log(event.extensionId, event.capabilityType, event.capabilityId);
});

await registry.unregister("weather");
unsubscribe();
await registry.destroy();
```
