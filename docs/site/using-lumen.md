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

| Feature      | Try asking                                             |
| ------------ | ------------------------------------------------------ |
| Tasks        | “Show my tasks and add ‘Book a haircut.’”              |
| Working list | “Show the five emails I should reply to.”              |
| Notes        | “Write a weekend itinerary as a note instead of in chat.” |
| Focus timer  | “Start a 30-minute focus timer.”                       |
| Flash cards  | “Create five flash cards for basic Spanish greetings.” |
| Tic-tac-toe  | “Let's play tic-tac-toe.”                              |
| Canvas       | “Draw a simple house on the canvas.”                   |
| Web search   | “Find a recent NASA update and summarize it.”          |
| Character    | “Smile,” “wink,” or “tilt your head.”                  |

Spotify tools are also included, but require setup under **Settings → Extensions → Integrations**. Supply the Spotify Client ID and register the redirect URI shown in the configuration before signing in. Available playback actions depend on your Spotify account and devices.

Character, Tasks, Working List, and Notes are always enabled. Pomodoro, Canvas, Flash Cards, Tic-Tac-Toe, and Spotify can be enabled or disabled under **Settings → Extensions → Features**. Enable an optional feature before asking the agent to use it. Focus sessions support 5, 15, 30, 60, or 120 minutes; breaks support 5, 10, 15, or 30 minutes.

## Notes and the working list

Use **Notes** for plans, summaries, drafts, and other writing you want to keep. Ask Lumen to save the text as a note, then open Notes from the toolbar. Select a title to read its full text; **All notes** returns to the list. The body preserves line breaks and displays plain text. Notes are ordered by their most recent update.

Lumen stores up to 40 notes, each with a title of up to 80 characters and a body of up to 4,000 characters. Ask to update an existing note to replace its title or body. **Delete** removes the saved note; there is no undo command. Notes survive app restarts, while the selected note resets to the list. Closing the card or clearing chat history does not delete notes.

Use **Working List** for a short snapshot of up to five items to handle next. Selecting a row asks the agent to continue with that item. Clearing the working list only clears that local snapshot. It does not delete emails or other items in a connected service.

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
| AI provider                    | Choose OpenAI or Grok and manage their API keys      |
| Chat data                      | Clear the conversation and its recorded tool history |

An MCP connection and an installed extension are different things. Use [Connections](./mcp/index.md) for MCP servers and the extension library for packages built with the [extension contract](./extensions/index.md).

## History and cancellation

Lumen saves messages and tool execution outcomes. The agent can use that history to remember what happened, but historical results are not a guarantee of current remote state.

Stopping a reply **does not undo an action that already completed**. If an interrupted tool has an unknown outcome, check the resulting state before asking to repeat a mutation. Clearing conversation history also does not delete your tasks, notes, drawings, or remote service data.

## Where data goes

Conversation history, settings, and extension data are stored locally. Model-provider keys and connection credentials are encrypted. Relevant chat context and tool results, including note text when a tool reads it, are sent to the selected provider (OpenAI or xAI). Connected services receive their tool requests. Lumen requires online model access.

## Your name and personal memory

Tell Lumen what to call you and share small preferences or routines you want it to remember. For example, “Call me Sam. I prefer short focus sessions.” Lumen saves your name and two kinds of memory locally. **Working memory** holds up to 50 facts useful across your current conversations. When it fills up, the least recently used fact moves to **long-term memory**, which has no fact-count limit. Birthdays and other durable details go directly into long-term memory. Lumen maintains a concise model-generated summary of long-term memory and retrieves exact facts when needed, instead of sending the entire archive with every message. In Settings → About you, browse both kinds of memory, read the long-term summary, edit facts, change their memory type, or forget them. Summary updates follow long-term changes during the next agent turn; if generation fails, the facts remain saved and the summary retries later. Onboarding is a conversation, not a form; declining to share a name does not block any feature.

Ask Lumen to forget a detail, or open **Settings → About you → Edit memory** to review, edit, or remove saved information. Clearing chat does not erase this profile. Saved personal context is included in future requests to the selected model provider; it is kept separately from the conversation on your computer. Lumen is instructed not to save secrets or sensitive details.

## Check-ins and character reactions

The character reacts while Lumen works, after successful or failed turns, and when a timer completes. An explicit expression requested during a turn takes precedence over its ordinary completion reaction.

Timer completion can prompt a short model-authored message. After you have completed a useful action, returning to Lumen after at least 15 minutes away can also prompt a check-in, at most once every four hours. The agent can choose silence when it has nothing useful to add. Check-ins do not automatically start another task or timer.

Turn off **Occasional check-ins** in About you to suppress timer and focus check-in conversations. The timer's desktop notifications remain separate. Stop can cancel an in-flight onboarding or check-in response as well as a normal chat response.
