/**
 * Tic-tac-toe game manager — authoritative board state for the extension.
 */

export type Mark = "X" | "O";
export type Player = "user" | "agent";
export type GameStatus = "idle" | "in_progress" | "won" | "draw";

export interface BoardMove {
  player: Player;
  row: number;
  col: number;
  mark: Mark;
}

export interface LegalMove {
  row: number;
  col: number;
}

export type MoveErrorCode =
  "no-game" | "wrong-turn" | "invalid-coordinate" | "illegal-move" | "occupied";

export interface MoveFailure {
  ok: false;
  code: MoveErrorCode;
  error: string;
}

export type MoveResult = { ok: true; state: GameSnapshot } | MoveFailure;

export interface GameSnapshot {
  gameId: string;
  board: (Mark | null)[][];
  userMark: Mark;
  agentMark: Mark;
  currentPlayer: Player | null;
  legalMoves: LegalMove[];
  lastMove: BoardMove | null;
  status: GameStatus;
  winner: Player | null;
  moveIndex: number;
}

export type GameEventType =
  | "game:started"
  | "game:move"
  | "game:finished"
  | "game:reset"
  | "state:changed";

export interface GameEvent {
  type: GameEventType;
  state: GameSnapshot;
}

export type GameEventCallback = (event: GameEvent) => void;
export type GameListenerErrorHandler = (error: unknown) => void;

export interface GameManagerDependencies {
  createId(): string;
  onListenerError: GameListenerErrorHandler;
}

const WIN_LINES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
];

function emptyBoard(): (Mark | null)[][] {
  return [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
}

function cloneBoard(board: (Mark | null)[][]): (Mark | null)[][] {
  return board.map((row) => [...row]);
}

function cloneSnapshot(snapshot: GameSnapshot): GameSnapshot {
  return {
    ...snapshot,
    board: cloneBoard(snapshot.board),
    legalMoves: snapshot.legalMoves.map((move) => ({ ...move })),
    lastMove: snapshot.lastMove ? { ...snapshot.lastMove } : null,
  };
}

function emptyCells(board: (Mark | null)[][]): LegalMove[] {
  const moves: LegalMove[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (board[row]?.[col] === null) {
        moves.push({ row, col });
      }
    }
  }
  return moves;
}

function findWinner(board: (Mark | null)[][]): Mark | null {
  for (const line of WIN_LINES) {
    const first = board[line[0]![0]!]![line[0]![1]!];
    if (first && line.every(([row, col]) => board[row]![col] === first)) {
      return first;
    }
  }
  return null;
}

function idleSnapshot(): GameSnapshot {
  return {
    gameId: "",
    board: emptyBoard(),
    userMark: "X",
    agentMark: "O",
    currentPlayer: null,
    legalMoves: [],
    lastMove: null,
    status: "idle",
    winner: null,
    moveIndex: 0,
  };
}

export class GameManager {
  private state: GameSnapshot = idleSnapshot();
  private readonly listeners = new Set<GameEventCallback>();

  constructor(private readonly dependencies: GameManagerDependencies) {}

  getState(): GameSnapshot {
    return cloneSnapshot(this.state);
  }

  onStateChange(callback: GameEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  start(options: { userMark: Mark; firstPlayer: Player }): GameSnapshot {
    const userMark = options.userMark;
    const agentMark: Mark = userMark === "X" ? "O" : "X";
    const firstPlayer = options.firstPlayer;
    const board = emptyBoard();

    this.state = {
      gameId: this.dependencies.createId(),
      board,
      userMark,
      agentMark,
      currentPlayer: firstPlayer,
      legalMoves: firstPlayer === "agent" ? emptyCells(board) : [],
      lastMove: null,
      status: "in_progress",
      winner: null,
      moveIndex: 0,
    };
    this.emit("game:started");
    return this.getState();
  }

  reset(): GameSnapshot {
    this.state = idleSnapshot();
    this.emit("game:reset");
    return this.getState();
  }

  rollback(checkpoint: GameSnapshot, expectedState: GameSnapshot): boolean {
    if (
      this.state.gameId !== expectedState.gameId ||
      this.state.moveIndex !== expectedState.moveIndex ||
      this.state.status !== expectedState.status ||
      this.state.currentPlayer !== expectedState.currentPlayer
    ) {
      return false;
    }

    this.state = cloneSnapshot(checkpoint);
    this.emit("state:changed");
    return true;
  }

  placeUserMark(row: number, col: number): MoveResult {
    return this.place("user", row, col);
  }

  placeAgentMark(row: number, col: number): MoveResult {
    return this.place("agent", row, col);
  }

  destroy(): void {
    this.listeners.clear();
  }

  private place(player: Player, row: number, col: number): MoveResult {
    if (this.state.status !== "in_progress") {
      return { ok: false, code: "no-game", error: "No game in progress" };
    }
    if (this.state.currentPlayer !== player) {
      return {
        ok: false,
        code: "wrong-turn",
        error: `It is not the ${player}'s turn`,
      };
    }
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < 0 ||
      row > 2 ||
      col < 0 ||
      col > 2
    ) {
      return {
        ok: false,
        code: "invalid-coordinate",
        error: "Move must use row and col in 0..2",
      };
    }
    if (player === "agent") {
      const legal = this.state.legalMoves.some(
        (move) => move.row === row && move.col === col,
      );
      if (!legal) {
        return {
          ok: false,
          code: "illegal-move",
          error: "Move is not in legalMoves",
        };
      }
    } else if (this.state.board[row]![col] !== null) {
      return {
        ok: false,
        code: "occupied",
        error: "Cell is already occupied",
      };
    }

    const mark = player === "user" ? this.state.userMark : this.state.agentMark;
    const board = cloneBoard(this.state.board);
    board[row]![col] = mark;
    const winningMark = findWinner(board);
    const empties = emptyCells(board);
    const moveIndex = this.state.moveIndex + 1;
    const lastMove: BoardMove = { player, row, col, mark };

    let status: GameStatus = "in_progress";
    let winner: Player | null = null;
    let currentPlayer: Player | null = player === "user" ? "agent" : "user";

    if (winningMark) {
      status = "won";
      winner = winningMark === this.state.userMark ? "user" : "agent";
      currentPlayer = null;
    } else if (empties.length === 0) {
      status = "draw";
      currentPlayer = null;
    }

    this.state = {
      ...this.state,
      board,
      currentPlayer,
      legalMoves:
        status === "in_progress" && currentPlayer === "agent" ? empties : [],
      lastMove,
      status,
      winner,
      moveIndex,
    };

    this.emit(status === "in_progress" ? "game:move" : "game:finished");
    return { ok: true, state: this.getState() };
  }

  private emit(type: GameEventType): void {
    const event: GameEvent = { type, state: this.getState() };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.dependencies.onListenerError(error);
      }
    }
  }
}
