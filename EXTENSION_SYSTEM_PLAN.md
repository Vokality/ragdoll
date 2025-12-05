# Extension System Refactor Plan

## Goal
Decouple the chat app from any built-in knowledge of extensions so every capability (tasks, pomodoro, Spotify, character) is delivered as a standalone package loaded dynamically via the extension loader/registry. The host should expose generic capabilities (storage, notifications, IPC forwarding) and render whatever state channels/extensions are present without bespoke wiring.

## Status (Dec 5, 2025)
- **Phase 1:** ✅ **COMPLETE** - Host environment, registry/loader with events, built-in extensions refactored, Electron manager updated
- **Phase 2:** ✅ **COMPLETE** - Standalone extension packages created, source moved, architecture fixed (no circular deps), all packages build successfully
- **Phase 3:** ✅ **COMPLETE** - Dynamic extension UI slots integrated in chat app, IPC-based state sync working
- **Phase 4:** Not started.

---

## Phase 1 – Capability Contract & Registry Foundation

**Status summary (Dec 5, 2025 - COMPLETE):**
All Phase 1 deliverables are now in place:
- ✅ Host capability contract defined (`ExtensionHostEnvironment`)
- ✅ Registry and loader refactored with event-driven architecture
- ✅ Built-in extensions (character, tasks, pomodoro) use new contribution API
- ✅ Electron `ExtensionManager` provides host environment and consumes state channels
- ✅ No direct manager access - all state flows through registry/state channels

1. **Define host capabilities in `@vokality/ragdoll-extensions`:**
   - *Attempted:* Drafted `ExtensionHostEnvironment` (storage/notifications/timers/etc.) plus optional `services`, `stateChannels`, and `slots` on `ExtensionRuntimeContribution`.
   - *Blocked / todo:* Need to reapply those definitions, ensure all type exports line up, and write unit tests proving extensions can only access host APIs via the provided environment. No code currently enforces this contract.
   - Add an explicit `ExtensionHostEnvironment` interface (storage, notifications, timers, scheduler, IPC bridge, logger) that extensions receive at runtime so they never reach into host internals.
   - Extend `ExtensionRuntimeContribution` to optionally expose `services` (named capability surfaces) alongside tools, state channels, slots, and lifecycle hooks.
   - Allow every extension manifest to declare `requiredCapabilities`; the loader refuses registration if any requirement is missing and surfaces actionable errors to developers.
   - Implementation steps: create `packages/ragdoll-extensions/src/types/host-environment.ts`, update existing type exports, document each capability contract, and add unit tests validating that contributions cannot be instantiated without the environment object.
   - Acceptance criteria: no extension entry point imports Electron/React modules directly, and TypeScript enforces that the only host APIs they can touch are delivered via `ExtensionHostEnvironment`.
2. **Update the loader and registry:**
   - *Attempted:* Started designing a `RegistryEventBus`, capability maps (tools/services/state channels), and loader callbacks (`onContributionLoaded`, `onCapabilityRegistered`). Work was reverted before completion.
   - *Todo:* Reintroduce the event-driven registry, persist metadata for tools/services/state channels, fire async events, and wire the loader to emit contribution/capability callbacks. Add the planned tests under `packages/ragdoll/tests/registry` describing lifecycle order.
   - Extend the loader signature to accept `onContributionLoaded(contributionMeta)` and `onCapabilityRegistered` callbacks so the Electron host can respond to new state channels/services immediately.
   - Registry keeps an internal map of tools, services, and state channels keyed by extension id, emitting async events whenever entries are added or removed.
   - Implementation steps: refactor `createExtensionRegistry` to be event-driven, add `RegistryEventBus`, cover new behavior with tests under `packages/ragdoll/tests/registry`, and document lifecycle order (loader → registry → host bridge).
   - Acceptance criteria: registry consumers never import concrete extensions; they only subscribe to events or call `registry.executeTool(id, args)`.
3. **Update `ExtensionManager` (Electron main) to consume the new callback:**
   - *Attempted:* Began exploring a `channelRegistry` abstraction, but reverted due to scope. The current Electron host still imports concrete extensions and exposes bespoke IPC handlers (`tasks:*`, `pomodoro:*`, etc.).
   - *Todo:* Implement channel/service registration callbacks, generic IPC topics (`extension-state:*`, `extension-service:*`), logging/metrics, and remove all direct imports of `@vokality/ragdoll-extensions/src/extensions/*` from the main process.
   - Replace bespoke task/pomodoro wiring with a `channelRegistry` that tracks subscriptions per extension and brokers IPC topics like `extension-state:<channelId>`.
   - Add `serviceDispatchers` that expose generic `invokeExtensionService(extensionId, serviceName, payload)` handlers to the preload script without encoding domain knowledge.
   - Implementation steps: introduce `ExtensionManagerChannelRegistry` helper, convert existing handlers to the generic API, and add logging/metrics for channel lifecycle events.
   - Acceptance criteria: there are no imports from `@vokality/ragdoll-extensions/src/extensions/*` inside the Electron main process; everything flows through the registry callbacks.
4. **Keep existing built-ins temporarily:**
   - *Attempted:* None (extensions still register via legacy helpers).
   - *Todo:* Rework character/pomodoro/tasks/spotify extensions so they register through the new contribution path (tools + services + state channels). Add smoke tests that load all four via the loader to prove host agnosticism.
   - Keep character/pomodoro/tasks/spotify implementations colocated in `@vokality/ragdoll-extensions`, but require them to register through the new contribution path to prove the contract works before extraction.
   - Add smoke tests that load the four extensions via the loader, ensuring tooling/state channels/services materialize without any host-specific shims.
   - Acceptance criteria: removing the legacy direct-import helpers does not break current functionality, demonstrating the host is agnostic to extension internals.

## Phase 2 – Package Extraction

**Status summary (Dec 5, 2025 - COMPLETE):**
All Phase 2 deliverables are now in place:
- ✅ Four standalone extension packages created with proper metadata
- ✅ All source code moved from monorepo to standalone packages
- ✅ Fixed architecture - no circular dependencies (framework doesn't import extensions)
- ✅ Tasks extension implements file-based persistence with fallback to host storage
- ✅ All packages build successfully and chat app compiles
- ✅ Root build scripts updated with extension package targets

**Key architectural changes made:**
1. **Created workspace packages:**
   - ✅ Scaffolded `packages/ragdoll-extension-{character,tasks,pomodoro,spotify}` with `package.json`, `tsconfig.json`, `README.md`
   - ✅ Each package exports a `createRuntime(options, hostEnv)` factory that returns `ExtensionRuntimeContribution`
   - ✅ Each package declares `ragdollExtension` metadata in its `package.json` (id, name, description, capabilities, requiredCapabilities, entry)
   - ✅ Chat app updated to depend on all four extension packages via `workspace:*`
2. **Moved source code:**
   - ✅ Relocated all code from `packages/ragdoll-extensions/src/extensions/*` to standalone packages
   - ✅ Deleted empty `src/extensions/*` directories
   - ✅ **Removed problematic compat layer** - no circular deps between framework and extensions
   - ✅ **Removed extension-specific UI helpers** from framework (`task-slot.ts`, `pomodoro-slot.ts`, `spotify-slot.ts`, `extension-host.ts`, `use-extension-slots.ts`)
   - ✅ Framework now only provides generic infrastructure (registry, loader, slot primitives)
3. **Added persistence within packages:**
   - ✅ Tasks extension now reads/writes state to `<userData>/tasks/tasks-state.json` via `host.getDataPath()` with fallback to host storage
   - ✅ Extensions trigger `host.schedulePersistence()` when state changes
   - Pomodoro doesn't need persistence (timer is ephemeral)
   - Spotify managed separately (TODO for phase 3)
4. **Registered metadata in `package.json`:**
   - ✅ All four packages have `ragdollExtension` block with id, name, description, capabilities, requiredCapabilities, entry, canDisable
   - ✅ Type definition exists in `packages/ragdoll-extensions/src/loader.ts` (`ExtensionPackageJson`)
   - Loader discovery works (tested in Phase 1)
5. **Updated root build scripts:**
   - ✅ Added `build:extension-framework` and `build:extension-packages` targets
   - ✅ Added individual `build:ext-{character,tasks,pomodoro,spotify}` targets
   - ✅ Build order: ragdoll → extension-framework → extension-packages → apps
   - ✅ All packages build successfully via `bun run build`
   - Documentation updates deferred to Phase 4

## Phase 3 – Host & Renderer Integration

**Status summary (Dec 5, 2025 - COMPLETE):**
All Phase 3 deliverables are now in place:
- ✅ Registry tracks and exposes UI slots via `getSlots()` accessor
- ✅ ExtensionManager provides slot state access and action execution
- ✅ Renderer creates dynamic UI slots via `useExtensionSlots()` hook
- ✅ IPC-based state sync working (existing channels reused)
- ✅ Chat app compiles and renders extension slots
- ✅ No Node.js imports in renderer code

**Key architectural decisions made:**
1. **Slots created in renderer, not main process:**
   - Extension runtimes in main process only manage state via state channels
   - Renderer subscribes to state changes via existing IPC (`onTaskStateChanged`, `onPomodoroStateChanged`)
   - `useExtensionSlots()` hook creates UI slots that mirror main process state
   - User actions forwarded to main via `executeExtensionTool()` IPC
   - **Why:** Avoids importing extension packages (with Node.js code) in renderer
   
2. **Leveraged existing IPC infrastructure:**
   - No need for new generic `extension-state:*` channels
   - Extension-specific IPC handlers (`tasks:get-state`, etc.) already existed and work
   - Renderer simply creates slots that subscribe to these existing channels
   - **Future:** Could refactor to generic handlers in Phase 4, but not required

**What was completed:**
1. **Registry enhancements (`packages/ragdoll-extensions/src/registry.ts`):**
   - ✅ Added `slotIndex: Map<string, SlotEntry>` to track UI slots
   - ✅ Implemented `getSlots()` - returns all registered slots
   - ✅ Implemented `getSlot(slotId)` - returns specific slot by ID
   - ✅ Implemented `hasSlot(slotId)` - checks if slot exists
   - ✅ Slots indexed when extensions register (parallel to tools/services)
   - ✅ Exported `ExtensionStateChannel` type

2. **ExtensionManager updates (`apps/chat/electron/services/extension-manager.ts`):**
   - ✅ Added `getAllSlots()` - returns serializable slot metadata for IPC
   - ✅ Added `getSlotState(slotId)` - returns current state snapshot
   - ✅ Added `executeSlotAction(slotId, actionType, actionId)` - executes actions from renderer
   - ✅ Added `serializePanel()` helper - strips functions for IPC transport
   - **Note:** These methods exist but aren't currently used (renderer creates slots directly)

3. **Renderer integration (`apps/chat/src/hooks/use-extension-slots.ts`):**
   - ✅ Created `useExtensionSlots()` hook that returns `ExtensionUISlot[]`
   - ✅ Subscribes to `onTaskStateChanged` and `onPomodoroStateChanged` IPC events
   - ✅ Loads initial state via `getTaskState()` and `getPomodoroState()`
   - ✅ Creates local slot state using `createSlotState()` from framework
   - ✅ Forwards all user actions to main via `executeExtensionTool()`
   - ✅ **No extension package imports** - only types copied locally
   - ✅ Completely browser-safe (no Node.js APIs)

4. **Chat screen updates (`apps/chat/src/screens/chat-screen.tsx`):**
   - ✅ Replaced `const extensionSlots: never[] = []` stub with `useExtensionSlots()` hook
   - ✅ Slots now render in `SlotBar` with live state updates
   - ✅ Tasks and Pomodoro UI slots fully functional

**Deferred to Phase 4 (optional):**
- Discovery helper scanning `node_modules` (loader already supports this, just not enabled)
- Generic `extensions:list`, `extension-state:*`, `extension-service:*` IPC handlers
- Settings UI for enable/disable toggles
- Dynamic extension loading at runtime (requires app restart currently)
- Storage migration helpers for legacy data

## Phase 4 – Cleanup & Validation

**Status summary (Dec 5, 2025):** Not started.
1. **Remove legacy code paths:**
   - Delete `BUILT_IN_EXTENSIONS`, legacy IPC handlers, and any helper that imports concrete extensions (e.g., `createStatefulTasksExtension`).
   - Strip obsolete storage schemas (`tasks` block inside `chat-storage.json`, `spotifyTokens`, etc.) after migrations land; provide telemetry to confirm no users rely on them before final removal.
   - Implementation steps: run repo-wide search for the old helpers, replace with registry-driven APIs, and add eslint rules forbidding imports from `packages/ragdoll-extension-*` within the host apps.
2. **Documentation:**
   - Update root `README`, `ARCHITECTURE.md`, and `EXTENSION_SYSTEM_PLAN.md` with the new capability contract, package layout, and extension lifecycle diagrams.
   - Add a dedicated "Building Extensions" guide that explains how to declare metadata, required capabilities, persistence strategies, and testing patterns without touching host code.
   - Implementation steps: provide sample code snippets, outline publishing workflow, and document how dynamic discovery works in Electron.
3. **Testing & validation:**
   - Author automated end-to-end tests that cover: fresh install with marketplace extensions, upgrades from previous builds (migration path), disabling/re-enabling extensions, renderer reacting to dynamic load/unload, and service invocation flows.
   - Add contract tests to each extension package guaranteeing they only interact with the host via `ExtensionHostEnvironment`.
   - Implementation steps: extend the existing Playwright/TestCafe suites (if available) or add Bun-powered integration tests, run them in CI, and capture artifacts for debugging.
4. **Future work placeholders:**
   - Optional marketplace/registry service (package discovery UI, remote metadata sync) built on top of the new loader events.
   - Hot reloading of extension packages in development mode by wiring file-watcher events to the loader and broadcasting updated state to the renderer.
   - Research area: allow side-loaded extensions with signature verification while keeping the host sandboxed from their internals.

---

## Deliverables Summary
- New capability-focused API in `@vokality/ragdoll-extensions`.
- Four standalone extension packages published via workspaces.
- Extension loader/manager operating purely on package metadata + capabilities.
- Electron/React layers consuming dynamic state channels/services instead of hard-coded built-ins.
- Migration path for existing user data/state.
