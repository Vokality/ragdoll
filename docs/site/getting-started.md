# Getting started

Build and launch Lumen, add your OpenAI key, and try your first task.

## Requirements

- Git and **Bun 1.4.2**.
- A desktop environment that can run Electron and provide secure credential storage.
- An **OpenAI API key** with access to Lumen's configured model.
- Internet access for model requests, web search, and remote services.

The current default is `gpt-5.6-sol` with low reasoning, using the Responses API. It is configured in [`main-process-config.ts`](https://github.com/Vokality/ragdoll/blob/main/apps/chat/electron/main-process-config.ts), rather than a model picker in Settings.

## Install and launch

From a terminal:

```bash
git clone https://github.com/Vokality/ragdoll.git
cd ragdoll
bun install --frozen-lockfile
bun run build
bun run dev:chat
```

The initial build prepares the shared frameworks, extensions, and Electron app. The development command starts the renderer at `http://localhost:5173` and opens Lumen. Keep the terminal running.

Use the **Electron window**, not a browser tab at the renderer URL. Credentials, storage, and tool execution depend on Electron's main process.

## Add your API key

1. On the setup screen, follow the link to [OpenAI API keys](https://platform.openai.com/api-keys) if you need a key.
2. Paste your key into Lumen and submit it.
3. Once setup completes, the chat composer appears.

Lumen validates the key and stores it encrypted through Electron's OS-backed credential storage. You do not need a repository `.env` file. Key validation does not establish access to every model; if the first request fails, check the error in chat and your access to the configured model.

## Your first conversation

Lumen introduces itself and asks what to call you. Reply naturally; it remembers your preferred name in a local profile. You can skip that question and start using the app immediately.

Lumen then helps you do something useful in your day. The suggestion chips offer planning, a focus session, or thinking something through. Nothing runs until you ask for it. For example, send:

> Show my to-do list and add “Plan the weekend.”

The agent can open the tasks card and add the task through separate tools. You can then interact with the card or keep chatting. Ask “Close the card” to return to the full character view.

Next, try [other built-in features](./using-lumen.md) or [connect an MCP service](./mcp/index.md).

## Running again and making changes

Run `bun run dev:chat` from the repository root on subsequent launches. Conversations, settings, and saved extension data are retained locally.

Renderer edits reload during development. After changing main-process or preload code, quit Lumen, rebuild, and restart:

```bash
bun run --filter lumen build:electron
bun run dev:chat
```

Stop the previous development command before starting another one. Rebuild shared package changes with `bun run build:libraries`.

## Cursor Cloud

After installation and building, use these commands in **separate terminals** instead of `dev:chat`:

```bash
bash .cursor/start-lumen-renderer.sh
```

```bash
bash .cursor/run-lumen-headless.sh
```

The headless launcher provides the cloud VM's keyring and software graphics configuration. A plain Electron launch in that environment can block on a keyring prompt or fail to render the character.
