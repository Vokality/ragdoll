# Getting started

Build and launch Lumen, choose OpenAI or Grok and add your key, and try your first task.

## Requirements

- Git and **Bun 1.4.2**.
- A desktop environment that can run Electron and provide secure credential storage.
- An **OpenAI or xAI API key** with access to Lumen's configured model.
- Internet access for model requests, web search, and remote services.

OpenAI uses `gpt-5.6-sol` and Grok uses `grok-4.6`, both with low reasoning. Choose a provider during setup or in Settings → AI provider.

## Install and launch

From a terminal:

```bash
git clone https://github.com/Vokality/ragdoll.git
cd ragdoll
bun install --frozen-lockfile
bun run dev:chat
```

The development command builds shared packages and the Electron main process, starts the renderer at `http://localhost:5173`, and opens Lumen. Keep the terminal running.

Use the **Electron window**, not a browser tab at the renderer URL. Credentials, storage, and tool execution depend on Electron's main process.

## Add your API key

1. On the setup screen, choose OpenAI or Grok and follow its API-key link if you need a key.
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

Renderer edits reload during development. After changing main-process, preload, or shared-package code, stop the previous development command and restart it:

```bash
bun run dev:chat
```

Startup rebuilds shared packages and the Electron bundle before launching, including newly registered built-in extensions. Do not leave an older development command running alongside it.

## Cursor Cloud

After installation and building, use these commands in **separate terminals** instead of `dev:chat`:

```bash
bash .cursor/start-lumen-renderer.sh
```

```bash
bash .cursor/run-lumen-headless.sh
```

The headless launcher provides the cloud VM's keyring and software graphics configuration. A plain Electron launch in that environment can block on a keyring prompt or fail to render the character.
