/**
 * Tic-tac-toe extension — playable board slot + agent tools + conversation events.
 *
 * Tools:
 * - tic_tac_toe_start: Start a new game
 * - tic_tac_toe_place: Place the agent's mark
 * - tic_tac_toe_get_board: Get the current GameSnapshot
 */

import {
  createExtension as defineExtension,
  type ExtensionHostEnvironment,
  type ExtensionRuntimeContribution,
  type ExtensionTool,
  type JsonObject,
  type RagdollExtension,
  type ToolResult,
  type ValidationResult,
} from "@vokality/ragdoll-extensions";
import {
  createSlotState,
  type GridPanelCell,
  type GridPanelResult,
  type PanelAction,
  type SlotState,
} from "@vokality/ragdoll-extensions/slots";
import {
  GameManager,
  type GameSnapshot,
  type Mark,
  type Player,
} from "./game-manager.js";

export type {
  BoardMove,
  GameEvent,
  GameEventCallback,
  GameSnapshot,
  GameStatus,
  LegalMove,
  Mark,
  MoveErrorCode,
  MoveFailure,
  MoveResult,
  Player,
} from "./game-manager.js";
export { GameManager } from "./game-manager.js";

const DEFAULT_EXTENSION_ID = "tic-tac-toe";
const REQUIRED_HOST_CAPABILITIES = ["conversationEvents", "logger"] as const;

export interface StartGameArgs {
  userMark?: Mark;
  firstPlayer?: Player;
}

export interface PlaceMarkArgs {
  row: number;
  col: number;
}

export type GetBoardArgs = Record<string, never>;

export interface TicTacToeToolHandler {
  start(args: StartGameArgs): ToolResult;
  place(args: PlaceMarkArgs): ToolResult | Promise<ToolResult>;
  getBoard(args: GetBoardArgs): ToolResult;
}

function toEventPayload(snapshot: GameSnapshot): JsonObject {
  return {
    gameId: snapshot.gameId,
    board: snapshot.board,
    userMark: snapshot.userMark,
    agentMark: snapshot.agentMark,
    currentPlayer: snapshot.currentPlayer,
    legalMoves: snapshot.legalMoves.map((move) => ({
      row: move.row,
      col: move.col,
    })),
    lastMove: snapshot.lastMove
      ? {
          player: snapshot.lastMove.player,
          row: snapshot.lastMove.row,
          col: snapshot.lastMove.col,
          mark: snapshot.lastMove.mark,
        }
      : null,
    status: snapshot.status,
    winner: snapshot.winner,
    moveIndex: snapshot.moveIndex,
  };
}

function validateStartArgs(args: StartGameArgs): ValidationResult {
  if (
    args.userMark !== undefined &&
    args.userMark !== "X" &&
    args.userMark !== "O"
  ) {
    return { valid: false, error: "userMark must be X or O" };
  }
  if (
    args.firstPlayer !== undefined &&
    args.firstPlayer !== "user" &&
    args.firstPlayer !== "agent"
  ) {
    return { valid: false, error: "firstPlayer must be user or agent" };
  }
  return { valid: true };
}

function validatePlaceArgs(args: PlaceMarkArgs): ValidationResult {
  if (
    typeof args.row !== "number" ||
    typeof args.col !== "number" ||
    !Number.isInteger(args.row) ||
    !Number.isInteger(args.col)
  ) {
    return {
      valid: false,
      error: "row and col must be integers",
      retryable: true,
    };
  }
  if (args.row < 0 || args.row > 2 || args.col < 0 || args.col > 2) {
    return {
      valid: false,
      error: "row and col must be in 0..2",
      retryable: true,
    };
  }
  return { valid: true };
}

export function createTicTacToeTools(
  handler: TicTacToeToolHandler,
): ExtensionTool[] {
  return [
    {
      definition: {
        type: "function",
        function: {
          name: "tic_tac_toe_start",
          description:
            "Start a new tic-tac-toe game against the user. Returns a GameSnapshot including legalMoves when it is the agent's turn.",
          parameters: {
            type: "object",
            properties: {
              userMark: {
                type: "string",
                enum: ["X", "O"],
                description: "Mark for the user (default X)",
              },
              firstPlayer: {
                type: "string",
                enum: ["user", "agent"],
                description: "Who moves first (default user)",
              },
            },
            additionalProperties: false,
          },
        },
      },
      validate: (args) => validateStartArgs(args as StartGameArgs),
      handler: (args) => handler.start(args as StartGameArgs),
    },
    {
      definition: {
        type: "function",
        function: {
          name: "tic_tac_toe_place",
          description:
            "Place the agent's mark at row/col (0-2). Only coordinates listed in legalMoves are accepted. If rejected, use the returned GameSnapshot to choose a legal move and retry.",
          parameters: {
            type: "object",
            properties: {
              row: {
                type: "number",
                description: "Row index 0..2",
                minimum: 0,
                maximum: 2,
              },
              col: {
                type: "number",
                description: "Column index 0..2",
                minimum: 0,
                maximum: 2,
              },
            },
            required: ["row", "col"],
            additionalProperties: false,
          },
        },
      },
      validate: (args) => validatePlaceArgs(args as unknown as PlaceMarkArgs),
      handler: (args) => handler.place(args as unknown as PlaceMarkArgs),
    },
    {
      definition: {
        type: "function",
        function: {
          name: "tic_tac_toe_get_board",
          description:
            "Get the current tic-tac-toe GameSnapshot, including board, currentPlayer, and legalMoves.",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      },
      handler: (_args) => handler.getBoard({}),
    },
  ];
}

function panelTitle(snapshot: GameSnapshot): string {
  switch (snapshot.status) {
    case "idle":
      return "Tic-Tac-Toe";
    case "won":
      return "Tic-Tac-Toe";
    case "draw":
      return "Tic-Tac-Toe";
    case "in_progress":
      return snapshot.currentPlayer === "user" ? "Your turn" : "Agent's turn";
  }
}

function panelResult(snapshot: GameSnapshot): GridPanelResult | undefined {
  if (snapshot.status === "draw") {
    return {
      title: "It's a draw",
      message: "No more moves — nobody completed three in a row.",
      status: "default",
    };
  }
  if (snapshot.status !== "won") {
    return undefined;
  }
  if (snapshot.winner === "user") {
    return {
      title: "You win!",
      message: "You completed three in a row.",
      status: "success",
    };
  }
  return {
    title: "You lose",
    message: "The agent completed three in a row.",
    status: "error",
  };
}

function deriveSlotState(
  snapshot: GameSnapshot,
  manager: GameManager,
  publishUserOutcome: (state: GameSnapshot) => Promise<void>,
  publish: (
    type: ConversationGameEventType,
    state: GameSnapshot,
  ) => Promise<void>,
): SlotState {
  const gameKey = snapshot.gameId || "idle";
  const cells: GridPanelCell[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const mark = snapshot.board[row]![col];
      const id = `${gameKey}:${row}-${col}`;
      const canUserClick =
        snapshot.status === "in_progress" &&
        snapshot.currentPlayer === "user" &&
        mark === null;
      const isLastMove =
        snapshot.lastMove?.row === row && snapshot.lastMove?.col === col;
      cells.push({
        id,
        label: mark ?? "",
        ariaLabel: `Row ${row + 1}, column ${col + 1}: ${mark ?? "empty"}`,
        // Only the latest move is emphasized so a new game remounts clean
        status: isLastMove ? "active" : "default",
        disabled: !canUserClick,
        onClick: canUserClick
          ? async () => {
              const checkpoint = manager.getState();
              const result = manager.placeUserMark(row, col);
              if (result.ok) {
                await publishOrRollback(manager, checkpoint, result.state, () =>
                  publishUserOutcome(result.state),
                );
              }
            }
          : undefined,
      });
    }
  }

  const actions: PanelAction[] = [
    {
      id: "new-game",
      label: "New game",
      variant: "primary",
      onClick: async () => {
        const checkpoint = manager.getState();
        const nextState = manager.start({
          userMark: "X",
          firstPlayer: "user",
        });
        await publishOrRollback(manager, checkpoint, nextState, () =>
          publish("game.started", nextState),
        );
      },
    },
  ];
  actions.push({
    id: "reset",
    label: "Clear",
    variant: "secondary",
    disabled: snapshot.status === "idle",
    onClick: async () => {
      const checkpoint = manager.getState();
      const nextState = manager.reset();
      await publishOrRollback(manager, checkpoint, nextState, () =>
        publish("game.reset", nextState),
      );
    },
  });

  return {
    badge:
      snapshot.status === "in_progress"
        ? snapshot.currentPlayer === "user"
          ? "you"
          : "ai"
        : snapshot.status === "won"
          ? "!"
          : null,
    visible: true,
    panel: {
      type: "grid",
      title: panelTitle(snapshot),
      columns: 3,
      emptyMessage: "Start a game to play",
      cells,
      result: panelResult(snapshot),
      actions,
    },
  };
}

type ConversationGameEventType =
  "game.move" | "game.started" | "game.reset" | "game.ended";

function isFinished(snapshot: GameSnapshot): boolean {
  return snapshot.status === "won" || snapshot.status === "draw";
}

async function publishOrRollback(
  manager: GameManager,
  checkpoint: GameSnapshot,
  nextState: GameSnapshot,
  publishEvent: () => Promise<void>,
): Promise<void> {
  try {
    await publishEvent();
  } catch (error) {
    manager.rollback(checkpoint, nextState);
    throw error;
  }
}

function eventDeduplicationKey(
  type: ConversationGameEventType,
  snapshot: GameSnapshot,
  createId: () => string,
): string {
  switch (type) {
    case "game.move":
      return `move:${snapshot.gameId}:${snapshot.moveIndex}`;
    case "game.started":
      return `started:${snapshot.gameId}`;
    case "game.reset":
      return `reset:${createId()}`;
    case "game.ended":
      return `ended:${snapshot.gameId}:${snapshot.status}:${snapshot.moveIndex}`;
  }
}

function createRuntime(
  host: ExtensionHostEnvironment,
): ExtensionRuntimeContribution {
  const conversationEvents = host.conversationEvents;
  const logger = host.logger;
  if (!conversationEvents || !logger) {
    throw new Error(
      "Tic-tac-toe requires conversationEvents and logger host capabilities",
    );
  }

  const createId = () => globalThis.crypto.randomUUID();
  const manager = new GameManager({
    createId,
    onListenerError: (error) => {
      logger.error("Game event listener failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const publish = async (
    type: ConversationGameEventType,
    snapshot: GameSnapshot,
    turnPolicy: "record-only" | "start-turn" = "start-turn",
    requiredToolName?: string,
  ): Promise<void> => {
    try {
      await conversationEvents.publish({
        type,
        payload: toEventPayload(snapshot),
        turnPolicy,
        requiredToolName,
        deduplicationKey: eventDeduplicationKey(type, snapshot, createId),
      });
    } catch (error) {
      logger.error("Failed to publish game event", {
        type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const publishUserOutcome = async (snapshot: GameSnapshot): Promise<void> => {
    if (isFinished(snapshot)) {
      await publish("game.ended", snapshot, "start-turn");
      return;
    }
    await publish("game.move", snapshot, "start-turn", "tic_tac_toe_place");
  };

  const slotState = createSlotState(
    deriveSlotState(manager.getState(), manager, publishUserOutcome, publish),
    (error) => {
      logger.error("Tic-tac-toe slot listener failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  );
  const unsubscribeSlot = manager.onStateChange((event) => {
    slotState.replaceState(
      deriveSlotState(event.state, manager, publishUserOutcome, publish),
    );
  });

  const handler: TicTacToeToolHandler = {
    start: ({ userMark, firstPlayer }) => ({
      success: true,
      data: manager.start({
        userMark: userMark ?? "X",
        firstPlayer: firstPlayer ?? "user",
      }),
    }),
    place: async ({ row, col }) => {
      const checkpoint = manager.getState();
      const result = manager.placeAgentMark(row, col);
      if (!result.ok) {
        return {
          success: false,
          error: result.error,
          retryable:
            result.code === "illegal-move" ||
            result.code === "invalid-coordinate",
          data: manager.getState(),
        };
      }
      // Durable end mark for later turns; no start-turn — agent is already mid-turn.
      if (isFinished(result.state)) {
        try {
          await publishOrRollback(manager, checkpoint, result.state, () =>
            publish("game.ended", result.state, "record-only"),
          );
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            retryable: true,
            data: manager.getState(),
          };
        }
      }
      return { success: true, data: result.state };
    },
    getBoard: () => ({ success: true, data: manager.getState() }),
  };

  return {
    tools: createTicTacToeTools(handler),
    slots: [
      {
        id: `${DEFAULT_EXTENSION_ID}.board`,
        label: "Tic-Tac-Toe",
        icon: "grid",
        priority: 70,
        state: slotState,
      },
    ],
    dispose: () => {
      unsubscribeSlot();
      manager.destroy();
    },
  };
}

/**
 * Create the tic-tac-toe extension (optional / canDisable).
 */
export function createExtension(): RagdollExtension {
  return defineExtension({
    id: DEFAULT_EXTENSION_ID,
    name: "Tic-Tac-Toe",
    version: "0.1.0",
    description: "Play tic-tac-toe with the agent on a shared board",
    requiredCapabilities: REQUIRED_HOST_CAPABILITIES,
    optionalCapabilities: [],
    createRuntime: (host) => createRuntime(host),
  });
}
