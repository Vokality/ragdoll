# Troubleshooting

## Lumen does not launch

Run `bun install --frozen-lockfile`, then `bun run dev:chat` from the repository root. Development startup builds the shared packages and Electron bundle before opening the app. If a build fails, fix the error shown in the terminal; startup stops before launching an older bundle.

## The window is blank

Check that the renderer terminal is serving `http://localhost:5173`. Stop the previous development command and restart `bun run dev:chat` after main-process, preload, shared-package, or dependency changes. Renderer-only edits reload through Bun’s hot reload.

A browser tab at the renderer URL is not a standalone Lumen client; use the Electron window.

## Secure credential storage is unavailable

Lumen requires a working OS credential store. In Cursor Cloud, use the [headless launcher](./getting-started.md#cursor-cloud) so the app has the correct keyring and graphics environment.

## The key is accepted but chat fails

Setup validates the selected provider's API key, but does not prove access to its configured model. Read the request error in chat and check **Settings → AI provider**. Current defaults are listed in [Getting started](./getting-started.md#requirements); the source catalog is `apps/chat/electron/services/model-provider.ts`.

## A connection will not connect

Confirm that you entered a **Streamable HTTP MCP endpoint**, not the service's homepage or legacy SSE URL. Public endpoints must use HTTPS; HTTP is supported only for local servers. URLs with query parameters, embedded credentials, or fragments are rejected.

For OAuth, inspect the provider's client settings, redirect URI, and PKCE support. Some providers need a pre-registered public client ID. See [Authentication](./mcp/authentication.md).

## The agent cannot use a connected service

Check its switch in **Settings → Connections**. A connected service with **Agent access off** cannot execute agent calls. If sign-in has expired or the connection was interrupted, reconnect from Settings.

## An extension will not install

The extension library expects a GitHub release with a Ragdoll extension archive, not arbitrary repository source. Check the [distribution requirements](./extensions/distribution.md), package manifest, and missing host configuration reported by Lumen.

## A built-in extension is missing

Built-ins such as Notes appear in **Settings → Extensions → Features**. The **Extension library** manages separately installed packages. Notes also appears in the Cards folder in the toolbar when the host has loaded its slot.

During development, creating or building an extension package does not register it in Lumen. Check its app dependency and built-in catalog entry, then stop the previous development command and run `bun run dev:chat`. This rebuilds both the package and the Electron bundle containing the catalog. See [testing a first-party package in Lumen](./extensions/first-extension.md#test-a-first-party-package-in-lumen).

If the entry is present but activation fails, inspect the terminal error and the extension's required host capabilities and configuration. Invalid saved extension data is rejected during activation; keep the saved data while investigating the schema error.

## A card closed but its activity continued

Card visibility is separate from extension activity. Ask Lumen to stop the timer, music, or other activity explicitly. Closing a card does not dispose its extension.
