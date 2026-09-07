# Lumen connections

Connections are host-owned MCP accounts, independent of extensions and cards. Settings → Connections provides add/edit, connect, cancel sign-in, agent access, disconnect, and remove controls. Creating or saving a connection does not claim it is connected and does not grant the agent access.

## User flow

1. Save a name, Streamable HTTP MCP endpoint, and authentication method.
2. Connect. OAuth opens the system browser; bearer authentication uses the supplied provider access token; public servers need no authentication.
3. Enable the connection's switch to let the agent discover and execute its tools for the user's requests. Connecting and enabling are separate decisions. Enabling an existing saved connection also attempts a noninteractive connection.

Disabling stops the session and agent access but keeps credentials. Disconnecting also clears local credentials and disables access. Removing deletes configuration and credentials. These operations do not revoke the provider's server-side consent; users can revoke that in the provider's account settings. Existing extension-specific integrations retain their current configuration flow.

## Ownership and data flow

- `electron-api.ts` owns validated public configuration and IPC contracts. Renderer state contains identity, endpoint, authentication method, enabled intent, actual status, tool count, and a sanitized error. Tokens are write-only at this boundary.
- `ConnectionService` owns saved records and live MCP clients. Enabled records reconnect in the background on startup; network failures do not block the app. Status becomes connected only after successful MCP initialization and all tool-list pages have loaded.
- `ConnectionCredentialRepository` stores encrypted credential envelopes through Electron `safeStorage`. Each connection has a stable UUID, so separate accounts on one service remain isolated. Editing the endpoint or authentication invalidates its existing credential envelope.
- `ConnectionOAuthProvider` adapts the official MCP SDK's discovery, registration, PKCE exchange, and refresh helpers to Lumen's system browser, loopback callback, and encrypted storage. The SDK handles resource metadata, OAuth/OIDC discovery, resource indicators, client registration, and OAuth request construction. Lumen verifies state and issuer before exchanging the code, requires PKCE S256, coalesces proactive refresh, and saves refresh-token rotation.
- `ConnectionToolService` provides `lumen_list_connections`, `lumen_list_connection_tools`, and `lumen_call_connection_tool`. Tool schemas come from MCP discovery and arguments are validated against those exact schemas before dispatch. Enablement is checked again at execution, including calls proposed before a user disables a connection.
- These are ordinary Responses function tools in Lumen's existing execution loop. Every invocation and result therefore uses the existing durable tool history, cancellation, multi-call continuation, and unknown-outcome handling. MCP requests execute in the Electron main process; provider credentials are not included in OpenAI requests, model prompts, chat history, or renderer snapshots.

The agent receives actual discovered capabilities and results. It cannot connect accounts, open consent flows, or grant itself access through these tools. Host errors never invent an assistant reply or successful action result. Transport failures do not trigger blind mutation retries.

## Supported providers

- Streamable HTTP over HTTPS, plus HTTP on localhost/loopback for local servers.
- No authentication, bearer access tokens, or OAuth authorization-code public clients.
- OAuth discovery with pre-registered public client IDs, optional hosted client metadata document URLs, and dynamic registration where supported. Lumen does not ship a hosted client metadata document. Providers requiring a confidential client/backend secret are not supported by this desktop flow.
- A provider can require a fixed callback port. Save the connection first, then edit its client settings to see the exact loopback redirect URI for provider registration.
- Legacy SSE-only endpoints, stdio processes, custom authentication headers, and provider-side token revocation are not implemented.
- Query-string credentials are not accepted. HTTP redirects are rejected, including redirects that could forward authorization credentials to another endpoint.

Connection enablement authorizes access to that connection's tools. There is no per-tool approval dialog in this version. The model is instructed to use connections only for the user's requested tasks and to treat provider content as untrusted data.

## Verification

Tests exercise the real MCP client SDK against an HTTP OAuth/MCP fixture, including discovery, authorization-code PKCE exchange, resource/scope parameters, callback state and issuer rejection, token refresh rotation, schema validation, pagination, and restoration without another browser login. Service tests cover encrypted/public boundaries, disconnect versus disable, startup failures, credential invalidation, cancellation before removal, and execution-time access checks. The Electron browser fixture verifies the Settings form, actual pending/connected states, explicit access toggle, compact layout, confirmation, and subscription cleanup.

References: [MCP TypeScript client](https://ts.sdk.modelcontextprotocol.io/client), [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization), [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling).
