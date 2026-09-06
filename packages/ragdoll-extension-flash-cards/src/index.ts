/**
 * Flash Cards Extension - Decks, typed-answer review, and simple SRS.
 *
 * Tools:
 * - addDeck / addCard / listDecks / listDueCards
 * - startReview / getReviewState / endReview
 *
 * Slot:
 * - Idle: list of decks with Start Review
 * - Review: cards panel (type → submit → reveal → rate)
 */

import type {
  ExtensionHostEnvironment,
  ExtensionRuntimeContribution,
  ExtensionTool,
  HostConversationEventsCapability,
  HostLoggerCapability,
  HostStorageCapability,
  JsonObject,
  ToolResult,
  ValidationResult,
} from "@vokality/ragdoll-extensions";
import {
  createSlotState,
  type CardsPanelConfig,
  type ListPanelItem,
  type PanelAction,
  type SlotState,
} from "@vokality/ragdoll-extensions/slots";
import {
  EMPTY_DURABLE_STATE,
  FlashCardManager,
  isDurableFlashCardState,
  type DurableFlashCardState,
  type Rating,
  type ReviewSummary,
} from "./flash-card-manager.js";

export {
  FlashCardManager,
  EMPTY_DURABLE_STATE,
  FLASH_CARDS_STORAGE_VERSION,
  SRS_INTERVALS_MS,
  isDurableFlashCardState,
} from "./flash-card-manager.js";
export type {
  DurableFlashCardState,
  FlashCard,
  FlashCardEvent,
  FlashCardViewState,
  FlashDeck,
  Rating,
  ReviewAttemptRecord,
  ReviewPhase,
  ReviewQueueEntry,
  ReviewResult,
  ReviewSession,
  ReviewSummary,
} from "./flash-card-manager.js";

const DEFAULT_EXTENSION_ID = "flash-cards";
const DEFAULT_STORAGE_KEY = "state";
const REQUIRED_HOST_CAPABILITIES = [
  "storage",
  "logger",
  "conversationEvents",
] as const;
const ANSWER_MAX_LENGTH = 2000;
const MAX_PUBLISHED_ATTEMPTS = 10;

export interface AddDeckArgs {
  name: string;
}

export interface AddCardArgs {
  deckId: string;
  front: string;
  back: string;
}

export interface ListDecksArgs {
  // no fields
}

export interface ListDueCardsArgs {
  deckId?: string;
}

export interface StartReviewArgs {
  deckId?: string;
}

export type GetReviewStateArgs = Record<string, never>;
export type EndReviewArgs = Record<string, never>;

export interface FlashCardToolHandler {
  addDeck(args: AddDeckArgs): Promise<ToolResult> | ToolResult;
  addCard(args: AddCardArgs): Promise<ToolResult> | ToolResult;
  listDecks(args: ListDecksArgs): Promise<ToolResult> | ToolResult;
  listDueCards(args: ListDueCardsArgs): Promise<ToolResult> | ToolResult;
  startReview(args: StartReviewArgs): Promise<ToolResult> | ToolResult;
  getReviewState(args: GetReviewStateArgs): Promise<ToolResult> | ToolResult;
  endReview(args: EndReviewArgs): Promise<ToolResult> | ToolResult;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function parseAddDeck(args: Record<string, unknown>): AddDeckArgs {
  return { name: requireString(args.name, "name") };
}

function parseAddCard(args: Record<string, unknown>): AddCardArgs {
  return {
    deckId: requireString(args.deckId, "deckId"),
    front: requireString(args.front, "front"),
    back: requireString(args.back, "back"),
  };
}

function parseDeckFilter(args: Record<string, unknown>): ListDueCardsArgs {
  return {
    deckId:
      args.deckId === undefined
        ? undefined
        : requireString(args.deckId, "deckId"),
  };
}

function validateArguments<T>(
  parse: (args: Record<string, unknown>) => T,
  args: Record<string, unknown>,
): ValidationResult {
  try {
    parse(args);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createFlashCardTools(
  handler: FlashCardToolHandler,
): ExtensionTool[] {
  return [
    {
      definition: {
        type: "function",
        function: {
          name: "addDeck",
          description: "Create a flash-card deck",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Deck name" },
            },
            required: ["name"],
          },
        },
      },
      validate: (args) => validateArguments(parseAddDeck, args),
      handler: (args) => handler.addDeck(parseAddDeck(args)),
    },
    {
      definition: {
        type: "function",
        function: {
          name: "addCard",
          description: "Add a card to a deck",
          parameters: {
            type: "object",
            properties: {
              deckId: { type: "string", description: "Target deck id" },
              front: { type: "string", description: "Prompt / front text" },
              back: { type: "string", description: "Answer / back text" },
            },
            required: ["deckId", "front", "back"],
          },
        },
      },
      validate: (args) => validateArguments(parseAddCard, args),
      handler: (args) => handler.addCard(parseAddCard(args)),
    },
    {
      definition: {
        type: "function",
        function: {
          name: "listDecks",
          description: "List decks with card and due counts",
          parameters: { type: "object", properties: {} },
        },
      },
      handler: () => handler.listDecks({}),
    },
    {
      definition: {
        type: "function",
        function: {
          name: "listDueCards",
          description: "List cards currently due for review",
          parameters: {
            type: "object",
            properties: {
              deckId: {
                type: "string",
                description: "Optional deck filter",
              },
            },
          },
        },
      },
      validate: (args) => validateArguments(parseDeckFilter, args),
      handler: (args) => handler.listDueCards(parseDeckFilter(args)),
    },
    {
      definition: {
        type: "function",
        function: {
          name: "startReview",
          description: "Start a typed-answer review session for due cards",
          parameters: {
            type: "object",
            properties: {
              deckId: {
                type: "string",
                description: "Optional deck to review",
              },
            },
          },
        },
      },
      validate: (args) => validateArguments(parseDeckFilter, args),
      handler: (args) => handler.startReview(parseDeckFilter(args)),
    },
    {
      definition: {
        type: "function",
        function: {
          name: "getReviewState",
          description: "Get the current review session state",
          parameters: { type: "object", properties: {} },
        },
      },
      handler: () => handler.getReviewState({}),
    },
    {
      definition: {
        type: "function",
        function: {
          name: "endReview",
          description: "End the active review session",
          parameters: { type: "object", properties: {} },
        },
      },
      handler: () => handler.endReview({}),
    },
  ];
}

function ratingActionId(attemptId: string, rating: Rating): string {
  return `${attemptId}:${rating}`;
}

function requireHostCapabilities(host: ExtensionHostEnvironment): {
  storage: HostStorageCapability;
  logger: HostLoggerCapability;
  conversationEvents: HostConversationEventsCapability;
} {
  if (!host.storage || !host.logger || !host.conversationEvents) {
    throw new Error(
      "Flash cards requires host storage, logger, and conversationEvents capabilities",
    );
  }
  return {
    storage: host.storage,
    logger: host.logger,
    conversationEvents: host.conversationEvents,
  };
}

function toReviewEventPayload(summary: ReviewSummary): JsonObject {
  // Prefer incorrect attempts for coaching; keep the event small so it
  // does not flood later model turns.
  const ranked = [...summary.attempts].sort(
    (left, right) => Number(left.correct) - Number(right.correct),
  );
  const publishedAttempts = ranked.slice(0, MAX_PUBLISHED_ATTEMPTS);
  return {
    sessionId: summary.sessionId,
    reason: summary.reason,
    startedAt: summary.startedAt,
    endedAt: summary.endedAt,
    total: summary.total,
    correct: summary.correct,
    incorrect: summary.incorrect,
    ratings: { ...summary.ratings },
    attempts: publishedAttempts.map((attempt) => ({
      attemptId: attempt.attemptId,
      deckId: attempt.deckId,
      cardId: attempt.cardId,
      front: attempt.front,
      expectedAnswer: attempt.expectedAnswer,
      submittedAnswer: attempt.submittedAnswer,
      correct: attempt.correct,
      ...(attempt.rating ? { rating: attempt.rating } : {}),
    })),
    omittedAttempts: Math.max(
      0,
      summary.attempts.length - publishedAttempts.length,
    ),
  };
}

async function loadDurableState(
  storage: HostStorageCapability,
  logger: HostLoggerCapability,
): Promise<DurableFlashCardState> {
  const raw = await storage.read(DEFAULT_EXTENSION_ID, DEFAULT_STORAGE_KEY);
  if (raw === undefined || raw === null) return EMPTY_DURABLE_STATE;
  if (isDurableFlashCardState(raw)) return raw;
  logger.error(
    `[${DEFAULT_EXTENSION_ID}] Unsupported or corrupt flash card storage payload`,
  );
  throw new Error("Unsupported or corrupt flash card storage payload");
}

function deriveSlotState(
  manager: FlashCardManager,
  enqueue: <T>(operation: () => Promise<T> | T) => Promise<T>,
  publishReviewCompleted: (
    summary: ReviewSummary,
    turnPolicy: "record-only" | "start-turn",
  ) => Promise<void>,
): SlotState {
  const state = manager.getState();
  const now = Date.now();
  const dueCount = state.durable.decks.reduce(
    (total, deck) =>
      total + deck.cards.filter((card) => card.dueAt <= now).length,
    0,
  );

  if (state.session.attemptId) {
    return {
      badge: dueCount || null,
      visible: true,
      panel: deriveReviewPanel(manager, enqueue, publishReviewCompleted),
    };
  }

  const items: ListPanelItem[] = state.durable.decks.map((deck) => {
    const due = deck.cards.filter((card) => card.dueAt <= now).length;
    return {
      id: deck.id,
      label: deck.name,
      sublabel: `${deck.cards.length} cards · ${due} due`,
      status: due > 0 ? "active" : "default",
    };
  });

  const actions: PanelAction[] = [
    {
      id: "start-review",
      label: "Start Review",
      variant: "primary",
      disabled: dueCount === 0 || state.pending,
      onClick: async () => {
        await enqueue(async () => {
          manager.startReview();
        });
      },
    },
  ];

  return {
    badge: dueCount || null,
    visible: true,
    panel: {
      type: "list",
      title: "Flash Cards",
      emptyMessage: "No decks yet. Ask the agent to addDeck / addCard.",
      items,
      actions,
    },
  };
}

function deriveReviewPanel(
  manager: FlashCardManager,
  enqueue: <T>(operation: () => Promise<T> | T) => Promise<T>,
  publishReviewCompleted: (
    summary: ReviewSummary,
    turnPolicy: "record-only" | "start-turn",
  ) => Promise<void>,
): CardsPanelConfig {
  const state = manager.getState();
  const session = state.session;
  const card = manager.getCurrentCard();
  if (!card || !session.attemptId) {
    throw new Error("Review session is missing an active card");
  }

  const progress = {
    current: session.currentIndex + 1,
    total: Math.max(1, session.queue.length),
    label: "Review",
  };

  if (session.phase === "front") {
    const attemptId = session.attemptId;
    return {
      type: "cards",
      title: "Flash Cards",
      progress,
      card: {
        id: card.id,
        attemptId,
        front: card.front,
        back: card.back,
        face: "front",
      },
      answerInput: {
        id: attemptId,
        placeholder: "Type your answer",
        submitLabel: "Check",
        disabled: state.pending,
        maxLength: ANSWER_MAX_LENGTH,
      },
      actions: [
        {
          id: "end-review",
          label: "End",
          variant: "secondary",
          disabled: state.pending,
          onClick: async () => {
            const summary = await enqueue(() => manager.endReview());
            if (summary) {
              await publishReviewCompleted(summary, "start-turn");
            }
          },
        },
      ],
      onSubmitAnswer: async (answer) => {
        await enqueue(async () => {
          manager.submitAnswer(attemptId, answer);
        });
      },
    };
  }

  const attemptId = session.attemptId;
  const makeRateAction = (
    rating: Rating,
    label: string,
    variant: PanelAction["variant"],
  ): PanelAction => ({
    id: ratingActionId(attemptId, rating),
    label,
    variant,
    disabled: state.pending,
    onClick: async () => {
      const summary = await enqueue(() => manager.rateCard(attemptId, rating));
      if (summary) {
        await publishReviewCompleted(summary, "start-turn");
      }
    },
  });

  return {
    type: "cards",
    title: "Flash Cards",
    progress,
    card: {
      id: card.id,
      attemptId,
      front: card.front,
      back: card.back,
      face: "back",
    },
    result: session.result
      ? {
          title: session.result.title,
          message: session.result.message,
          status: session.result.status,
        }
      : { title: "Revealed", status: "default" },
    actions: [
      makeRateAction("again", "Again", "danger"),
      makeRateAction("hard", "Hard", "secondary"),
      makeRateAction("easy", "Easy", "primary"),
    ],
  };
}

async function createRuntime(
  host: ExtensionHostEnvironment,
): Promise<ExtensionRuntimeContribution> {
  const { storage, logger, conversationEvents } = requireHostCapabilities(host);
  const startingState = await loadDurableState(storage, logger);

  const manager = new FlashCardManager(startingState, {
    createId: () => globalThis.crypto.randomUUID(),
    now: Date.now,
    onListenerError: (error) => {
      logger.error("Flash card event listener failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  let mutationTail: Promise<void> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T> | T): Promise<T> => {
    const run = mutationTail.then(async () => {
      const checkpoint = manager.getState();
      manager.setPending(true);
      try {
        const result = await operation();
        try {
          await storage.write(
            DEFAULT_EXTENSION_ID,
            DEFAULT_STORAGE_KEY,
            manager.getDurableState(),
          );
        } catch (error) {
          logger.error(
            `[${DEFAULT_EXTENSION_ID}] Failed to persist flash card state`,
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
          manager.restoreCheckpoint(
            checkpoint.durable,
            checkpoint.session,
            false,
          );
          throw error;
        }
        return result;
      } catch (error) {
        manager.restoreCheckpoint(
          checkpoint.durable,
          checkpoint.session,
          false,
        );
        throw error;
      } finally {
        if (manager.getState().pending) {
          manager.setPending(false);
        }
      }
    });
    mutationTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const publishReviewCompleted = async (
    summary: ReviewSummary,
    turnPolicy: "record-only" | "start-turn",
  ): Promise<void> => {
    try {
      await conversationEvents.publish({
        type: "review.completed",
        payload: toReviewEventPayload(summary),
        turnPolicy,
        deduplicationKey: `${summary.reason}:${summary.sessionId}:${summary.endedAt}`,
      });
    } catch (error) {
      logger.error("Failed to publish flash card review summary", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const slotState = createSlotState(
    deriveSlotState(manager, enqueue, publishReviewCompleted),
    (error) => {
      logger.error("Flash card slot listener failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  );

  const unsubscribeSlot = manager.onStateChange(() => {
    slotState.replaceState(
      deriveSlotState(manager, enqueue, publishReviewCompleted),
    );
  });

  const handler: FlashCardToolHandler = {
    addDeck: async ({ name }) => {
      const deck = await enqueue(() => manager.addDeck(name));
      return { success: true, data: deck };
    },
    addCard: async ({ deckId, front, back }) => {
      try {
        const card = await enqueue(() => manager.addCard(deckId, front, back));
        return { success: true, data: card };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    listDecks: () => {
      const now = Date.now();
      const decks = manager.listDecks().map((deck) => ({
        id: deck.id,
        name: deck.name,
        cardCount: deck.cards.length,
        dueCount: deck.cards.filter((card) => card.dueAt <= now).length,
      }));
      return { success: true, data: { decks } };
    },
    listDueCards: ({ deckId }) => {
      const cards = manager.listDueCards(deckId);
      return { success: true, data: { cards } };
    },
    startReview: async ({ deckId }) => {
      try {
        const session = await enqueue(() => manager.startReview(deckId));
        return { success: true, data: session };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    getReviewState: () => {
      const state = manager.getState();
      return {
        success: true,
        data: {
          session: state.session,
          currentCard: manager.getCurrentCard(),
          pending: state.pending,
        },
      };
    },
    endReview: async () => {
      const summary = await enqueue(() => manager.endReview());
      if (summary) {
        // Agent is already mid-turn; keep history without nesting another turn.
        await publishReviewCompleted(summary, "record-only");
      }
      return { success: true, data: summary };
    },
  };

  return {
    tools: createFlashCardTools(handler),
    slots: [
      {
        id: `${DEFAULT_EXTENSION_ID}.main`,
        label: "Flash Cards",
        icon: "bookmark",
        priority: 80,
        state: slotState,
      },
    ],
    dispose: () => {
      unsubscribeSlot();
      manager.removeAllListeners();
    },
  };
}

import {
  createExtension as defineExtension,
  type RagdollExtension,
} from "@vokality/ragdoll-extensions";

/**
 * Create the flash cards extension.
 */
export function createExtension(): RagdollExtension {
  return defineExtension({
    id: DEFAULT_EXTENSION_ID,
    name: "Flash Cards",
    version: "0.1.0",
    description: "Decks, typed-answer review, and simple spaced repetition",
    requiredCapabilities: REQUIRED_HOST_CAPABILITIES,
    optionalCapabilities: [],
    createRuntime: (host) => createRuntime(host),
  });
}
