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

`@vokality/ragdoll` owns the React/SVG character and its domain model:

- controllers coordinate expression, head pose, actions, and idle behavior;
- models represent geometry and the skeleton;
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

`ExtensionHostEnvironment` is the only route from an extension into its host. Capabilities are explicit and optional:

- storage
- logger
- timers and scheduler
- IPC
- notifications
- config
- OAuth

An extension declares required host capabilities in both its runtime manifest and package metadata. The loader merges those requirements before registration.

### Package loading

The loader has no filesystem dependency. Its host supplies:

- search roots;
- `readFile`, `readDirectory`, and `pathExists`;
- optional module import behavior;
- a static or per-extension host environment.

The loader resolves package exports, constructs the configured extension, registers it, and verifies that package-declared capability types match the actual contribution. A mismatch is rolled back.

### UI slots and IPC

Extensions contribute React-free observable slot state. `serializeSlotState` removes callbacks while preserving action availability as `canClick` and `canToggle`. The renderer hydrates callbacks that send an action descriptor back to the Electron owner. The main process invokes only the callback belonging to the identified slot, section, item, or panel action.

This keeps functions and React objects out of IPC payloads.

## Application composition

### Chat

The Electron main process owns filesystem, persistence, OAuth, notification, and IPC adapters. `ExtensionManager` composes the registry and loader, tracks state/slot subscriptions from capability events, and exposes serialized data to the renderer.

The React renderer consumes only browser-safe entrypoints. It does not import the loader or Electron main-process modules.

### Emote

VS Code owns the extension host runtime. Emote bundles the extension entrypoint and a standalone MCP helper, while its webview consumes `@vokality/ragdoll` as a React dependency.

## Monorepo build

The root Bun workspace uses one lockfile and a dependency catalog. Build order is explicit:

1. character and extension framework libraries;
2. first-party extension packages;
3. example extension;
4. applications.

Each workspace cleans only its own output before compilation, preventing deleted source files from surviving in publish artifacts.
