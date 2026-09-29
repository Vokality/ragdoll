# Getting started

This page takes you from a fresh clone to a first request in Lumen.

## Requirements

- Git and Bun 1.4.2.
- A desktop environment that can run Electron and has an OS credential store.
- An OpenAI or xAI API key with access to the model Lumen uses.
- Internet access. Model requests, web search, and remote services all go over the network.

Lumen uses `gpt-5.6-sol` for OpenAI and `grok-4.6` for Grok, both at low reasoning effort. You pick the provider during setup and can change it later in Settings → AI provider.

## Install and launch

```bash
git clone https://github.com/Vokality/ragdoll.git
cd ragdoll
bun install --frozen-lockfile
bun run dev:chat
```

`dev:chat` builds the shared packages and the Electron main process, serves the renderer at `http://localhost:5173`, and opens the Lumen window. Leave the terminal running.

Work in the Electron window. The renderer URL also loads in a browser, but credentials, storage, and tools live in Electron's main process, so the browser tab can't do anything useful.

## Add your API key

1. On the setup screen, pick OpenAI or Grok. Each option links to the provider's key page.
2. Paste your key and submit it.
3. When setup finishes, the chat composer appears.

Lumen checks the key and stores it encrypted with Electron's OS-backed credential storage, so you don't need a `.env` file. The check only confirms the key is valid. If your first message fails, read the error in chat and confirm the key's account can use the model listed above.

## Your first conversation

Lumen introduces itself and asks what to call you. It saves the name to a local profile. You can skip the question.

The suggestion chips start a plan for the day, a focus session, or a conversation to think something through. None of them runs until you pick it. To try a tool, send:

> Show my to-do list and add "Plan the weekend."

The agent opens the tasks card and adds the item, using one tool for each step. From there you can click around in the card or keep typing. Say "Close the card" to go back to the full-size character.

Next, read about [the other built-in features](./using-lumen.md) or [connect an MCP service](./mcp/index.md).

## Relaunching and development

Run `bun run dev:chat` from the repository root each time. Conversations, settings, and extension data are stored locally and carry over between launches.

Renderer changes hot-reload. Changes to the main process, the preload script, or a shared package need a restart: stop the running `dev:chat` and start it again. Startup rebuilds the shared packages and the Electron bundle, including any newly registered built-in extension. Only run one `dev:chat` at a time.

## Cursor Cloud

In Cursor Cloud, skip `dev:chat` and run these two scripts in separate terminals after installing and building:

```bash
bash .cursor/start-lumen-renderer.sh
```

```bash
bash .cursor/run-lumen-headless.sh
```

The headless launcher sets up a keyring and software rendering for the cloud VM. A plain Electron launch there either hangs on a keyring password prompt or fails to draw the character.
