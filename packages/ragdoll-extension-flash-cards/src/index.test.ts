import { describe, expect, it } from "bun:test";
import {
  createRegistry,
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

const REQUIRED_CAPABILITIES = ["storage", "logger"];

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

    expect(descriptor?.requiredCapabilities).toEqual(REQUIRED_CAPABILITIES);
    expect(createExtension().manifest.requiredCapabilities).toEqual(
      REQUIRED_CAPABILITIES,
    );
    expect(descriptor?.optionalCapabilities).toEqual([]);
    expect(createExtension().manifest.optionalCapabilities).toEqual([]);
    expect(descriptor?.capabilities).toEqual(["tools", "slots"]);
  });

  it("loads its initial state from required host storage", async () => {
    const reads: Array<{ extensionId: string; key: string }> = [];
    const host: ExtensionHostEnvironment = {
      capabilities: new Set<ExtensionHostCapability>(REQUIRED_CAPABILITIES),
      storage: {
        read: async (extensionId, key) => {
          reads.push({ extensionId, key });
          return undefined;
        },
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
    };
    const registry = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });

    await registry.register(createExtension(), { host });

    expect(reads).toEqual([{ extensionId: "flash-cards", key: "state" }]);
    await registry.destroy();
  });

  it("rolls a mutation back when required storage rejects the commit", async () => {
    const host: ExtensionHostEnvironment = {
      capabilities: new Set<ExtensionHostCapability>(REQUIRED_CAPABILITIES),
      storage: {
        read: async () => undefined,
        write: async () => {
          throw new Error("storage unavailable");
        },
        delete: async () => undefined,
        list: async () => [],
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    };
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

    manager.rateCard(attemptA, "easy");
    const next = manager.getState().session;
    expect(next.phase).toBe("front");
    expect(next.attemptId).not.toBe(attemptA);
    expect(next.currentIndex).toBe(1);

    expect(() => manager.rateCard(attemptA, "easy")).toThrow(
      /Stale or invalid/,
    );
  });

  it("requeues the same card after Again with a new attemptId", () => {
    const manager = createManager(5_000);
    const deck = manager.addDeck("Solo");
    const card = manager.addCard(deck.id, "uno", "one");
    manager.startReview(deck.id);
    const firstAttempt = manager.getState().session.attemptId!;
    manager.submitAnswer(firstAttempt, "wrong");
    manager.rateCard(firstAttempt, "again");

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
    const host: ExtensionHostEnvironment = {
      capabilities: new Set<ExtensionHostCapability>(REQUIRED_CAPABILITIES),
      storage: {
        read: async () => ({ version: 999, decks: "nope" }),
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
    };

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

    const host: ExtensionHostEnvironment = {
      capabilities: new Set<ExtensionHostCapability>(REQUIRED_CAPABILITIES),
      storage: {
        read: async () => undefined,
        write: async () => {
          writeCount += 1;
          if (writeCount === 1) await writeGate;
        },
        delete: async () => undefined,
        list: async () => [],
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    };

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
