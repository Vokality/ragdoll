# Authentication and access

Lumen's Electron main process handles MCP sign-in and stores the credentials. The model asks for tool calls; it never sees access or refresh tokens.

## Supported connections

| Requirement        | Support                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Transport          | Streamable HTTP                                                                                                                         |
| Server URL         | HTTPS; plain HTTP only for localhost and loopback addresses                                                                             |
| Authentication     | None, a bearer access token, or OAuth authorization code with a public client                                                           |
| OAuth registration | A pre-registered public client ID, dynamic registration if the provider supports it, or an optional hosted client metadata document URL |
| Callback           | Local loopback, optionally on a fixed port                                                                                              |

Lumen doesn't support SSE-only endpoints, stdio servers, custom authentication headers, or confidential clients that need a backend secret. Server URLs can't contain embedded credentials, a query string, or a fragment. Lumen doesn't follow HTTP redirects, so enter the final MCP endpoint.

## OAuth setup

If the provider supports discovery and dynamic client registration, choose OAuth and connect. If it requires you to register an application first:

1. Register a public desktop client with the provider.
2. Enter its public client ID in the connection's OAuth settings.
3. If the provider requires a fixed callback port, set it.
4. Save the connection, then edit it to see the exact redirect URI, and register that URI with the provider.
5. Connect, and approve the access request in your system browser.

Lumen uses the authorization code flow with PKCE (S256). It checks the callback's state and issuer, exchanges the code for tokens, encrypts them, and refreshes them when needed. Lumen doesn't host a client metadata document of its own; only enter a metadata URL if your client registration has one.

The [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) has the protocol details.

## Bearer tokens and public servers

For bearer authentication, paste the access token the service gave you. Lumen stores it encrypted and never shows it again in Settings. Replace it when it expires or is revoked.

Choose no authentication only if the endpoint accepts unauthenticated requests.

## Data and consent

Credentials stay in Lumen's encrypted storage. Results from remote tools become part of the conversation, which is sent to your model provider (OpenAI or xAI). Only connect accounts and grant access you're comfortable using through Lumen.

Disconnecting deletes the credentials on your computer but doesn't revoke the access you granted the provider. Revoke it in the provider's account settings if you need to. The agent can't sign in or turn on its own access to a connection.

If a network error leaves an action's outcome unknown, check the provider before asking for the action again. Lumen doesn't retry changes to remote services automatically.
