# Ragdoll Architecture

## Dependency direction

```text
apps/chat ───────────────┐
apps/emote ──────────────┼──> @vokality/ragdoll
                         │
apps/chat ───────────────┼──> first-party extensions
                         │              │
example weather ─────────┤              v
                         └──> @vokality/ragdoll-extensions
```

The framework never imports an app or a first-party extension. Extension packages never import an app or one another. Apps compose packages and implement runtime-specific adapters.

## Character package

`@vokality/ragdoll` owns the React/Three.js character and its domain model:

- controllers coordinate expression, head pose, actions, and idle behavior;
- models represent geometry and the skeleton;
- `RagdollCharacter` renders a themed perspective Three.js canvas from outline-path geometry;
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

### Package loading

The loader has no filesystem dependency. Its host supplies:

- search roots;
- `readFile`, `readDirectory`, and `pathExists`;
- optional module import behavior;
- a static or per-extension host environment.

The loader resolves package exports, constructs the extension by calling `createExtension(config?)`, registers it, and verifies that package-declared capability types match the actual contribution. A mismatch is rolled back. The loader does not accept a bare extension object; register those through the registry.

### UI slots and IPC

Extensions contribute React-free observable slot state. Panel configurations are `list`, `grid`, or `cards`. `serializeSlotState` removes callbacks while preserving action availability as `canClick`, `canToggle`, and `canSubmit`. The renderer hydrates callbacks that send a discriminated action request back to the Electron owner (`panel-action`, `section-action`, `item-click`, `item-toggle`, `cell-click`, or `answer-submit` with a required string payload). The main process invokes only the callback belonging to the identified slot, section, item, cell, or cards answer submit.

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

### Emote

VS Code owns the extension host runtime. Emote is an MCP character host: it
bundles the VS Code entrypoint and a standalone MCP helper that drives
`@vokality/ragdoll` over a local Unix socket (named pipe on Windows). It does
not load Ragdoll extensions or implement `ExtensionHostEnvironment`.

## Monorepo build

The root Bun workspace uses one lockfile and a dependency catalog. Build order is explicit:

1. character and extension framework libraries;
2. first-party extension packages;
3. example extension;
4. applications.

Each workspace cleans only its own output before compilation, preventing deleted source files from surviving in publish artifacts.

`scripts/verify-architecture.ts` (run by `bun run typecheck`) checks source imports and `package.json` dependency graphs for the rules above. It skips test files, does not prove `serializeSlotState` behavior, and does not inspect Electron IPC runtime wiring beyond channel-name literals in `apps/chat`.
