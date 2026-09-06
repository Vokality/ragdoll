# Agent instructions

Ragdoll is a Bun 1.3.14 workspace monorepo: a React character framework, a host-agnostic extension framework, first-party extension packages, the Electron chat app (`lumen`), and the Emote VS Code extension.

Cursor and Claude Code also load [CLAUDE.md](./CLAUDE.md). Keep the shared engineering rules in both files aligned. Architecture detail lives in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Commands

Run commands from the repository root unless a package-specific script is required.

```bash
bun install --frozen-lockfile
bun run build
bun run test
bun run typecheck
bun run lint
```

Focused work uses workspace filters, for example `bun run --filter @vokality/ragdoll-extensions test`. Do not add npm, pnpm, or Yarn lockfiles or scripts. Do not execute tools by hardcoding paths under `node_modules`; use `bun run` for package scripts and `bunx --bun` for package binaries.

CI on every push and pull request runs lint, test, typecheck, and `verify:packages` with Bun 1.3.14.

## Boundaries

Trigger: adding a dependency, public export, or import across packages.

Decision:

- `@vokality/ragdoll` owns the React character framework and must not import apps or extension packages.
- `@vokality/ragdoll-extensions` default entrypoint is React-free; `/loader` is host-adapter-driven; `/slots` is React-free; `/ui` is the only React UI entrypoint.
- First-party extension packages depend on the extension framework, never an app or another extension.
- Apps provide storage, IPC, notifications, config, OAuth, filesystem, and import adapters.

Do not add compatibility reexports or restore deleted entrypoints. Add a new public entrypoint only for a genuine runtime boundary.

Evidence: [ARCHITECTURE.md](./ARCHITECTURE.md), `scripts/verify-architecture.ts` (run by `bun run typecheck`), and the `exports` map on `@vokality/ragdoll-extensions`.

## Extension contract

Trigger: creating, loading, or changing an extension package.

Decision: export `createExtension(config?)` or an extension object the loader accepts. `package.json#ragdollExtension` is the canonical descriptor and must declare a stable id, in-package `entry`, provided capability types, required and optional host capabilities, and config or OAuth schemas when applicable. Registration requires an `ExtensionHostEnvironment`; shared extension packages must not import Electron or an app implementation.

Slots contain React-free observable state. Serialize with `serializeSlotState` before IPC; that helper strips callbacks and preserves action availability as `canClick`, `canToggle`, and `canSubmit`. Route action descriptors back to the owning callback. Electron IPC channel names are declared once in `IPC_CHANNELS`.

The maintained package shape is [`examples/extension-weather`](./examples/extension-weather). Host OAuth and config rules: [docs/extension-host-oauth.md](./docs/extension-host-oauth.md). Conversation-event rules: [docs/conversation-events.md](./docs/conversation-events.md).

## Engineering rules

- Keep TypeScript strict and avoid `any`.
- Preserve package dependency direction (`bun run verify:architecture`).
- Keep React imports out of core and loader entrypoints.
- Clean only the workspace's own generated output.
- Add regression coverage for lifecycle, loading, and IPC behavior changes.
- Keep changes scoped; remove stale paths, commands, and docs instead of retaining compatibility guidance.

## Cursor Cloud specific instructions

The Cloud Agent environment is defined by [.cursor/environment.json](./.cursor/environment.json):

- `install` runs `.cursor/install.sh`, which installs the pinned Bun toolchain when missing, then `bun install --frozen-lockfile` and `bun run build`.
- The `lumen-renderer` terminal runs `.cursor/start-lumen-renderer.sh` (the Vite dev server on `http://localhost:5173`).

To run the `lumen` Electron desktop app in the headless VM, use `bash .cursor/run-lumen-headless.sh`. A headless container has no OS keyring, so a plain `electron .` makes `safeStorage.isEncryptionAvailable()` return `false` and saving the OpenAI API key fails with "Secure credential storage is unavailable on this system". The launcher runs Electron inside a D-Bus session with an unlocked `gnome-keyring` and `--password-store=gnome-libsecret`. Keep this keyring workaround out of the cross-platform `dev:chat` script, where the OS keychain already backs `safeStorage`.

## Task routing

- Character framework: `packages/ragdoll`
- Extension contracts, loader, slots, and UI: `packages/ragdoll-extensions`
- First-party extensions: `packages/ragdoll-extension-*`
- Electron chat host: `apps/chat` (package name `lumen`)
- VS Code and MCP host: `apps/emote`
- Canonical new-extension example: `examples/extension-weather`
- Agent baseline setup, audit, or refresh: `.agents/skills/baseline-project` (`$baseline-project` in Codex)
