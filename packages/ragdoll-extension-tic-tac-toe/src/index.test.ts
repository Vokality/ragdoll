import { describe, expect, it } from "bun:test";
import type {
  ConversationEventInput,
  ExtensionHostEnvironment,
} from "@vokality/ragdoll-extensions";
import {
  createExtensionPackageDescriptor,
  parseExtensionPackageJson,
} from "@vokality/ragdoll-extensions/loader";
import packageJson from "../package.json" with { type: "json" };
import { GameManager } from "./game-manager.js";

const createGameManager = () =>
  new GameManager({
    createId: () => globalThis.crypto.randomUUID(),
    onListenerError: () => undefined,
  });
const startGame = (manager: GameManager) =>
  manager.start({ userMark: "X", firstPlayer: "user" });
import { createExtension } from "./index.js";

describe("GameManager", () => {
  it("tracks turns, legalMoves, and wins", () => {
    const manager = createGameManager();
    const started = startGame(manager);
    expect(started.status).toBe("in_progress");
    expect(started.currentPlayer).toBe("user");
    expect(started.legalMoves).toEqual([]);

    const userMove = manager.placeUserMark(0, 0);
    expect(userMove.ok).toBe(true);
    if (!userMove.ok) throw new Error("expected user move");
    expect(userMove.state.currentPlayer).toBe("agent");
    expect(userMove.state.legalMoves).toContainEqual({ row: 0, col: 1 });

    const illegal = manager.placeAgentMark(0, 0);
    expect(illegal.ok).toBe(false);

    expect(manager.placeAgentMark(1, 1).ok).toBe(true);
    expect(manager.placeUserMark(0, 1).ok).toBe(true);
    expect(manager.placeAgentMark(2, 2).ok).toBe(true);
    const win = manager.placeUserMark(0, 2);
    expect(win.ok).toBe(true);
    if (!win.ok) throw new Error("expected win");
    expect(win.state.status).toBe("won");
    expect(win.state.winner).toBe("user");
    expect(win.state.legalMoves).toEqual([]);
  });

  it("does not roll a failed transition back over newer game state", () => {
    const manager = createGameManager();
    const checkpoint = startGame(manager);
    const userMove = manager.placeUserMark(0, 0);
    if (!userMove.ok) throw new Error("expected user move");
    const agentMove = manager.placeAgentMark(1, 1);
    if (!agentMove.ok) throw new Error("expected agent move");

    expect(manager.rollback(checkpoint, userMove.state)).toBe(false);
    expect(manager.getState()).toEqual(agentMove.state);
  });

  it("classifies illegal agent moves without changing the turn", () => {
    const manager = createGameManager();
    startGame(manager);
    const userMove = manager.placeUserMark(0, 0);
    if (!userMove.ok) throw new Error("expected user move");

    const illegal = manager.placeAgentMark(0, 0);

    expect(illegal).toEqual({
      ok: false,
      code: "illegal-move",
      error: "Move is not in legalMoves",
    });
    expect(manager.getState()).toEqual(userMove.state);
  });
});

describe("Tic-tac-toe slot board reset", () => {
  it("clears marks and remounts cell ids after New game", async () => {
    const host: ExtensionHostEnvironment = {
      capabilities: new Set(["conversationEvents", "logger"]),
      conversationEvents: {
        publish: async () => ({ eventId: "event-1" }),
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    };
    const extension = createExtension();
    const runtime = await extension.activate(host, {
      instanceId: "tic-tac-toe-reset",
      createdAt: Date.now(),
    });
    const start = runtime.tools?.find(
      (tool) => tool.definition.function.name === "tic_tac_toe_start",
    );
    if (!start) throw new Error("tic_tac_toe_start was not registered");
    await start.handler({}, { extensionId: "tic-tac-toe" });

    const slot = runtime.slots?.[0];
    if (!slot) throw new Error("board slot was not registered");
    const firstPanel = slot.state.getState().panel;
    expect(firstPanel.type).toBe("grid");
    if (firstPanel.type !== "grid") throw new Error("expected grid");
    const firstIds = firstPanel.cells.map((cell) => cell.id);
    await firstPanel.cells[0]?.onClick?.();

    const midPanel = slot.state.getState().panel;
    expect(midPanel.type).toBe("grid");
    if (midPanel.type !== "grid") throw new Error("expected grid");
    expect(midPanel.cells[0]?.label).toBe("X");
    expect(midPanel.cells[0]?.status).toBe("active");
    expect(midPanel.cells.every((cell) => cell.disabled)).toBe(true);
    expect(midPanel.cells.every((cell) => cell.onClick === undefined)).toBe(
      true,
    );
    expect(midPanel.cells[0]?.ariaLabel).toBe("Row 1, column 1: X");

    await midPanel.actions
      ?.find((action) => action.id === "new-game")
      ?.onClick();

    const resetPanel = slot.state.getState().panel;
    expect(resetPanel.type).toBe("grid");
    if (resetPanel.type !== "grid") throw new Error("expected grid");
    expect(resetPanel.cells.every((cell) => cell.label === "")).toBe(true);
    expect(resetPanel.cells.every((cell) => cell.status === "default")).toBe(
      true,
    );
    const resetIds = resetPanel.cells.map((cell) => cell.id);
    expect(resetIds).not.toEqual(firstIds);

    await runtime.dispose?.();
  });

  it("always exposes New game and Clear at the bottom action boundary", async () => {
    const host: ExtensionHostEnvironment = {
      capabilities: new Set(["conversationEvents", "logger"]),
      conversationEvents: {
        publish: async () => ({ eventId: "event-1" }),
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    };
    const runtime = await createExtension().activate(host, {
      instanceId: "tic-tac-toe-actions",
      createdAt: Date.now(),
    });
    const slot = runtime.slots?.[0];
    if (!slot) throw new Error("board slot was not registered");

    const idlePanel = slot.state.getState().panel;
    if (idlePanel.type !== "grid") throw new Error("expected grid");
    expect(
      idlePanel.actions?.map(({ id, disabled }) => ({ id, disabled })),
    ).toEqual([
      { id: "new-game", disabled: undefined },
      { id: "reset", disabled: true },
    ]);

    await idlePanel.actions?.find(({ id }) => id === "new-game")?.onClick();
    const activePanel = slot.state.getState().panel;
    if (activePanel.type !== "grid") throw new Error("expected grid");
    expect(
      activePanel.actions?.map(({ id, disabled }) => ({ id, disabled })),
    ).toEqual([
      { id: "new-game", disabled: undefined },
      { id: "reset", disabled: false },
    ]);

    await runtime.dispose?.();
  });

  it("replaces a completed board with win, loss, and draw results", async () => {
    const host: ExtensionHostEnvironment = {
      capabilities: new Set(["conversationEvents", "logger"]),
      conversationEvents: {
        publish: async () => ({ eventId: "event-1" }),
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    };
    const runtime = await createExtension().activate(host, {
      instanceId: "tic-tac-toe-results",
      createdAt: Date.now(),
    });
    const start = runtime.tools?.find(
      (tool) => tool.definition.function.name === "tic_tac_toe_start",
    );
    const place = runtime.tools?.find(
      (tool) => tool.definition.function.name === "tic_tac_toe_place",
    );
    const slot = runtime.slots?.[0];
    if (!start || !place || !slot) throw new Error("game runtime missing");

    const clickUserCell = async (row: number, col: number): Promise<void> => {
      const panel = slot.state.getState().panel;
      if (panel.type !== "grid") throw new Error("expected grid");
      const cell = panel.cells[row * 3 + col];
      if (!cell?.onClick) throw new Error("expected clickable cell");
      await cell.onClick();
    };
    const placeAgentMark = async (row: number, col: number): Promise<void> => {
      const result = await place.handler(
        { row, col },
        { extensionId: "tic-tac-toe" },
      );
      if (!result.success) throw new Error(result.error ?? "agent move failed");
    };

    await start.handler({}, { extensionId: "tic-tac-toe" });
    await clickUserCell(0, 0);
    await placeAgentMark(1, 0);
    await clickUserCell(0, 1);
    await placeAgentMark(1, 1);
    await clickUserCell(0, 2);

    const winPanel = slot.state.getState().panel;
    if (winPanel.type !== "grid") throw new Error("expected grid");
    expect(winPanel.result).toEqual({
      title: "You win!",
      message: "You completed three in a row.",
      status: "success",
    });
    expect(winPanel.actions?.map(({ id }) => id)).toEqual([
      "new-game",
      "reset",
    ]);

    await winPanel.actions?.find(({ id }) => id === "new-game")?.onClick();
    expect(
      (slot.state.getState().panel as typeof winPanel).result,
    ).toBeUndefined();
    await clickUserCell(0, 0);
    await placeAgentMark(1, 0);
    await clickUserCell(0, 1);
    await placeAgentMark(1, 1);
    await clickUserCell(2, 2);
    await placeAgentMark(1, 2);

    const lossPanel = slot.state.getState().panel;
    if (lossPanel.type !== "grid") throw new Error("expected grid");
    expect(lossPanel.result).toEqual({
      title: "You lose",
      message: "The agent completed three in a row.",
      status: "error",
    });

    await lossPanel.actions?.find(({ id }) => id === "new-game")?.onClick();
    await clickUserCell(0, 0);
    await placeAgentMark(0, 1);
    await clickUserCell(0, 2);
    await placeAgentMark(1, 1);
    await clickUserCell(1, 0);
    await placeAgentMark(1, 2);
    await clickUserCell(2, 1);
    await placeAgentMark(2, 0);
    await clickUserCell(2, 2);

    const drawPanel = slot.state.getState().panel;
    if (drawPanel.type !== "grid") throw new Error("expected grid");
    expect(drawPanel.result).toEqual({
      title: "It's a draw",
      message: "No more moves — nobody completed three in a row.",
      status: "default",
    });

    await runtime.dispose?.();
  });
});

describe("Tic-tac-toe conversation events", () => {
  it("publishes a disableable package with required host caps", () => {
    const descriptor = createExtensionPackageDescriptor(
      parseExtensionPackageJson(JSON.stringify(packageJson)),
    );

    expect(descriptor?.canDisable).toBe(true);
    expect(descriptor?.requiredCapabilities).toEqual([
      "conversationEvents",
      "logger",
    ]);
    expect(createExtension().manifest.requiredCapabilities).toEqual([
      "conversationEvents",
      "logger",
    ]);
    expect(descriptor?.capabilities).toEqual(["tools", "slots"]);
  });

  it("publishes game.move start-turn after a user cell click", async () => {
    const published: ConversationEventInput[] = [];
    const host: ExtensionHostEnvironment = {
      capabilities: new Set(["conversationEvents", "logger"]),
      conversationEvents: {
        publish: async (event) => {
          published.push(event);
          return { eventId: `event-${published.length}` };
        },
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    };
    const extension = createExtension();
    const runtime = await extension.activate(host, {
      instanceId: "tic-tac-toe-test",
      createdAt: Date.now(),
    });

    const start = runtime.tools?.find(
      (tool) => tool.definition.function.name === "tic_tac_toe_start",
    );
    if (!start) throw new Error("tic_tac_toe_start was not registered");
    await start.handler({}, { extensionId: "tic-tac-toe" });

    const slot = runtime.slots?.[0];
    if (!slot) throw new Error("board slot was not registered");
    const panel = slot.state.getState().panel;
    expect(panel.type).toBe("grid");
    if (panel.type !== "grid") throw new Error("expected grid");
    const emptyCell = panel.cells.find((cell) => cell.onClick);
    const staleSecondClick = panel.cells[1]?.onClick;
    expect(emptyCell).toBeDefined();
    await emptyCell?.onClick?.();

    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      type: "game.move",
      turnPolicy: "start-turn",
      requiredToolName: "tic_tac_toe_place",
      payload: {
        status: "in_progress",
        currentPlayer: "agent",
        lastMove: { player: "user", row: 0, col: 0, mark: "X" },
      },
    });
    expect(published[0]?.deduplicationKey).toMatch(/^move:/);

    const agentTurnPanel = slot.state.getState().panel;
    if (agentTurnPanel.type !== "grid") throw new Error("expected grid");
    expect(agentTurnPanel.cells.every((cell) => cell.disabled)).toBe(true);
    expect(
      agentTurnPanel.cells.every((cell) => cell.onClick === undefined),
    ).toBe(true);
    await staleSecondClick?.();
    const afterStaleClick = slot.state.getState().panel;
    if (afterStaleClick.type !== "grid") throw new Error("expected grid");
    expect(afterStaleClick.cells[1]?.label).toBe("");
    expect(published).toHaveLength(1);

    const place = runtime.tools?.find(
      (tool) => tool.definition.function.name === "tic_tac_toe_place",
    );
    if (!place) throw new Error("tic_tac_toe_place was not registered");
    const afterAgent = await place.handler(
      { row: 1, col: 1 },
      { extensionId: "tic-tac-toe" },
    );
    expect(afterAgent.success).toBe(true);
    expect(published).toHaveLength(1);

    await runtime.dispose?.();
  });

  it("returns the current board and requests a retry for an illegal agent move", async () => {
    const host: ExtensionHostEnvironment = {
      capabilities: new Set(["conversationEvents", "logger"]),
      conversationEvents: {
        publish: async () => ({ eventId: "event-1" }),
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    };
    const runtime = await createExtension().activate(host, {
      instanceId: "tic-tac-toe-illegal-agent-move",
      createdAt: Date.now(),
    });
    const start = runtime.tools?.find(
      (tool) => tool.definition.function.name === "tic_tac_toe_start",
    );
    const place = runtime.tools?.find(
      (tool) => tool.definition.function.name === "tic_tac_toe_place",
    );
    if (!start || !place) throw new Error("tools missing");
    await start.handler({}, { extensionId: "tic-tac-toe" });

    const slot = runtime.slots?.[0];
    if (!slot) throw new Error("board slot was not registered");
    const userPanel = slot.state.getState().panel;
    if (userPanel.type !== "grid") throw new Error("expected grid");
    await userPanel.cells[0]?.onClick?.();

    const failure = await place.handler(
      { row: 0, col: 0 },
      { extensionId: "tic-tac-toe" },
    );

    expect(failure).toMatchObject({
      success: false,
      retryable: true,
      error: "Move is not in legalMoves",
      data: {
        currentPlayer: "agent",
        legalMoves: expect.arrayContaining([{ row: 1, col: 1 }]),
      },
    });
    const unchangedPanel = slot.state.getState().panel;
    if (unchangedPanel.type !== "grid") throw new Error("expected grid");
    expect(unchangedPanel.cells[0]?.label).toBe("X");
    expect(
      unchangedPanel.cells.filter(({ label }) => label !== ""),
    ).toHaveLength(1);

    await runtime.dispose?.();
  });

  it("rolls back a user move when its start-turn event cannot be persisted", async () => {
    const errors: string[] = [];
    const host: ExtensionHostEnvironment = {
      capabilities: new Set(["conversationEvents", "logger"]),
      conversationEvents: {
        publish: async () => {
          throw new Error("storage unavailable");
        },
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: (message) => errors.push(message),
      },
    };
    const runtime = await createExtension().activate(host, {
      instanceId: "tic-tac-toe-publish-failure",
      createdAt: Date.now(),
    });
    const start = runtime.tools?.find(
      (tool) => tool.definition.function.name === "tic_tac_toe_start",
    );
    if (!start) throw new Error("tic_tac_toe_start was not registered");
    await start.handler({}, { extensionId: "tic-tac-toe" });

    const slot = runtime.slots?.[0];
    if (!slot) throw new Error("board slot was not registered");
    const panel = slot.state.getState().panel;
    if (panel.type !== "grid") throw new Error("expected grid");
    const firstCell = panel.cells[0];
    if (!firstCell?.onClick) throw new Error("expected clickable first cell");

    await expect(firstCell.onClick()).rejects.toThrow("storage unavailable");

    const restoredPanel = slot.state.getState().panel;
    if (restoredPanel.type !== "grid") throw new Error("expected grid");
    expect(restoredPanel.title).toBe("Your turn");
    expect(restoredPanel.cells[0]?.label).toBe("");
    expect(restoredPanel.cells.every((cell) => !cell.disabled)).toBe(true);
    expect(
      restoredPanel.cells.every((cell) => cell.onClick !== undefined),
    ).toBe(true);
    expect(errors).toEqual(["Failed to publish game event"]);

    await runtime.dispose?.();
  });

  it("publishes game.ended start-turn when the user finishes the game", async () => {
    const published: ConversationEventInput[] = [];
    const host: ExtensionHostEnvironment = {
      capabilities: new Set(["conversationEvents", "logger"]),
      conversationEvents: {
        publish: async (event) => {
          published.push(event);
          return { eventId: `event-${published.length}` };
        },
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    };
    const extension = createExtension();
    const runtime = await extension.activate(host, {
      instanceId: "tic-tac-toe-end",
      createdAt: Date.now(),
    });
    const start = runtime.tools?.find(
      (tool) => tool.definition.function.name === "tic_tac_toe_start",
    );
    const place = runtime.tools?.find(
      (tool) => tool.definition.function.name === "tic_tac_toe_place",
    );
    if (!start || !place) throw new Error("tools missing");

    await start.handler({}, { extensionId: "tic-tac-toe" });
    const slot = runtime.slots?.[0];
    if (!slot) throw new Error("board slot was not registered");

    // Force a quick user win: X X X on row 0
    const panel0 = slot.state.getState().panel;
    if (panel0.type !== "grid") throw new Error("expected grid");
    await panel0.cells.find((cell) => cell.id.endsWith(":0-0"))?.onClick?.();
    await place.handler({ row: 1, col: 0 }, { extensionId: "tic-tac-toe" });
    const panel1 = slot.state.getState().panel;
    if (panel1.type !== "grid") throw new Error("expected grid");
    await panel1.cells.find((cell) => cell.id.endsWith(":0-1"))?.onClick?.();
    await place.handler({ row: 1, col: 1 }, { extensionId: "tic-tac-toe" });
    const panel2 = slot.state.getState().panel;
    if (panel2.type !== "grid") throw new Error("expected grid");
    await panel2.cells.find((cell) => cell.id.endsWith(":0-2"))?.onClick?.();

    const ended = published.filter((event) => event.type === "game.ended");
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({
      type: "game.ended",
      turnPolicy: "start-turn",
      payload: { status: "won", winner: "user" },
    });
    expect(published.some((event) => event.type === "game.move")).toBe(true);
    expect(
      published.filter(
        (event) =>
          event.type === "game.move" &&
          (event.payload as { status?: string }).status === "won",
      ),
    ).toHaveLength(0);

    await runtime.dispose?.();
  });

  it("records game.ended without start-turn when the agent finishes", async () => {
    const published: ConversationEventInput[] = [];
    const host: ExtensionHostEnvironment = {
      capabilities: new Set(["conversationEvents", "logger"]),
      conversationEvents: {
        publish: async (event) => {
          published.push(event);
          return { eventId: `event-${published.length}` };
        },
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    };
    const extension = createExtension();
    const runtime = await extension.activate(host, {
      instanceId: "tic-tac-toe-agent-end",
      createdAt: Date.now(),
    });
    const start = runtime.tools?.find(
      (tool) => tool.definition.function.name === "tic_tac_toe_start",
    );
    const place = runtime.tools?.find(
      (tool) => tool.definition.function.name === "tic_tac_toe_place",
    );
    if (!start || !place) throw new Error("tools missing");

    await start.handler(
      { firstPlayer: "agent" },
      { extensionId: "tic-tac-toe" },
    );
    // Agent O wins on diagonal after user fills poorly — drive to agent win:
    // Agent O at 0,0; user X at 0,1; agent O at 1,1; user X at 0,2; agent O at 2,2 wins
    await place.handler({ row: 0, col: 0 }, { extensionId: "tic-tac-toe" });
    const slot = runtime.slots?.[0];
    if (!slot) throw new Error("missing slot");
    let panel = slot.state.getState().panel;
    if (panel.type !== "grid") throw new Error("expected grid");
    await panel.cells.find((cell) => cell.id.endsWith(":0-1"))?.onClick?.();
    await place.handler({ row: 1, col: 1 }, { extensionId: "tic-tac-toe" });
    panel = slot.state.getState().panel;
    if (panel.type !== "grid") throw new Error("expected grid");
    await panel.cells.find((cell) => cell.id.endsWith(":0-2"))?.onClick?.();
    const win = await place.handler(
      { row: 2, col: 2 },
      { extensionId: "tic-tac-toe" },
    );
    expect(win.success).toBe(true);
    expect((win.data as { status: string }).status).toBe("won");
    await Promise.resolve();

    const ended = published.filter((event) => event.type === "game.ended");
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({
      type: "game.ended",
      turnPolicy: "record-only",
      payload: { status: "won", winner: "agent" },
    });

    await runtime.dispose?.();
  });

  it("publishes game.started and game.reset from panel actions", async () => {
    const published: ConversationEventInput[] = [];
    const host: ExtensionHostEnvironment = {
      capabilities: new Set(["conversationEvents", "logger"]),
      conversationEvents: {
        publish: async (event) => {
          published.push(event);
          return { eventId: `event-${published.length}` };
        },
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    };
    const extension = createExtension();
    const runtime = await extension.activate(host, {
      instanceId: "tic-tac-toe-lifecycle",
      createdAt: Date.now(),
    });
    const slot = runtime.slots?.[0];
    if (!slot) throw new Error("board slot was not registered");

    const idlePanel = slot.state.getState().panel;
    expect(idlePanel.type).toBe("grid");
    if (idlePanel.type !== "grid") throw new Error("expected grid");
    await idlePanel.actions
      ?.find((action) => action.id === "new-game")
      ?.onClick();

    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      type: "game.started",
      turnPolicy: "start-turn",
      payload: { status: "in_progress", currentPlayer: "user" },
    });
    expect(published[0]?.deduplicationKey).toMatch(/^started:/);

    const activePanel = slot.state.getState().panel;
    expect(activePanel.type).toBe("grid");
    if (activePanel.type !== "grid") throw new Error("expected grid");
    await activePanel.actions
      ?.find((action) => action.id === "reset")
      ?.onClick();

    expect(published).toHaveLength(2);
    expect(published[1]).toMatchObject({
      type: "game.reset",
      turnPolicy: "start-turn",
      payload: { status: "idle", currentPlayer: null },
    });
    expect(published[1]?.deduplicationKey).toMatch(/^reset:/);

    await runtime.dispose?.();
  });
});
