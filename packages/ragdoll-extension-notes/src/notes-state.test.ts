import { expect, it } from "bun:test";
import {
  excerpt,
  loadNotesState,
  MAX_NOTE_BODY,
  MAX_NOTES,
  notesStateSchema,
  NOTE_EXCERPT_LENGTH,
  summarizeNotes,
  writeNoteArgsSchema,
} from "./notes-state.js";

const note = {
  id: "weekend",
  title: "Weekend plan",
  body: "Saturday: market\nSunday: rest",
  createdAt: 1,
  updatedAt: 2,
};

it("is the single boundary for tools and stored snapshots", () => {
  expect(
    writeNoteArgsSchema.parse({
      id: "  weekend  ",
      title: "  Weekend plan  ",
      body: "Saturday: market\nSunday: rest",
    }),
  ).toEqual({
    id: "weekend",
    title: "Weekend plan",
    body: "Saturday: market\nSunday: rest",
  });
  expect(
    notesStateSchema.parse({
      notes: [note],
    }),
  ).toEqual({ notes: [note] });
});

it("rejects oversized, duplicate, extra, and empty values", () => {
  for (const invalid of [
    { title: "Note", body: "" },
    { title: "   ", body: "Hello" },
    { title: "Note", body: "   " },
    { title: "Note", body: "x".repeat(MAX_NOTE_BODY + 1) },
    { title: "Note", body: "Hello", extra: true },
    { notes: [note] },
  ])
    expect(writeNoteArgsSchema.safeParse(invalid).success).toBe(false);

  expect(
    notesStateSchema.safeParse({
      notes: [note, note],
    }).success,
  ).toBe(false);
  expect(
    notesStateSchema.safeParse({
      notes: [note],
      selectedNoteId: "weekend",
    }).success,
  ).toBe(false);
  expect(
    notesStateSchema.safeParse({
      notes: Array.from({ length: MAX_NOTES + 1 }, (_, index) => ({
        ...note,
        id: `note-${index}`,
      })),
    }).success,
  ).toBe(false);
});

it("ignores a stored selectedNoteId when loading snapshots", () => {
  expect(
    loadNotesState({
      notes: [note],
      selectedNoteId: "missing",
    }),
  ).toEqual({ notes: [note] });
  expect(loadNotesState(undefined)).toEqual({ notes: [] });
});

it("summarizes newest first without leaking full bodies", () => {
  const older = { ...note, id: "older", updatedAt: 1 };
  const newer = { ...note, id: "newer", title: "Later", updatedAt: 9 };
  const longBody = "word ".repeat(80).trim();
  expect(
    summarizeNotes([older, { ...newer, body: longBody }], "newer"),
  ).toEqual({
    selectedNoteId: "newer",
    notes: [
      {
        id: "newer",
        title: "Later",
        excerpt: excerpt(longBody),
        updatedAt: 9,
      },
      {
        id: "older",
        title: "Weekend plan",
        excerpt: "Saturday: market Sunday: rest",
        updatedAt: 1,
      },
    ],
  });
  expect(excerpt(longBody).endsWith("…")).toBe(true);
  expect(excerpt(longBody).length).toBe(NOTE_EXCERPT_LENGTH);
  expect(excerpt(longBody).includes("\n")).toBe(false);
});
