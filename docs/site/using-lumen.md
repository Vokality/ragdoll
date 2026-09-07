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

| Feature     | Try asking                                             |
| ----------- | ------------------------------------------------------ |
| Tasks       | “Show my tasks and add ‘Book a haircut.’”              |
| Focus timer | “Start a 25-minute focus timer.”                       |
| Flash cards | “Create five flash cards for basic Spanish greetings.” |
| Tic-tac-toe | “Let's play tic-tac-toe.”                              |
| Canvas      | “Draw a simple house on the canvas.”                   |
| Web search  | “Find a recent NASA update and summarize it.”          |
| Character   | “Smile,” “wink,” or “tilt your head.”                  |

Spotify tools are also included, but require setup under **Settings → Extensions → Integrations**. Supply the Spotify Client ID and register the redirect URI shown in the configuration before signing in. Available playback actions depend on your Spotify account and devices.

## Cards and actions

Open a card from the toolbar or ask the agent to show it. The character becomes a small head in the card's upper-left corner. Card content scrolls separately from its controls and the conversation.

**Opening or closing a card changes presentation.** It does not start or stop the underlying activity. For example, “Close the timer card” hides it; ask to stop the timer if that is your intended action.

The agent can read and change extension state independently of a card. You can also use the card's buttons and controls directly.

## Settings

Settings opens a compact menu. Select a section to drill in; use Back or Escape to return to its parent. Memory edits, connection drafts, and the extension install URL remain while navigating within Settings. Closing Settings discards unsaved drafts.

| Section                        | What it controls                                     |
| ------------------------------ | ---------------------------------------------------- |
| About you                      | Review saved memory and check-ins                    |
| Appearance                     | Change the character and theme                       |
| Connections                    | Add MCP services, sign in, and manage agent access   |
| Extensions → Features          | Toggle extensions that can be disabled               |
| Extensions → Integrations      | Configure services such as Spotify                   |
| Extensions → Extension library | Install, update, configure, or uninstall extensions  |
| API key                        | Replace the stored OpenAI key                        |
| Chat data                      | Clear the conversation and its recorded tool history |

An MCP connection and an installed extension are different things. Use [Connections](./mcp/index.md) for MCP servers and the extension library for packages built with the [extension contract](./extensions/index.md).

## History and cancellation

Lumen saves messages and tool execution outcomes. The agent can use that history to remember what happened, but historical results are not a guarantee of current remote state.

Stopping a reply **does not undo an action that already completed**. If an interrupted tool has an unknown outcome, check the resulting state before asking to repeat a mutation. Clearing conversation history also does not delete your tasks, drawings, or remote service data.

## Where data goes

Conversation history, settings, and extension data are stored locally. OpenAI keys and connection credentials are encrypted. Relevant chat context and tool results are sent to OpenAI, and connected services receive their tool requests. Lumen requires online model access.

## Your name and personal memory

Tell Lumen what to call you and share small preferences or routines you want it to remember. For example, “Call me Sam. I prefer short focus sessions.” Lumen saves your name and two kinds of memory locally. **Working memory** holds up to 50 facts useful across your current conversations. When it fills up, the least recently used fact moves to **long-term memory**, which has no fact-count limit. Birthdays and other durable details go directly into long-term memory. Lumen maintains a concise model-generated summary of long-term memory and retrieves exact facts when needed, instead of sending the entire archive with every message. In Settings → About you, browse both kinds of memory, read the long-term summary, edit facts, change their memory type, or forget them. Summary updates follow long-term changes during the next agent turn; if generation fails, the facts remain saved and the summary retries later. Onboarding is a conversation, not a form; declining to share a name does not block any feature.

Ask Lumen to forget a detail, or open **Settings → About you → Edit memory** to review, edit, or remove saved information. Clearing chat does not erase this profile. Saved personal context is included in future OpenAI requests; it is kept separately from the conversation on your computer. Lumen is instructed not to save secrets or sensitive details.

## Check-ins and character reactions

The character reacts while Lumen works, after successful or failed turns, and when a timer completes. An explicit expression requested during a turn takes precedence over its ordinary completion reaction.

Timer completion can prompt a short model-authored message. After you have completed a useful action, returning to Lumen after at least 15 minutes away can also prompt a check-in, at most once every four hours. The agent can choose silence when it has nothing useful to add. Check-ins do not automatically start another task or timer.

Turn off **Occasional check-ins** in About you to suppress timer and focus check-in conversations. The timer's desktop notifications remain separate. Stop can cancel an in-flight onboarding or check-in response as well as a normal chat response.
