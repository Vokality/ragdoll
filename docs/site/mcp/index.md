# Connect an MCP service

MCP (Model Context Protocol) lets Lumen discover and call tools that another service offers. In Lumen, a connection is a named endpoint or account that you add in Settings. Connections are separate from installed extensions and have no cards.

## Add a connection

1. Open Settings → Connections and add a connection.
2. Name it something you'll recognize, such as "Personal tasks."
3. Enter the provider's Streamable HTTP MCP endpoint. Use the MCP URL from the provider's documentation, not its website or its OAuth authorization URL.
4. Choose OAuth, a bearer token, or no authentication, depending on what the provider supports.
5. Save, then connect. For OAuth, finish signing in in your system browser.
6. Turn on "Allow agent to use this connection" so the agent can call its tools.

Saving, connecting, and granting agent access are three separate steps. A working connection shows how many tools it found. If connecting fails, Settings shows the error and the connection doesn't appear as connected.

## Use a connected service

Ask for something the service can do:

> What is on my personal to-do list?

The agent looks up the available connections, reads their tool lists, and calls the right tool, making more calls for follow-up requests. Every call and result is saved in the conversation history, so the agent can check what it already ran.

MCP services only provide tools; they don't get a card in Lumen. If you want an interactive panel, write a [Ragdoll extension](../extensions/index.md).

## Manage access

| Control                 | Effect                                                             |
| ----------------------- | ------------------------------------------------------------------ |
| Agent access switch off | Ends the session and blocks the agent. Saved credentials are kept. |
| Disconnect              | Blocks the agent and deletes the local credentials.                |
| Remove                  | Deletes the connection and its credentials.                        |

Connections with agent access on reconnect when Lumen starts. If the provider asks you to sign in again, reconnect from Settings. Changing a connection's endpoint or authentication discards its old credentials.

Agent access applies to all of a connection's tools. Lumen doesn't ask for approval before each call, and turning access off can't undo something the provider already did.

[Authentication and access](./authentication.md) covers what providers need to support.
