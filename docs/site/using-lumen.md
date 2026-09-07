# How to use Lumen

Describe the outcome you want. Lumen can use tools and show the corresponding card while the chat remains available.

## Chat and controls

- **Enter:** send your message.
- **Shift+Enter:** add a newline.
- **Cmd/Ctrl+K:** focus the composer.
- **Stop:** cancel the current response or ongoing tool work where cancellation is supported.

User and assistant messages render Markdown, including emphasis, lists, quotes, code blocks, tables, and task lists. Referenced images are links rather than automatically loaded remote images. Search sources appear as pills below assistant messages.

Quick questions and actions default to no preamble. For work likely to take longer, the model may send a short acknowledgment, perform the work, and follow up with a final reply. The loading indicator remains active until the turn ends.

## Built-in features

| Feature | Try asking |
| --- | --- |
| Tasks | “Show my tasks and add ‘Book a haircut.’” |
| Focus timer | “Start a 25-minute focus timer.” |
| Flash cards | “Create five flash cards for basic Spanish greetings.” |
| Tic-tac-toe | “Let's play tic-tac-toe.” |
| Canvas | “Draw a simple house on the canvas.” |
| Web search | “Find a recent NASA update and summarize it.” |
| Character | “Smile,” “wink,” or “tilt your head.” |

Spotify tools are also included, but require setup under **Settings → Integrations**. Supply the Spotify Client ID and register the redirect URI shown in the configuration before signing in. Available playback actions depend on your Spotify account and devices.

## Cards and actions

Open a card from the toolbar or ask the agent to show it. The character becomes a small head in the card's upper-left corner. Card content scrolls separately from its controls and the conversation.

**Opening or closing a card changes presentation.** It does not start or stop the underlying activity. For example, “Close the timer card” hides it; ask to stop the timer if that is your intended action.

The agent can read and change extension state independently of a card. You can also use the card's buttons and controls directly.

## Settings

| Section | What it controls |
| --- | --- |
| API Key | Replace the stored OpenAI key |
| Connections | Add MCP services, sign in, and manage agent access |
| Theme / Character | Change the avatar's appearance |
| Features | Toggle extensions that can be disabled |
| Integrations | Configure extension-specific services such as Spotify |
| Extension library | Install, update, configure, or uninstall additional extensions |
| Data | Clear the conversation and its recorded tool history |

An MCP connection and an installed extension are different things. Use [Connections](./mcp/index.md) for MCP servers and the extension library for packages built with the [extension contract](./extensions/index.md).

## History and cancellation

Lumen saves messages and tool execution outcomes. The agent can use that history to remember what happened, but historical results are not a guarantee of current remote state.

Stopping a reply **does not undo an action that already completed**. If an interrupted tool has an unknown outcome, check the resulting state before asking to repeat a mutation. Clearing conversation history also does not delete your tasks, drawings, or remote service data.

## Where data goes

Conversation history, settings, and extension data are stored locally. OpenAI keys and connection credentials are encrypted. Relevant chat context and tool results are sent to OpenAI, and connected services receive their tool requests. Lumen requires online model access.
