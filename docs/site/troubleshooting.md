# Troubleshooting

## Lumen does not launch

Run `bun run build` from the repository root before `bun run dev:chat`. Missing workspace builds or `apps/chat/dist/electron/main.js` prevent startup.

## The window is blank

Check that the renderer terminal is serving `http://localhost:5173`. Restart the development process and Electron after dependency changes. Rebuild main-process changes with `bun run --filter lumen build:electron` before restarting.

A browser tab at the renderer URL is not a standalone Lumen client; use the Electron window.

## Secure credential storage is unavailable

Lumen requires a working OS credential store. In Cursor Cloud, use the [headless launcher](./getting-started.md#cursor-cloud) so the app has the correct keyring and graphics environment.

## The key is accepted but chat fails

Setup validates the API key, but does not prove access to Lumen's configured model. Read the request error in chat and check access to the model in `apps/chat/electron/main-process-config.ts`.

## A connection will not connect

Confirm that you entered a **Streamable HTTP MCP endpoint**, not the service's homepage or legacy SSE URL. Public endpoints must use HTTPS; HTTP is supported only for local servers. URLs with query parameters, embedded credentials, or fragments are rejected.

For OAuth, inspect the provider's client settings, redirect URI, and PKCE support. Some providers need a pre-registered public client ID. See [Authentication](./mcp/authentication.md).

## The agent cannot use a connected service

Check its switch in **Settings → Connections**. A connected service with **Agent access off** cannot execute agent calls. If sign-in has expired or the connection was interrupted, reconnect from Settings.

## An extension will not install

The extension library expects a GitHub release with a Ragdoll extension archive, not arbitrary repository source. Check the [distribution requirements](./extensions/distribution.md), package manifest, and missing host configuration reported by Lumen.

## A card closed but its activity continued

Card visibility is separate from extension activity. Ask Lumen to stop the timer, music, or other activity explicitly. Closing a card does not dispose its extension.
