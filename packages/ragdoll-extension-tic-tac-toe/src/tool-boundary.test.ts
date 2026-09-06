import { expect, it } from "bun:test";
import { createTicTacToeTools } from "./index.js";

it("rejects malformed game arguments without reaching game handlers and preserves retryability", async () => {
  const calls: unknown[] = [];
  const tools = createTicTacToeTools({
    start: (args) => {
      calls.push(args);
      return { success: true };
    },
    place: (args) => {
      calls.push(args);
      return { success: true };
    },
    getBoard: () => ({ success: true }),
  });
  const start = tools.find(
    (tool) => tool.definition.function.name === "tic_tac_toe_start",
  );
  const place = tools.find(
    (tool) => tool.definition.function.name === "tic_tac_toe_place",
  );
  if (!start || !place) throw new Error("Missing game tools");
  for (const args of [{ userMark: 1 }, { firstPlayer: "invalid" }]) {
    expect((await start.handler(args, {})).success).toBe(false);
  }
  for (const args of [
    { row: NaN, col: 0 },
    { row: 0.5, col: 1 },
    { row: 3, col: 0 },
    { row: 0, col: "1" },
  ]) {
    const validation = place.validate?.(args);
    expect(validation?.valid).toBe(false);
    expect(await place.handler(args, {})).toEqual({
      success: false,
      error: validation?.error,
      retryable: true,
    });
  }
  expect(calls).toEqual([]);
  await start.handler({ userMark: "O", firstPlayer: "agent" }, {});
  await place.handler({ row: 1, col: 2 }, {});
  expect(calls).toEqual([
    { userMark: "O", firstPlayer: "agent" },
    { row: 1, col: 2 },
  ]);
});
