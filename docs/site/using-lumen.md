# How to use Lumen

Ask for what you want done. Lumen calls the tools it needs and opens the matching card, and the chat stays available the whole time.

## Chat and controls

| Key or control | Action                                                                         |
| -------------- | ------------------------------------------------------------------------------ |
| Enter          | Send the message                                                               |
| Shift+Enter    | New line                                                                       |
| Cmd/Ctrl+K     | Focus the composer                                                             |
| Stop           | Cancel the current reply, and any running tool work that supports cancellation |

Messages render Markdown: emphasis, lists, quotes, code blocks, tables, and task lists. Images in a message appear as links; Lumen doesn't load remote images on its own. Web search sources show up as pills under the reply.

Short questions get a direct answer. For longer work, the model may send a quick acknowledgment first, do the work, and then post the result. The loading indicator stays on until the turn is over.

## Built-in features

| Feature      | Try asking                                                |
| ------------ | --------------------------------------------------------- |
| Tasks        | "Show my tasks and add 'Book a haircut.'"                 |
| Working list | "Show the five emails I should reply to."                 |
| Notes        | "Write a weekend itinerary as a note instead of in chat." |
| Focus timer  | "Start a 30-minute focus timer."                          |
| Flash cards  | "Create five flash cards for basic Spanish greetings."    |
| Tic-tac-toe  | "Let's play tic-tac-toe."                                 |
| Canvas       | "Draw a simple house on the canvas."                      |
| Web search   | "Find a recent NASA update and summarize it."             |
| Character    | "Smile," "wink," or "tilt your head."                     |

Spotify is also built in, but you have to set it up first under Settings → Extensions → Integrations: enter your Spotify Client ID and register the redirect URI shown there, then sign in. Which playback controls work depends on your Spotify account and devices.

Character, Tasks, Working List, and Notes are always on. Pomodoro, Canvas, Flash Cards, Tic-Tac-Toe, and Spotify can be switched on or off under Settings → Extensions → Features, and the agent can only use the ones that are on. Focus sessions last 5, 15, 30, 60, or 120 minutes; breaks last 5, 10, 15, or 30.

## Notes and the working list

Notes is for writing you want to keep: plans, summaries, drafts. Ask Lumen to save something as a note, then open Notes from the Cards folder in the toolbar. Pick a title to read the note, and use All notes to go back to the list. Note bodies are plain text with line breaks kept, and the list puts the most recently updated note first.

You can keep up to 40 notes. Titles can be 80 characters and bodies 4,000. Ask Lumen to update a note to change its title or body. Delete removes a note permanently. Notes survive restarts, closing the card, and clearing chat history; only the currently open note resets to the list on restart.

The working list is a short snapshot of up to five things to handle next. Clicking a row asks the agent to pick up that item. Clearing the list only clears the snapshot here. The emails or other items it pointed to stay where they are.

## Cards and actions

Open a card from the Cards folder in the toolbar, or ask the agent to show it. While a card is open, the character shrinks to a small head in the card's top-left corner. The card's content scrolls on its own, separate from its controls and from the chat.

Opening and closing a card only changes what's on screen. "Close the timer card" hides the timer and leaves it running; to end it, ask Lumen to stop the timer.

The agent can read and change an extension's state whether or not its card is open, and you can use the card's buttons yourself at any time.

## Settings

Settings opens as a compact menu. Pick a section to open it; Back or Escape goes up one level. Unsaved memory edits, connection drafts, and the extension install URL are kept while you move around inside Settings and discarded when you close it.

| Section                        | What it controls                                           |
| ------------------------------ | ---------------------------------------------------------- |
| About you                      | Saved memory and check-ins                                 |
| Appearance                     | Character and theme                                        |
| Connections                    | MCP services, sign-in, and agent access                    |
| Extensions → Features          | Extensions that can be turned off                          |
| Extensions → Integrations      | Services that need setup, such as Spotify                  |
| Extensions → Extension library | Installing, updating, configuring, and removing extensions |
| AI provider                    | OpenAI or Grok, and their API keys                         |
| Chat data                      | Clearing the conversation and its tool history             |

Connections and extensions are separate. [Connections](./mcp/index.md) are MCP servers. The extension library installs packages written against the [extension contract](./extensions/index.md).

## History and cancellation

Lumen saves every message and the outcome of every tool call. The agent uses that history to recall what it did, but the history is a record of the past. A remote service may have changed since.

Stop cancels what hasn't happened yet. Anything that already finished stays done. If a tool was interrupted and its outcome is unknown, check the result yourself before asking Lumen to run the change again. Clearing chat history leaves your tasks, notes, drawings, and remote data in place.

## Where data goes

Conversation history, settings, and extension data stay on your computer. Provider keys and connection credentials are stored encrypted. The parts of the conversation and the tool results the agent needs, including note text when a tool reads it, go to your model provider (OpenAI or xAI). Connected services receive the tool calls addressed to them. Lumen needs a network connection to reach the model.

## Your name and personal memory

Tell Lumen what to call you, and mention preferences or routines you want it to remember, for example "Call me Sam. I prefer short focus sessions." It keeps your name and two kinds of memory on your computer.

Working memory holds up to 50 facts that are useful across your current conversations. When it's full, the least recently used fact moves to long-term memory, which has no size limit. Durable details such as birthdays go straight to long-term memory. Rather than sending the whole archive with every message, Lumen keeps a short model-written summary of long-term memory and looks up individual facts when it needs them.

Settings → About you lists both kinds of memory and the long-term summary. You can edit a fact, move it between working and long-term memory, or delete it. The summary is regenerated during the next agent turn after a long-term change; if that fails, the facts are still saved and the summary is retried later.

To remove something, ask Lumen to forget it or open Settings → About you → Edit memory. Clearing chat doesn't touch this profile. Saved memory is sent with future requests to your model provider, but it's stored separately from the conversation. Lumen is instructed not to save secrets or sensitive details. Skipping the name question during onboarding doesn't lock you out of anything.

## Check-ins and character reactions

The character reacts while Lumen works, when a turn succeeds or fails, and when a timer ends. If you asked for a specific expression during a turn, that expression wins over the usual end-of-turn reaction.

When a timer ends, Lumen may post a short message about it. Once you've done something useful in the app, coming back after 15 minutes or more away can also trigger a check-in, at most once every four hours. The agent stays quiet if it has nothing worth saying, and a check-in never starts a task or timer by itself.

To turn off timer and focus check-ins, switch off Occasional check-ins in About you. Timer desktop notifications aren't affected. Stop cancels an onboarding message or check-in the same way it cancels a normal reply.
