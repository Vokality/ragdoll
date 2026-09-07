# Connect an MCP service

MCP (Model Context Protocol) lets Lumen discover and call tools offered by another service. A **connection** is a named account or endpoint managed by Lumen. It is independent of installed extensions and their cards.

## Add a connection

1. Open **Settings → Connections** and add a connection.
2. Give it a recognizable connection name, such as “Personal tasks.”
3. Enter the provider's **Streamable HTTP MCP endpoint**. Use its documented MCP URL, not its website or OAuth authorization URL.
4. Choose OAuth, bearer token, or no authentication, according to the provider.
5. Save, then connect. For OAuth, complete sign-in in your system browser.
6. Enable the connection's agent-access switch to make its tools available to the agent.

Saving, connecting, and allowing agent access are separate steps. A successful connection shows the discovered tool count. Failures appear in Settings rather than being presented as a connected account.

## Use a connected service

Ask for a task that the service supports, for example:

> What is on my personal to-do list?

The agent discovers available connections, inspects their tools, and calls the appropriate tool. Follow-up requests can make additional calls. Tool invocations and results participate in the conversation's history, so the agent can reason about what it actually did.

An MCP service contributes tools; it does **not** automatically create a visual card. Build a [Ragdoll extension](../extensions/index.md) when you need an interactive panel inside Lumen.

## Manage access

| Control | Effect |
| --- | --- |
| Disable agent access | Stops the session and agent access; keeps saved credentials. |
| Disconnect | Also removes local credentials and disables access. |
| Remove | Deletes the saved connection and its credentials. |

Enabled connections attempt to reconnect when Lumen starts. If the provider requires another sign-in, reconnect through Settings. Changing the endpoint or authentication invalidates the old credentials.

Connection access covers its tools; this version does not show a separate approval dialog for each call. Disabling access cannot undo an operation already performed by a provider.

See [authentication and supported transports](./authentication.md) for provider requirements.
