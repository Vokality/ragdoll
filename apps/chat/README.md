# Lumen

Lumen is the Electron desktop assistant in the [Ragdoll monorepo](../../README.md). It combines an animated character, streaming chat, interactive extension cards, web search with source pills, and MCP connections that the agent can use on the user's behalf. The workspace package name is `lumen`; its source directory remains `apps/chat`.

For an overview, example requests, and connection setup, start with the [root README](../../README.md).

## Run locally

From the repository root, with Bun 1.4.2 installed:

```bash
bun install --frozen-lockfile
bun run build
bun run dev:chat
```

`dev:chat` starts Vite on `http://localhost:5173` and launches Electron. Keep it running while using the desktop app. A browser tab alone does not provide the Electron APIs Lumen needs.

On first launch, enter your [OpenAI API key](https://platform.openai.com/api-keys). No repository `.env` file is needed. The current model is `gpt-5.6-sol` with low reasoning, configured in [`electron/main-process-config.ts`](electron/main-process-config.ts). The key must have access to that model; setup's key validation does not guarantee model access.

## Settings

- **API Key:** change the stored OpenAI key.
- **Connections:** add/edit MCP servers, connect or sign in, grant agent access, disconnect, and remove. Supports Streamable HTTP with OAuth, bearer tokens, or no authentication. See [Connections](../../docs/connections.md).
- **Theme / Character:** change the avatar's appearance.
- **Features:** enable or disable supported built-in extensions.
- **Integrations:** configure extension-specific services such as Spotify.
- **Extension library:** install Ragdoll extensions from GitHub and manage updates.
- **Data:** clear the conversation and its recorded execution history.

In chat, Enter sends, Shift+Enter inserts a newline, and Cmd/Ctrl+K focuses the composer. The stop button cancels the current response. A completed remote action is not undone by cancelling its follow-up reply.

## Working on the app

Renderer changes reload through Vite. Main-process and preload changes need rebuilding and an Electron restart:

```bash
bun run --filter lumen build:electron
```

For a complete Lumen build after shared packages are available:

```bash
bun run --filter lumen build
```

Rebuild shared libraries after changing their source with `bun run build:libraries`. Each package cleans only its own generated output.

Focused checks:

```bash
bun run --filter lumen test
bun run --filter lumen typecheck
bun run --filter lumen lint
bun run --filter lumen test:browser
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for repository-wide checks.

### Cursor Cloud

Use two terminals after installation and building:

```bash
bash .cursor/start-lumen-renderer.sh
```

```bash
bash .cursor/run-lumen-headless.sh
```

The second script launches Electron with the cloud VM's keyring and software-rendering setup. Do not replace it with a plain Electron launch in that environment. Details are in [AGENTS.md](../../AGENTS.md#cursor-cloud-specific-instructions).

### Startup troubleshooting

- **Missing built packages or Electron entrypoint:** run `bun run build` before launching.
- **Blank window or renderer unavailable:** confirm the Vite terminal is running on port 5173. After changing dependencies, restart the dev process and Electron. Main-process changes also need `build:electron`.
- **“Secure credential storage is unavailable”:** Lumen requires working OS credential storage. In Cursor Cloud, use the headless launcher above.
- **Key accepted but a model request fails:** check access to the model configured in `main-process-config.ts`, along with the request error shown in chat.

## Architecture

The renderer owns presentation. Electron's main process owns credentials, storage, the Responses agent loop, MCP clients, and extension lifecycle. Typed IPC contracts live in [`electron/electron-api.ts`](electron/electron-api.ts).

Lumen implements `ExtensionHostEnvironment`, injecting storage, IPC, notifications, config, OAuth, conversation events, timers, and a cooperative scheduler. Shared extensions do not import Electron or app implementations. Connections have their own identity and lifecycle, independent of extensions and card visibility.

User and assistant messages render Markdown. Search citations remain separate pills. Tool calls and outcomes are saved alongside conversation history; the model can use multiple tool rounds and emit separate progress and final messages. Progress is model-authored and optional for longer work.

- [Architecture and package boundaries](../../ARCHITECTURE.md)
- [Connections and MCP authentication](../../docs/connections.md)
- [Conversation events and execution history](../../docs/conversation-events.md)
- [Web search and citations](../../docs/internet-access.md)
- [Extension host OAuth](../../docs/extension-host-oauth.md)
