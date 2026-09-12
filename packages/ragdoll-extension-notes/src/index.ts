/**
 * Notes — longer writing the agent stores on a card instead of in chat.
 *
 * Tools:
 * - notes_write: Create or replace a note
 * - notes_list: Read titles and excerpts
 * - notes_get: Read one full note
 * - notes_open: Show a note on the card
 * - notes_delete: Remove a note
 */

import {
  createExtension as defineExtension,
  z,
  type ExtensionHostEnvironment,
  type ExtensionRuntimeContribution,
  type ExtensionTool,
  type RagdollExtension,
  type ToolParameterSchema,
  type ToolResult,
} from "@vokality/ragdoll-extensions";
import {
  createSlotState,
  type SlotState,
} from "@vokality/ragdoll-extensions/slots";
import {
  emptyArgsSchema,
  emptyParameters,
  excerpt,
  loadNotesState,
  MAX_NOTES,
  noteIdArgsSchema,
  noteIdParameters,
  notesStateSchema,
  sortedNotes,
  summarizeNote,
  summarizeNotes,
  writeNoteArgsSchema,
  writeNoteParameters,
  type Note,
  type NotesState,
} from "./notes-state.js";

export {
  emptyNotesState,
  excerpt,
  loadNotesState,
  MAX_NOTE_BODY,
  MAX_NOTE_ID,
  MAX_NOTE_TITLE,
  MAX_NOTES,
  noteIdArgsSchema,
  notesStateSchema,
  noteSchema,
  sortedNotes,
  summarizeNote,
  summarizeNotes,
  writeNoteArgsSchema,
} from "./notes-state.js";
export type { Note, NotesState } from "./notes-state.js";

const DEFAULT_EXTENSION_ID = "notes";
const DEFAULT_STORAGE_KEY = "state";
const REQUIRED_HOST_CAPABILITIES = ["storage", "logger"] as const;

async function createRuntime(
  host: ExtensionHostEnvironment,
): Promise<ExtensionRuntimeContribution> {
  if (!host.storage || !host.logger) {
    throw new Error("Notes requires host storage and logger");
  }
  const storage = host.storage;
  const logger = host.logger;
  const saved = await storage.read(DEFAULT_EXTENSION_ID, DEFAULT_STORAGE_KEY);
  let state: NotesState = loadNotesState(saved);
  let selectedNoteId: string | null = null;
  let queue = Promise.resolve();
  let disposed = false;

  const slotState = createSlotState(project(), (error) => {
    logger.error("Notes slot listener failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  function snapshot(): {
    selectedNoteId: string | null;
    notes: ReturnType<typeof summarizeNote>[];
  } {
    return summarizeNotes(state.notes, selectedNoteId);
  }

  function project(): SlotState {
    const selected = selectedNoteId
      ? state.notes.find((note) => note.id === selectedNoteId)
      : undefined;
    const countLabel =
      state.notes.length === 1 ? "1 note" : `${state.notes.length} notes`;
    if (selected) {
      return {
        badge: state.notes.length || null,
        visible: true,
        panel: {
          type: "document",
          title: selected.title,
          body: selected.body,
          status: { label: countLabel },
          actions: [
            {
              id: "back",
              label: "All notes",
              variant: "secondary",
              onClick: async () => {
                await selectNote(null);
              },
            },
            {
              id: `delete:${selected.id}`,
              label: "Delete",
              variant: "danger",
              onClick: async () => {
                await removeNote(selected.id);
              },
            },
          ],
        },
      };
    }
    return {
      badge: state.notes.length || null,
      visible: true,
      panel: {
        type: "list",
        title: "Notes",
        emptyMessage:
          "Ask Lumen to save a longer note here instead of filling the chat.",
        items: sortedNotes(state.notes).map((note) => ({
          id: note.id,
          label: note.title,
          sublabel: excerpt(note.body),
          onClick: () => selectNote(note.id),
        })),
        ...(state.notes.length > 0 ? { status: { label: countLabel } } : {}),
      },
    };
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = queue.then(() => {
      if (disposed) throw new Error("Notes extension is unloaded");
      return operation();
    });
    queue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  async function persist(notes: Note[]): Promise<void> {
    const parsed = notesStateSchema.parse({ notes });
    const snapshotState = structuredClone(parsed);
    await storage.write(
      DEFAULT_EXTENSION_ID,
      DEFAULT_STORAGE_KEY,
      snapshotState,
    );
    state = snapshotState;
  }

  function selectNote(noteId: string | null): Promise<ToolResult> {
    return enqueue(async () => {
      if (noteId !== null && !state.notes.some((note) => note.id === noteId)) {
        return { success: false, error: `Note not found: ${noteId}` };
      }
      selectedNoteId = noteId;
      slotState.replaceState(project());
      return { success: true, data: snapshot() };
    });
  }

  function removeNote(noteId: string): Promise<ToolResult> {
    return enqueue(async () => {
      if (!state.notes.some((note) => note.id === noteId)) {
        return { success: false, error: `Note not found: ${noteId}` };
      }
      await persist(state.notes.filter((note) => note.id !== noteId));
      if (selectedNoteId === noteId) selectedNoteId = null;
      slotState.replaceState(project());
      return { success: true, data: snapshot() };
    });
  }

  function tool<T extends z.ZodType>(
    name: string,
    description: string,
    schema: T,
    parameters: ToolParameterSchema,
    run: (args: z.output<T>) => Promise<ToolResult>,
  ): ExtensionTool {
    return {
      definition: {
        type: "function",
        function: { name, description, parameters },
      },
      validate: (args) => {
        const result = schema.safeParse(args);
        return result.success
          ? { valid: true }
          : { valid: false, error: result.error.message, retryable: true };
      },
      handler: async (args) => {
        try {
          return await run(schema.parse(args));
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            retryable: error instanceof z.ZodError,
          };
        }
      },
    };
  }

  return {
    tools: [
      tool(
        "notes_write",
        "Save a longer plain-text note on the notes card instead of putting it in the chat bubble. Use this for plans, summaries, drafts, research, and any writing that would overflow a short message. Then open the card with lumen_open_card using slotId notes.main. Opening is a separate app tool. Pass id to update an existing note. The chat reply should name the note and stay brief; do not paste the body.",
        writeNoteArgsSchema,
        writeNoteParameters,
        ({ id, title, body }) =>
          enqueue(async () => {
            const now = Date.now();
            const existing = id
              ? state.notes.find((note) => note.id === id)
              : undefined;
            if (!existing && state.notes.length >= MAX_NOTES) {
              return {
                success: false,
                error: `Notes is full (${MAX_NOTES}). Delete a note before adding another.`,
              };
            }
            const note: Note = existing
              ? {
                  ...existing,
                  title,
                  body,
                  updatedAt: now,
                }
              : {
                  id: id ?? globalThis.crypto.randomUUID(),
                  title,
                  body,
                  createdAt: now,
                  updatedAt: now,
                };
            const notes = existing
              ? state.notes.map((candidate) =>
                  candidate.id === note.id ? note : candidate,
                )
              : [...state.notes, note];
            await persist(notes);
            selectedNoteId = note.id;
            slotState.replaceState(project());
            return { success: true, data: summarizeNote(note) };
          }),
      ),
      tool(
        "notes_list",
        "Read note ids, titles, and short excerpts. Use notes_get for a full body before editing.",
        emptyArgsSchema,
        emptyParameters,
        () =>
          enqueue(async () => ({
            success: true,
            data: snapshot(),
          })),
      ),
      tool(
        "notes_get",
        "Read one full note by id, including its body.",
        noteIdArgsSchema,
        noteIdParameters,
        ({ noteId }) =>
          enqueue(async () => {
            const note = state.notes.find(
              (candidate) => candidate.id === noteId,
            );
            if (!note) {
              return { success: false, error: `Note not found: ${noteId}` };
            }
            return { success: true, data: structuredClone(note) };
          }),
      ),
      tool(
        "notes_open",
        "Show one note's full body on the notes card. Then open the card with lumen_open_card using slotId notes.main if it is not already visible.",
        noteIdArgsSchema,
        noteIdParameters,
        ({ noteId }) => selectNote(noteId),
      ),
      tool(
        "notes_delete",
        "Delete a note. Does not change chat history.",
        noteIdArgsSchema,
        noteIdParameters,
        ({ noteId }) => removeNote(noteId),
      ),
    ],
    slots: [
      {
        id: `${DEFAULT_EXTENSION_ID}.main`,
        label: "Notes",
        icon: "bookmark",
        priority: 85,
        state: slotState,
      },
    ],
    dispose: () => {
      disposed = true;
    },
  };
}

export function createExtension(): RagdollExtension {
  return defineExtension({
    id: DEFAULT_EXTENSION_ID,
    name: "Notes",
    version: "0.1.0",
    description: "Save longer writing on a card so chat stays short",
    requiredCapabilities: [...REQUIRED_HOST_CAPABILITIES],
    optionalCapabilities: [],
    createRuntime,
  });
}
