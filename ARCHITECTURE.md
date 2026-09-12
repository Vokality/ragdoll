# Ragdoll Architecture

## Dependency direction

```text
apps/chat ─────────────────────> @vokality/ragdoll
    │
    ├──> first-party extensions ──┐
    │                            │
    └────────────────────────────┼──> @vokality/ragdoll-extensions
examples/extension-weather ──────┘
```

The framework never imports an app or a first-party extension. Extension packages never import an app or one another. Apps compose packages and implement runtime-specific adapters.

## Character package

`@vokality/ragdoll` owns the React/Three.js character and its domain model:

- controllers coordinate expression, head pose, actions, and idle behavior;
- models represent geometry and the skeleton;
- `RagdollCharacter` renders an anatomical head in a themed perspective Three.js canvas, with facial morph targets and scalp-fitted grooming;
- state and events are framework-local;
- themes and variants are registered through typed APIs;
- `/testing` exposes reusable clocks, builders, and mocks.

React is a peer dependency so the host owns the React instance.

## Extension framework

The default entrypoint is React-free. It owns:

- extension and tool contracts;
- lifecycle and transactional registration;
- capability indexes for tools, services, state channels, and slots;
- host capability contracts;
- config and OAuth schemas;
- serializable slot state.

Services are an in-process contribution type. First-party packages currently
contribute tools, slots, and state channels.

Runtime-specific features are separate entrypoints:

- `/loader` loads packages through injected filesystem and import adapters;
- `/slots` is an explicit React-free state entrypoint;
- `/ui` contains React components and hooks.

### Registration lifecycle

```text
validate manifest
  -> verify required host capabilities
  -> activate extension
  -> validate contribution and conflicts
  -> attach indexes
  -> publish registration events
```

If activation or validation fails, the registry disposes the partial contribution and deactivates the extension. During unregister, indexes are detached before removal events and cleanup.

### Host boundary

`ExtensionHostEnvironment` is the only route from an extension into its host. A host must both list a capability in `capabilities` and provide the matching implementation field. Required capabilities:

- storage
- logger
- timers
- scheduler
- IPC
- notifications
- config
- OAuth
- conversationEvents

Optional capabilities are metadata: the loader requires the package and runtime optional lists to match exactly. The registry does not fail activation when an optional capability is absent; Lumen grants an optional capability only when the extension asked for it and the backing service exists.

An extension declares required and optional host capabilities in both its runtime manifest and package metadata. The loader requires those lists to be identical before registration; it does not merge them.

Host storage reads return `unknown`; each extension validates its own persisted state before loading it into domain objects. Lumen serializes mutations per extension, snapshots JSON values at the write boundary, and atomically replaces private storage files. Missing keys return `undefined`; malformed documents fail without resetting stored data.

### Package loading

The loader has no filesystem dependency. Its host supplies:

- search roots;
- `readFile`, `readDirectory`, and `pathExists`;
- optional module import behavior;
- a static or per-extension host environment.

The loader resolves package exports, constructs the extension by calling `createExtension(config?)`, registers it, and verifies that package-declared capability types match the actual contribution. A mismatch is rolled back. The loader does not accept a bare extension object; register those through the registry.

### UI slots and IPC

All panel kinds share `PanelFrame`: fixed identity/status/progress in the header, bounded content, and fixed footer controls. The host supplies card bounds and avatar space; the shared renderer owns sizing and scrolling. See [extension card layout](docs/extension-card-layout.md) for region and authoring rules.

Extensions contribute React-free observable slot state. Panel configurations are `list`, `grid`, `cards`, `canvas`, or `document`. `serializeSlotState` removes callbacks while preserving action availability as `canClick`, `canToggle`, and `canSubmit`. The renderer hydrates callbacks that send a discriminated action request back to the Electron owner (`panel-action`, `section-action`, `item-click`, `item-toggle`, `cell-click`, or `answer-submit` with a required string payload). The main process invokes only the callback belonging to the identified slot, section, item, cell, or cards answer submit.

This keeps functions and React objects out of IPC payloads.

### Event naming

Event names identify their boundary:

- in-process lifecycle events use `scope:event` (for example, `task:added`);
- persisted extension conversation events use `domain.event` (for example, `timer.completed`);
- Electron IPC channels use `namespace:operation` and are declared once in `IPC_CHANNELS`.

Conversation-event input is validated at the host boundary before it is persisted. Lumen enforces the `domain.event` type pattern exported as `CONVERSATION_EVENT_TYPE_PATTERN`. IPC producers and consumers share the same channel constants. Host `ipc` topics are owner-scoped: an extension may use `extension-tool:<id>` or topics prefixed with `<id>:`.

## Application composition

### Chat

The Electron main process owns filesystem, persistence, OAuth, notification, and IPC adapters. `ExtensionManager` composes the registry and loader, tracks state/slot subscriptions from capability events, and exposes serialized data to the renderer. GitHub-installed extension tarballs are checked against the GitHub asset `sha256` digest when the API provides one, then against package identity and semver.

The React renderer consumes only browser-safe entrypoints. It does not import the loader or Electron main-process modules.

### Model providers

Lumen composes a small `ModelProvider` facade for OpenAI and Grok. Each provider owns response sessions, key validation, model metadata, and hosted search. The shared agent owns tool execution, durable history, memory, and event decisions; it has no SDK types. `ProviderAgentFactory` snapshots the selected provider and encrypted credential once per turn so search and memory summaries use the same provider. Protocol output and encrypted reasoning stay inside the response session. See [Model providers](docs/model-providers.md) for the contract, storage migration, and adding adapters.

## Monorepo build

The root Bun workspace uses one lockfile and a dependency catalog. Build order is explicit:

1. character and extension framework libraries;
2. first-party extension packages;
3. example extension;
4. applications.

Each workspace cleans only its own output before compilation, preventing deleted source files from surviving in publish artifacts.

Lumen development uses `Bun.build` for executable workspace modules and Electron bundles, and `Bun.serve` with HTML imports for renderer hot reload. The launcher owns both the server and Electron process and stops the server when Electron exits. Development builds omit declarations; normal library builds and type checks generate and validate the public declarations before publishing.

Production renderer builds use Bun's HTML bundler with relative asset URLs for Electron's `file://` loading. Browser regressions bundle their HTML and adjacent module files with Bun, serve only the generated fixtures on an ephemeral loopback port, and run Electron with an isolated profile. The production renderer is also exercised through the real preload and host.

Documentation uses `Bun.markdown`, `HTMLRewriter`, `Bun.build`, and `Bun.serve`. The static build validates page, asset, and fragment links before writing `docs/site/dist`; GitHub Pages serves that output at `/ragdoll/`. Development output is isolated in `docs/site/.dev`.

`scripts/verify-architecture.ts` (run by `bun run typecheck`) checks source imports and `package.json` dependency graphs for the rules above. It skips test files, does not prove `serializeSlotState` behavior, and does not inspect Electron IPC runtime wiring beyond channel-name literals in `apps/chat`.

## Lumen connections

Lumen owns MCP connections independently of extensions. Configuration and agent access live in the host; credentials stay encrypted in the main process. The MCP SDK executes remote tools through Lumen’s provider-neutral function-tool loop and durable history. See [Connections](docs/connections.md) for lifecycle, OAuth, settings, and supported transports.
