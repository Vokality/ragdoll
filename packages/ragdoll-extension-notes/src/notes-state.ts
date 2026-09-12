import {
  z,
  type ToolParameterSchema,
} from "@vokality/ragdoll-extensions";

export const MAX_NOTES = 40;
export const MAX_NOTE_TITLE = 80;
export const MAX_NOTE_BODY = 4000;
export const MAX_NOTE_ID = 80;
export const NOTE_EXCERPT_LENGTH = 160;

const noteIdSchema = z.string().trim().min(1).max(MAX_NOTE_ID);
const titleSchema = z.string().trim().min(1).max(MAX_NOTE_TITLE);
const bodySchema = z
  .string()
  .min(1)
  .max(MAX_NOTE_BODY)
  .refine((value) => value.trim().length > 0, {
    message: "body cannot be empty",
  });

export const noteSchema = z.strictObject({
  id: noteIdSchema,
  title: titleSchema,
  body: bodySchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const notesArraySchema = z
  .array(noteSchema)
  .max(MAX_NOTES)
  .superRefine((notes, context) => {
    const ids = new Set<string>();
    for (const [index, note] of notes.entries()) {
      if (ids.has(note.id)) {
        context.addIssue({
          code: "custom",
          message: "Note IDs must be unique",
          path: [index, "id"],
        });
        return;
      }
      ids.add(note.id);
    }
  });

export const notesStateSchema = z.strictObject({
  notes: notesArraySchema,
});

const storedNotesStateSchema = z
  .strictObject({
    notes: notesArraySchema,
    selectedNoteId: z.unknown().optional(),
  })
  .transform(({ notes }): NotesState => ({ notes }));

export const writeNoteArgsSchema = z.strictObject({
  id: noteIdSchema.optional(),
  title: titleSchema,
  body: bodySchema,
});

export const noteIdArgsSchema = z.strictObject({
  noteId: noteIdSchema,
});

export const emptyArgsSchema = z.strictObject({});

export type Note = z.infer<typeof noteSchema>;
export type NotesState = z.infer<typeof notesStateSchema>;

export function emptyNotesState(): NotesState {
  return { notes: [] };
}

export function loadNotesState(saved: unknown): NotesState {
  return saved === undefined
    ? emptyNotesState()
    : storedNotesStateSchema.parse(saved);
}

export function excerpt(body: string): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (compact.length <= NOTE_EXCERPT_LENGTH) return compact;
  return `${compact.slice(0, NOTE_EXCERPT_LENGTH - 1).trimEnd()}…`;
}

export function sortedNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function summarizeNote(note: Note): {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: number;
} {
  return {
    id: note.id,
    title: note.title,
    excerpt: excerpt(note.body),
    updatedAt: note.updatedAt,
  };
}

export function summarizeNotes(
  notes: readonly Note[],
  selectedNoteId: string | null,
): {
  selectedNoteId: string | null;
  notes: ReturnType<typeof summarizeNote>[];
} {
  return {
    selectedNoteId,
    notes: sortedNotes(notes).map(summarizeNote),
  };
}

export const emptyParameters: ToolParameterSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const writeNoteParameters: ToolParameterSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "body"],
  properties: {
    id: {
      type: "string",
      maxLength: MAX_NOTE_ID,
      description:
        "Stable id to create or replace. Omit to create a new note with a generated id.",
    },
    title: {
      type: "string",
      maxLength: MAX_NOTE_TITLE,
      description: "Short title shown in the notes list and card header",
    },
    body: {
      type: "string",
      maxLength: MAX_NOTE_BODY,
      description:
        "Full plain-text note. Use line breaks for structure. Do not put this body in the chat reply.",
    },
  },
};

export const noteIdParameters: ToolParameterSchema = {
  type: "object",
  additionalProperties: false,
  required: ["noteId"],
  properties: {
    noteId: {
      type: "string",
      maxLength: MAX_NOTE_ID,
      description: "The note id from notes_write or notes_list",
    },
  },
};
