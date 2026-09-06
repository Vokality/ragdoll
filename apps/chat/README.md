# Lumen (`apps/chat`)

Lumen is the Electron chat host and the first-party `ExtensionHostEnvironment` implementation. It injects storage, IPC, notifications, config, OAuth, conversation events, timers, and a cooperative scheduler into Ragdoll extensions.

Emote (`apps/emote`) is a separate VS Code MCP character host. It does not load Ragdoll extensions.

## Commands

From the repository root:

```bash
bun run dev:chat
bun run --filter lumen test
bun run --filter lumen typecheck
```

In Cursor Cloud, launch the app with `.cursor/run-lumen-headless.sh` instead of `dev:chat`. See [AGENTS.md](../../AGENTS.md#cursor-cloud-specific-instructions).

The workspace package name is `lumen`.
