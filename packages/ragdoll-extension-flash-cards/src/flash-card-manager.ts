/**
 * FlashCardManager - Decks, SRS scheduling, and ephemeral review sessions.
 */

export const FLASH_CARDS_STORAGE_VERSION = 1 as const;

export type Rating = "again" | "hard" | "easy";

export interface FlashCard {
  id: string;
  front: string;
  back: string;
  dueAt: number;
  intervalMs: number;
  ease: number;
}

export interface FlashDeck {
  id: string;
  name: string;
  cards: FlashCard[];
  createdAt: number;
}

/** Durable subset persisted to host storage. */
export interface DurableFlashCardState {
  version: typeof FLASH_CARDS_STORAGE_VERSION;
  decks: FlashDeck[];
}

export type ReviewPhase = "front" | "revealed";

export interface ReviewResult {
  title: string;
  message?: string;
  status: "success" | "error" | "default";
  correct: boolean;
}

export interface ReviewQueueEntry {
  deckId: string;
  cardId: string;
}

export interface ReviewSession {
  queue: ReviewQueueEntry[];
  currentIndex: number;
  attemptId: string | null;
  phase: ReviewPhase;
  result: ReviewResult | null;
  submittedAnswer: string | null;
}

export interface FlashCardViewState {
  durable: DurableFlashCardState;
  session: ReviewSession;
  pending: boolean;
}

export type FlashCardEventType =
  | "state:changed"
  | "deck:added"
  | "card:added"
  | "review:started"
  | "review:ended"
  | "answer:submitted"
  | "card:rated";

export interface FlashCardEvent {
  type: FlashCardEventType;
  state: FlashCardViewState;
  timestamp: number;
}

export type FlashCardEventCallback = (event: FlashCardEvent) => void;

export interface FlashCardManagerDependencies {
  createId(): string;
  now(): number;
  onListenerError: (error: unknown) => void;
}

export const SRS_INTERVALS_MS = {
  again: 60_000,
  hard: 600_000,
  easy: 86_400_000,
} as const;

export const EMPTY_DURABLE_STATE: DurableFlashCardState = {
  version: FLASH_CARDS_STORAGE_VERSION,
  decks: [],
};

function createIdleSession(): ReviewSession {
  return {
    queue: [],
    currentIndex: 0,
    attemptId: null,
    phase: "front",
    result: null,
    submittedAnswer: null,
  };
}

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase();
}

export function isDurableFlashCardState(
  value: unknown,
): value is DurableFlashCardState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as DurableFlashCardState;
  if (candidate.version !== FLASH_CARDS_STORAGE_VERSION) return false;
  if (!Array.isArray(candidate.decks)) return false;
  return candidate.decks.every(
    (deck) =>
      typeof deck?.id === "string" &&
      typeof deck?.name === "string" &&
      typeof deck?.createdAt === "number" &&
      Array.isArray(deck.cards) &&
      deck.cards.every(
        (card) =>
          typeof card?.id === "string" &&
          typeof card?.front === "string" &&
          typeof card?.back === "string" &&
          typeof card?.dueAt === "number" &&
          typeof card?.intervalMs === "number" &&
          typeof card?.ease === "number",
      ),
  );
}

export class FlashCardManager {
  private durable: DurableFlashCardState = EMPTY_DURABLE_STATE;
  private session: ReviewSession = createIdleSession();
  private pending = false;
  private listeners = new Set<FlashCardEventCallback>();

  constructor(
    initialState: DurableFlashCardState,
    private readonly dependencies: FlashCardManagerDependencies,
  ) {
    this.loadDurable(initialState);
  }

  loadDurable(state: DurableFlashCardState): void {
    this.durable = {
      version: FLASH_CARDS_STORAGE_VERSION,
      decks: state.decks.map((deck) => ({
        ...deck,
        cards: deck.cards.map((card) => ({ ...card })),
      })),
    };
    this.emit("state:changed");
  }

  /** Restore durable + session after a failed persistence commit. */
  restoreCheckpoint(
    durable: DurableFlashCardState,
    session: ReviewSession,
    pending = false,
  ): void {
    this.durable = {
      version: FLASH_CARDS_STORAGE_VERSION,
      decks: durable.decks.map((deck) => ({
        ...deck,
        cards: deck.cards.map((card) => ({ ...card })),
      })),
    };
    this.session = {
      ...session,
      queue: session.queue.map((entry) => ({ ...entry })),
    };
    this.pending = pending;
    this.emit("state:changed");
  }

  getDurableState(): DurableFlashCardState {
    return {
      version: FLASH_CARDS_STORAGE_VERSION,
      decks: this.durable.decks.map((deck) => ({
        ...deck,
        cards: deck.cards.map((card) => ({ ...card })),
      })),
    };
  }

  getState(): FlashCardViewState {
    return {
      durable: this.getDurableState(),
      session: {
        ...this.session,
        queue: this.session.queue.map((entry) => ({ ...entry })),
      },
      pending: this.pending,
    };
  }

  setPending(pending: boolean): void {
    if (this.pending === pending) return;
    this.pending = pending;
    this.emit("state:changed");
  }

  getDeck(deckId: string): FlashDeck | undefined {
    return this.durable.decks.find((deck) => deck.id === deckId);
  }

  listDecks(): FlashDeck[] {
    return this.getDurableState().decks;
  }

  countDueCards(deckId?: string, now = this.dependencies.now()): number {
    const decks = deckId
      ? this.durable.decks.filter((deck) => deck.id === deckId)
      : this.durable.decks;
    return decks.reduce(
      (total, deck) =>
        total + deck.cards.filter((card) => card.dueAt <= now).length,
      0,
    );
  }

  listDueCards(deckId?: string, now = this.dependencies.now()): FlashCard[] {
    const decks = deckId
      ? this.durable.decks.filter((deck) => deck.id === deckId)
      : this.durable.decks;
    return decks.flatMap((deck) =>
      deck.cards.filter((card) => card.dueAt <= now).map((card) => ({ ...card })),
    );
  }

  getCurrentCard(): FlashCard | null {
    if (!this.session.attemptId) return null;
    const entry = this.session.queue[this.session.currentIndex];
    if (!entry) return null;
    const deck = this.getDeck(entry.deckId);
    return deck?.cards.find((card) => card.id === entry.cardId) ?? null;
  }

  addDeck(name: string): FlashDeck {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Deck name is required");
    const deck: FlashDeck = {
      id: this.dependencies.createId(),
      name: trimmed,
      cards: [],
      createdAt: this.dependencies.now(),
    };
    this.durable = {
      ...this.durable,
      decks: [...this.durable.decks, deck],
    };
    this.emit("deck:added");
    return { ...deck, cards: [] };
  }

  addCard(deckId: string, front: string, back: string): FlashCard {
    const trimmedFront = front.trim();
    const trimmedBack = back.trim();
    if (!trimmedFront || !trimmedBack) {
      throw new Error("Card front and back are required");
    }
    const deckIndex = this.durable.decks.findIndex((deck) => deck.id === deckId);
    if (deckIndex < 0) throw new Error(`Deck not found: ${deckId}`);

    const card: FlashCard = {
      id: this.dependencies.createId(),
      front: trimmedFront,
      back: trimmedBack,
      dueAt: this.dependencies.now(),
      intervalMs: SRS_INTERVALS_MS.again,
      ease: 2.5,
    };
    const decks = this.durable.decks.map((deck, index) =>
      index === deckIndex
        ? { ...deck, cards: [...deck.cards, card] }
        : deck,
    );
    this.durable = { ...this.durable, decks };
    this.emit("card:added");
    return { ...card };
  }

  startReview(deckId?: string): ReviewSession {
    const now = this.dependencies.now();
    const targetDecks = deckId
      ? this.durable.decks.filter((deck) => deck.id === deckId)
      : this.durable.decks;
    if (deckId && targetDecks.length === 0) {
      throw new Error(`Deck not found: ${deckId}`);
    }

    const due: ReviewQueueEntry[] = targetDecks.flatMap((deck) =>
      deck.cards
        .filter((card) => card.dueAt <= now)
        .map((card) => ({ deckId: deck.id, cardId: card.id })),
    );
    if (due.length === 0) {
      throw new Error("No cards are due for review");
    }

    this.session = {
      queue: due,
      currentIndex: 0,
      attemptId: this.dependencies.createId(),
      phase: "front",
      result: null,
      submittedAnswer: null,
    };
    this.emit("review:started");
    return this.getState().session;
  }

  endReview(): void {
    this.session = createIdleSession();
    this.emit("review:ended");
  }

  submitAnswer(attemptId: string, answer: string): ReviewResult {
    if (this.session.phase !== "front" || this.session.attemptId !== attemptId) {
      throw new Error("Stale or invalid answer submission");
    }
    const card = this.getCurrentCard();
    if (!card) throw new Error("No active card");

    const correct =
      normalizeAnswer(answer) === normalizeAnswer(card.back);
    const result: ReviewResult = correct
      ? {
          title: "Correct",
          message: card.back,
          status: "success",
          correct: true,
        }
      : {
          title: "Incorrect",
          message: `Answer: ${card.back}`,
          status: "error",
          correct: false,
        };

    this.session = {
      ...this.session,
      phase: "revealed",
      result,
      submittedAnswer: answer,
    };
    this.emit("answer:submitted");
    return result;
  }

  rateCard(attemptId: string, rating: Rating): void {
    if (
      this.session.phase !== "revealed" ||
      this.session.attemptId !== attemptId
    ) {
      throw new Error("Stale or invalid rating");
    }
    const entry = this.session.queue[this.session.currentIndex];
    const card = this.getCurrentCard();
    if (!entry || !card) throw new Error("No active card");

    const now = this.dependencies.now();
    const intervalMs = SRS_INTERVALS_MS[rating];
    const easeDelta =
      rating === "easy" ? 0.15 : rating === "hard" ? -0.15 : -0.3;
    const nextEase = Math.max(1.3, card.ease + easeDelta);

    this.durable = {
      ...this.durable,
      decks: this.durable.decks.map((deck) => ({
        ...deck,
        cards: deck.cards.map((candidate) =>
          candidate.id === card.id
            ? {
                ...candidate,
                dueAt: now + intervalMs,
                intervalMs,
                ease: nextEase,
              }
            : candidate,
        ),
      })),
    };

    let queue = this.session.queue;
    if (rating === "again") {
      queue = [...queue, { ...entry }];
    }

    const nextIndex = this.session.currentIndex + 1;
    if (nextIndex >= queue.length) {
      this.session = createIdleSession();
      this.emit("card:rated");
      return;
    }

    this.session = {
      queue,
      currentIndex: nextIndex,
      attemptId: this.dependencies.createId(),
      phase: "front",
      result: null,
      submittedAnswer: null,
    };
    this.emit("card:rated");
  }

  onStateChange(listener: FlashCardEventCallback): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  private emit(type: FlashCardEventType): void {
    const event: FlashCardEvent = {
      type,
      state: this.getState(),
      timestamp: this.dependencies.now(),
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.dependencies.onListenerError(error);
      }
    }
  }
}
