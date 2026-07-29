import { describe, expect, it } from "bun:test";
import {
  createRegistry,
  type ConversationEventInput,
  type ExtensionHostCapability,
  type ExtensionHostEnvironment,
} from "@vokality/ragdoll-extensions";
import {
  createExtensionPackageDescriptor,
  parseExtensionPackageJson,
} from "@vokality/ragdoll-extensions/loader";
import packageJson from "../package.json" with { type: "json" };
import {
  createExtension,
  FlashCardManager,
  SRS_INTERVALS_MS,
} from "./index.js";

const REQUIRED_CAPABILITIES = [
  "storage",
  "logger",
  "conversationEvents",
] as const;

function createHost(
  overrides: Partial<ExtensionHostEnvironment> = {},
  published: ConversationEventInput[] = [],
): ExtensionHostEnvironment {
  return {
    capabilities: new Set<ExtensionHostCapability>(REQUIRED_CAPABILITIES),
    storage: {
      read: async () => undefined,
      write: async () => undefined,
      delete: async () => undefined,
      list: async () => [],
    },
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    conversationEvents: {
      publish: async (event) => {
        published.push(event);
        return { eventId: `event-${published.length}` };
      },
    },
    ...overrides,
  };
}

function createManager(now = 1_000) {
  let clock = now;
  let ids = 0;
  return new FlashCardManager(
    { version: 1, decks: [] },
    {
      createId: () => `id-${++ids}`,
      now: () => clock,
      onListenerError: () => undefined,
    },
  );
}

describe("Flash cards package boundaries", () => {
  it("publishes its required host capabilities in package and runtime manifests", () => {
    const descriptor = createExtensionPackageDescriptor(
      parseExtensionPackageJson(JSON.stringify(packageJson)),
    );

    expect(descriptor?.requiredCapabilities).toEqual([...REQUIRED_CAPABILITIES]);
    expect(createExtension().manifest.requiredCapabilities).toEqual([
      ...REQUIRED_CAPABILITIES,
    ]);
    expect(descriptor?.optionalCapabilities).toEqual([]);
    expect(createExtension().manifest.optionalCapabilities).toEqual([]);
    expect(descriptor?.capabilities).toEqual(["tools", "slots"]);
  });

  it("loads its initial state from required host storage", async () => {
    const reads: Array<{ extensionId: string; key: string }> = [];
    const host = createHost({
      storage: {
        read: async (extensionId, key) => {
          reads.push({ extensionId, key });
          return undefined;
        },
        write: async () => undefined,
        delete: async () => undefined,
        list: async () => [],
      },
    });
    const registry = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });

    await registry.register(createExtension(), { host });

    expect(reads).toEqual([{ extensionId: "flash-cards", key: "state" }]);
    await registry.destroy();
  });

  it("rolls a mutation back when required storage rejects the commit", async () => {
    const host = createHost({
      storage: {
        read: async () => undefined,
        write: async () => {
          throw new Error("storage unavailable");
        },
        delete: async () => undefined,
        list: async () => [],
      },
    });
    const runtime = await createExtension().activate(host, {
      instanceId: "flash-cards-test",
      createdAt: 0,
    });
    const addDeck = runtime.tools?.find(
      (tool) => tool.definition.function.name === "addDeck",
    );
    const listDecks = runtime.tools?.find(
      (tool) => tool.definition.function.name === "listDecks",
    );
    if (!addDeck || !listDecks) {
      throw new Error("Flash card tools were not registered");
    }

    await expect(
      addDeck.handler({ name: "Spanish" }, { extensionId: "flash-cards" }),
    ).rejects.toThrow("storage unavailable");
    expect(
      await listDecks.handler({}, { extensionId: "flash-cards" }),
    ).toMatchObject({
      success: true,
      data: { decks: [] },
    });
    await runtime.dispose?.();
  });

  it("publishes review.completed when the last card is rated", async () => {
    const published: ConversationEventInput[] = [];
    const host = createHost({}, published);
    const runtime = await createExtension().activate(host, {
      instanceId: "flash-cards-review-event",
      createdAt: 0,
    });
    const addDeck = runtime.tools?.find(
      (tool) => tool.definition.function.name === "addDeck",
    );
    const addCard = runtime.tools?.find(
      (tool) => tool.definition.function.name === "addCard",
    );
    const startReview = runtime.tools?.find(
      (tool) => tool.definition.function.name === "startReview",
    );
    const slot = runtime.slots?.[0];
    if (!addDeck || !addCard || !startReview || !slot) {
      throw new Error("Flash card runtime pieces were not registered");
    }

    const deckResult = await addDeck.handler(
      { name: "Spanish" },
      { extensionId: "flash-cards" },
    );
    expect(deckResult.success).toBe(true);
    const deckId = (deckResult.data as { id: string }).id;
    await addCard.handler(
      { deckId, front: "hola", back: "hello" },
      { extensionId: "flash-cards" },
    );
    await startReview.handler({ deckId }, { extensionId: "flash-cards" });

    const panel = slot.state.getState().panel;
    if (panel.type !== "cards" || panel.card.face !== "front") {
      throw new Error("Expected front review panel");
    }
    await panel.onSubmitAnswer("hello");

    const revealed = slot.state.getState().panel;
    if (revealed.type !== "cards" || revealed.card.face !== "back") {
      throw new Error("Expected revealed review panel");
    }
    const easy = revealed.actions.find((action) => action.label === "Easy");
    if (!easy) throw new Error("Easy rating action missing");
    await easy.onClick();

    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      type: "review.completed",
      turnPolicy: "start-turn",
      payload: {
        reason: "completed",
        total: 1,
        correct: 1,
        incorrect: 0,
        ratings: { again: 0, hard: 0, easy: 1 },
        omittedAttempts: 0,
      },
    });
    await runtime.dispose?.();
  });

  it("returns a record-only summary from the endReview tool", async () => {
    const published: ConversationEventInput[] = [];
    const host = createHost({}, published);
    const runtime = await createExtension().activate(host, {
      instanceId: "flash-cards-end-tool",
      createdAt: 0,
    });
    const addDeck = runtime.tools?.find(
      (tool) => tool.definition.function.name === "addDeck",
    );
    const addCard = runtime.tools?.find(
      (tool) => tool.definition.function.name === "addCard",
    );
    const startReview = runtime.tools?.find(
      (tool) => tool.definition.function.name === "startReview",
    );
    const endReview = runtime.tools?.find(
      (tool) => tool.definition.function.name === "endReview",
    );
    const slot = runtime.slots?.[0];
    if (!addDeck || !addCard || !startReview || !endReview || !slot) {
      throw new Error("Flash card runtime pieces were not registered");
    }

    const deckResult = await addDeck.handler(
      { name: "Spanish" },
      { extensionId: "flash-cards" },
    );
    const deckId = (deckResult.data as { id: string }).id;
    await addCard.handler(
      { deckId, front: "hola", back: "hello" },
      { extensionId: "flash-cards" },
    );
    await startReview.handler({ deckId }, { extensionId: "flash-cards" });

    const panel = slot.state.getState().panel;
    if (panel.type !== "cards" || panel.card.face !== "front") {
      throw new Error("Expected front review panel");
    }
    await panel.onSubmitAnswer("nope");

    const ended = await endReview.handler({}, { extensionId: "flash-cards" });
    expect(ended).toMatchObject({
      success: true,
      data: {
        reason: "ended",
        total: 1,
        correct: 0,
        incorrect: 1,
      },
    });
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      type: "review.completed",
      turnPolicy: "record-only",
    });
    await runtime.dispose?.();
  });
});

describe("FlashCardManager", () => {
  it("grades answers and advances with attempt-scoped ratings", () => {
    const manager = createManager();
    const deck = manager.addDeck("Spanish");
    manager.addCard(deck.id, "hola", "hello");
    manager.addCard(deck.id, "adios", "goodbye");

    const session = manager.startReview(deck.id);
    const attemptA = session.attemptId!;
    expect(manager.submitAnswer(attemptA, "HELLO").correct).toBe(true);
    expect(manager.getState().session.phase).toBe("revealed");

    expect(() => manager.submitAnswer(attemptA, "again")).toThrow(
      /Stale or invalid/,
    );

    expect(manager.rateCard(attemptA, "easy")).toBeNull();
    const next = manager.getState().session;
    expect(next.phase).toBe("front");
    expect(next.attemptId).not.toBe(attemptA);
    expect(next.currentIndex).toBe(1);

    expect(() => manager.rateCard(attemptA, "easy")).toThrow(
      /Stale or invalid/,
    );
  });

  it("summarizes a completed review with grades and ratings", () => {
    const manager = createManager();
    const deck = manager.addDeck("Spanish");
    manager.addCard(deck.id, "hola", "hello");
    manager.addCard(deck.id, "adios", "goodbye");
    manager.startReview(deck.id);

    const first = manager.getState().session.attemptId!;
    manager.submitAnswer(first, "hello");
    expect(manager.rateCard(first, "easy")).toBeNull();

    const second = manager.getState().session.attemptId!;
    manager.submitAnswer(second, "wrong");
    const summary = manager.rateCard(second, "hard");
    expect(summary).toMatchObject({
      reason: "completed",
      total: 2,
      correct: 1,
      incorrect: 1,
      ratings: { again: 0, hard: 1, easy: 1 },
    });
    expect(manager.getState().session.attemptId).toBeNull();
  });

  it("requeues the same card after Again with a new attemptId", () => {
    const manager = createManager(5_000);
    const deck = manager.addDeck("Solo");
    const card = manager.addCard(deck.id, "uno", "one");
    manager.startReview(deck.id);
    const firstAttempt = manager.getState().session.attemptId!;
    manager.submitAnswer(firstAttempt, "wrong");
    expect(manager.rateCard(firstAttempt, "again")).toBeNull();

    const next = manager.getState().session;
    expect(next.attemptId).not.toBeNull();
    expect(next.attemptId).not.toBe(firstAttempt);
    expect(next.phase).toBe("front");
    expect(next.currentIndex).toBe(1);
    expect(next.queue).toHaveLength(2);
    expect(manager.getCurrentCard()?.id).toBe(card.id);
    expect(manager.getDeck(deck.id)?.cards[0]?.dueAt).toBe(
      5_000 + SRS_INTERVALS_MS.again,
    );
  });

  it("resolves current cards across multiple decks", () => {
    const manager = createManager();
    const spanish = manager.addDeck("Spanish");
    const french = manager.addDeck("French");
    manager.addCard(spanish.id, "hola", "hello");
    manager.addCard(french.id, "bonjour", "hello");
    manager.startReview();
    expect(manager.getCurrentCard()?.front).toBe("hola");
    const attempt = manager.getState().session.attemptId!;
    manager.submitAnswer(attempt, "hello");
    manager.rateCard(attempt, "easy");
    expect(manager.getCurrentCard()?.front).toBe("bonjour");
  });

  it("fails activation when storage returns corrupt state", async () => {
    const host = createHost({
      storage: {
        read: async () => ({ version: 999, decks: "nope" }),
        write: async () => undefined,
        delete: async () => undefined,
        list: async () => [],
      },
    });

    await expect(
      createExtension().activate(host, {
        instanceId: "flash-cards-corrupt",
        createdAt: 0,
      }),
    ).rejects.toThrow(/corrupt|Unsupported/i);
  });

  it("serializes overlapping mutations through the extension queue", async () => {
    let releaseWrite: (() => void) | null = null;
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let writeCount = 0;

    const host = createHost({
      storage: {
        read: async () => undefined,
        write: async () => {
          writeCount += 1;
          if (writeCount === 1) await writeGate;
        },
        delete: async () => undefined,
        list: async () => [],
      },
    });

    const runtime = await createExtension().activate(host, {
      instanceId: "flash-cards-race",
      createdAt: 0,
    });
    const addDeck = runtime.tools?.find(
      (tool) => tool.definition.function.name === "addDeck",
    );
    if (!addDeck) throw new Error("addDeck missing");

    const first = addDeck.handler(
      { name: "A" },
      { extensionId: "flash-cards" },
    );
    const second = addDeck.handler(
      { name: "B" },
      { extensionId: "flash-cards" },
    );

    releaseWrite?.();
    await Promise.all([first, second]);

    const listDecks = runtime.tools?.find(
      (tool) => tool.definition.function.name === "listDecks",
    );
    const listed = await listDecks!.handler({}, { extensionId: "flash-cards" });
    expect(listed).toMatchObject({
      success: true,
      data: {
        decks: [{ name: "A" }, { name: "B" }],
      },
    });
    await runtime.dispose?.();
  });
});
