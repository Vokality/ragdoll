# @vokality/ragdoll-extension-notes

Long-form notes the agent writes instead of putting them in the chat bubble.
After `notes_write`, open the card with `lumen_open_card` using `notes.main`.

Notes is a built-in, always-enabled Lumen extension. It requires host `storage`
and `logger` capabilities and contributes tools and one slot. It has no account
or configuration requirements.

## Tools

| Tool | Arguments | Result |
| --- | --- | --- |
| `notes_write` | `title`, `body`, optional `id` | Creates a note or replaces the note with that ID; returns its ID, title, excerpt, and update time. Selects the saved note in the slot. |
| `notes_list` | None | Returns the selected note ID and summaries ordered by most recent update. |
| `notes_get` | `noteId` | Returns the full note, including body and timestamps. |
| `notes_open` | `noteId` | Selects the note for display and returns the current summaries. |
| `notes_delete` | `noteId` | Deletes the note and returns the current summaries. |

Keep the ID from `notes_write` to update a note instead of creating another.
Read with `notes_get` before editing when the full content is needed. Tool
failures return `success: false`; writes that fail storage leave the current
state and selection unchanged.

## Limits and persistence

The collection holds at most 40 notes. IDs and titles are limited to 80
characters, bodies to 4,000, and list excerpts to 160. IDs and titles are trimmed;
body whitespace and line breaks are preserved. Empty or whitespace-only text,
duplicate stored IDs, and unknown properties are rejected at the boundary.

State is a Zod-validated list of notes. Mutations write storage first, then
update the slot. Which note is open is session view state and is not persisted.
The list shows titles and excerpts; opening a row shows the full plain-text body.

The card starts on the list after activation. **All notes** returns to that list;
**Delete** removes the current note with no undo operation. Its action ID includes
the note ID so a delayed click cannot delete a newly selected note. Closing the
card or clearing conversation history does not remove saved notes.

For local development, restart `bun run dev:chat` after changing extension code.
It builds the packages and Electron bundle before launching. See the public
[extension development guide](https://vokality.github.io/ragdoll/extensions/first-extension.html)
for host registration and distribution.
