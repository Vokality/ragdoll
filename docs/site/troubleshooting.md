# Troubleshooting

## Lumen doesn't launch

From the repository root, run `bun install --frozen-lockfile` and then `bun run dev:chat`. Startup builds the shared packages and the Electron bundle before opening the window. If a build step fails, startup stops there instead of launching an old bundle, and the terminal shows the error to fix.

## The window is blank

Check that the renderer is being served at `http://localhost:5173`. If you changed the main process, the preload script, a shared package, or a dependency, stop `bun run dev:chat` and start it again. Renderer-only edits hot-reload without a restart.

Opening the renderer URL in a browser won't work as a substitute. Use the Electron window.

## Secure credential storage is unavailable

Lumen needs a working OS credential store. In Cursor Cloud, launch with the [headless launcher](./getting-started.md#cursor-cloud), which sets up a keyring and graphics for the VM.

## The key was accepted but chat fails

Setup checks that the API key is valid, not that it can use Lumen's model. Read the error shown in chat and check Settings → AI provider. The models Lumen uses are listed under [Requirements](./getting-started.md#requirements) and defined in `apps/chat/electron/services/model-provider.ts`.

## A connection won't connect

Make sure the URL is the service's Streamable HTTP MCP endpoint. A homepage or a legacy SSE URL won't work. Public endpoints must use HTTPS; plain HTTP only works for local servers. Lumen rejects URLs that contain a query string, embedded credentials, or a fragment.

For OAuth problems, check the provider's client settings, the registered redirect URI, and whether the provider supports PKCE. Some providers need you to register a public client ID first. See [Authentication](./mcp/authentication.md).

## The agent can't use a connected service

Open Settings → Connections and check that agent access is on for that connection. If the sign-in expired or the connection dropped, reconnect it there.

## An extension won't install

The extension library installs from a GitHub release that has a Ragdoll extension archive attached. It can't install from repository source. Check the [distribution requirements](./extensions/distribution.md), the package manifest, and any missing configuration Lumen reports.

## A built-in extension is missing

Built-in extensions such as Notes are listed under Settings → Extensions → Features. The Extension library only lists packages you installed yourself. Once Lumen has loaded an extension's card, it also appears in the toolbar's Cards folder.

In development, creating or building a new extension package doesn't add it to Lumen. It needs an app dependency and an entry in the built-in catalog, followed by a restart of `bun run dev:chat`, which rebuilds the package and the Electron bundle that contains the catalog. See [testing a first-party package in Lumen](./extensions/first-extension.md#test-a-first-party-package-in-lumen).

If the extension is in the catalog but fails to activate, read the error in the terminal and check the extension's required host capabilities and configuration. Lumen refuses to activate an extension whose saved data doesn't match its schema. Leave that saved data in place while you look into the error.

## A card closed but its activity kept going

Closing a card hides it; the extension keeps running. Ask Lumen to stop the timer, the music, or whatever else is running.
