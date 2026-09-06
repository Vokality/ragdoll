import { expect, it } from "bun:test";
import { createFlashCardTools } from "./index.js";

it("rejects malformed arguments before invoking domain handlers", () => {
  const calls: unknown[] = [];
  const tools = createFlashCardTools({
    addDeck: (args) => {
      calls.push(args);
      return { success: true };
    },
    addCard: (args) => {
      calls.push(args);
      return { success: true };
    },
    listDecks: (args) => {
      calls.push(args);
      return { success: true };
    },
    listDueCards: (args) => {
      calls.push(args);
      return { success: true };
    },
    startReview: (args) => {
      calls.push(args);
      return { success: true };
    },
    getReviewState: (args) => {
      calls.push(args);
      return { success: true };
    },
    endReview: (args) => {
      calls.push(args);
      return { success: true };
    },
  });
  for (const { name, args } of [
    { name: "addDeck", args: { name: false } },
    { name: "addCard", args: { deckId: "id", front: "front", back: [] } },
    { name: "listDueCards", args: { deckId: 123 } },
    { name: "startReview", args: { deckId: " " } },
  ]) {
    const tool = tools.find((entry) => entry.definition.function.name === name);
    if (!tool) throw new Error(`Missing tool: ${name}`);
    const validation = tool.validate?.(args);
    expect(validation?.valid).toBe(false);
    expect(() => tool.handler(args, {})).toThrow(validation?.error);
  }
  expect(calls).toEqual([]);
});
