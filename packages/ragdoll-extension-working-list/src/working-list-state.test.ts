import { expect, it } from "bun:test";
import {
  MAX_WORKING_LIST_ITEMS,
  setItemsArgsSchema,
  workingListStateSchema,
} from "./working-list-state.js";

const item = { id: "m1", label: "Q3 budget" };

it("is the single boundary for tools and stored snapshots", () => {
  expect(
    setItemsArgsSchema.parse({
      title: "  Reply next  ",
      items: [{ id: " m1 ", label: " Q3 budget ", sublabel: " Ava " }],
    }),
  ).toEqual({
    title: "Reply next",
    items: [{ id: "m1", label: "Q3 budget", sublabel: "Ava" }],
  });
  expect(
    workingListStateSchema.parse({
      title: "Reply next",
      items: [item],
      updatedAt: 1,
    }),
  ).toEqual({ title: "Reply next", items: [item], updatedAt: 1 });
});

it("rejects oversized, duplicate, extra, and empty values", () => {
  for (const invalid of [
    { title: "List", items: "nope" },
    { title: "   ", items: [] },
    {
      title: "List",
      items: Array.from({ length: MAX_WORKING_LIST_ITEMS + 1 }, (_, i) => ({
        id: `id-${i}`,
        label: "Item",
      })),
    },
    {
      title: "List",
      items: [
        { id: "same", label: "One" },
        { id: "same", label: "Two" },
      ],
    },
    { title: "List", items: [{ ...item, extra: true }] },
    { title: "List", items: [item], updatedAt: 1 },
  ])
    expect(setItemsArgsSchema.safeParse(invalid).success).toBe(false);

  expect(
    workingListStateSchema.safeParse({
      title: "Reply next",
      items: [item, item],
      updatedAt: 1,
    }).success,
  ).toBe(false);
  expect(
    workingListStateSchema.safeParse({
      title: "Reply next",
      items: [item],
      updatedAt: Infinity,
    }).success,
  ).toBe(false);
});
