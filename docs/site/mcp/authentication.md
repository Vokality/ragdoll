# Authentication and access

Lumen owns MCP login and credentials in its Electron main process. The model requests tool calls; it does not receive provider access or refresh tokens.

## Supported connections

| Requirement | Support |
| --- | --- |
| Transport | Streamable HTTP |
| Server URL | HTTPS; HTTP is allowed for localhost and loopback servers |
| Authentication | None, bearer access token, or OAuth authorization-code public client |
| OAuth registration | Pre-registered public client ID, supported dynamic registration, or an optional hosted client metadata document URL |
| Callback | Local loopback callback, with an optional fixed port |

Legacy SSE-only endpoints, stdio server processes, custom authentication headers, and confidential clients requiring a backend secret are not supported. Server URLs cannot contain embedded credentials, query strings, or fragments. HTTP redirects are rejected; enter the final MCP endpoint directly.

## OAuth setup

For providers supporting discovery and dynamic client registration, choose OAuth and connect. If the provider requires a registered application:

1. Register a **public desktop client** with the provider.
2. Save its public client ID in the connection's OAuth settings.
3. If registration requires a fixed callback port, configure that port.
4. Save the connection, then edit it to view the exact redirect URI. Register that URI with the provider.
5. Connect and approve the requested access in your system browser.

Lumen uses authorization code flow with PKCE S256, verifies callback state and issuer, exchanges the code, and encrypts the resulting credentials. Refresh is handled in the host. Lumen does not provide its own hosted client metadata document; only enter a metadata URL appropriate for your client registration.

For protocol details, see the [official MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

## Bearer tokens and public servers

For bearer authentication, supply the access token issued by the service. It is stored encrypted and is not returned in Settings snapshots. Replace it when it expires or is revoked.

Choose no authentication only when the endpoint supports unauthenticated access.

## Data and consent

Credentials stay in host-owned encrypted storage. Relevant remote tool results are passed to OpenAI as conversation context. Grant access only to accounts and capabilities you intend to use with Lumen.

Disconnecting removes local credentials; it does not revoke provider-side consent. Revoke that separately in the provider's account settings when needed. The agent cannot start login or grant itself connection access.

If a network failure leaves the result of an action unknown, verify the provider's state before requesting the action again. Lumen does not blindly retry remote mutations.
