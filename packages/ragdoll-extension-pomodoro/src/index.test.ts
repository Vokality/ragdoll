import { afterEach, describe, expect, it, jest } from "bun:test";
import type {
  ConversationEventInput,
  ExtensionHostEnvironment,
} from "@vokality/ragdoll-extensions";
import {
  createExtensionPackageDescriptor,
  parseExtensionPackageJson,
} from "@vokality/ragdoll-extensions/loader";
import packageJson from "../package.json" with { type: "json" };
import { createExtension } from "./index.js";

afterEach(() => {
  jest.useRealTimers();
});

describe("Pomodoro conversation events", () => {
  it("publishes a self-contained manifest with notifications optional", () => {
    const descriptor = createExtensionPackageDescriptor(
      parseExtensionPackageJson(JSON.stringify(packageJson)),
    );

    expect(descriptor?.requiredCapabilities).toEqual([
      "conversationEvents",
      "logger",
      "timers",
    ]);
    expect(createExtension().manifest.requiredCapabilities).toEqual([
      "conversationEvents",
      "logger",
      "timers",
    ]);
    expect(descriptor?.optionalCapabilities).toEqual(["notifications"]);
    expect(createExtension().manifest.optionalCapabilities).toEqual([
      "notifications",
    ]);
  });

  it("publishes focus and break completion as start-turn events", async () => {
    jest.useFakeTimers({ now: 1_000 });
    const published: ConversationEventInput[] = [];
    const host: ExtensionHostEnvironment = {
      capabilities: new Set(["conversationEvents", "logger", "timers"]),
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
      timers: {
        setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
        clearTimeout: (handle) =>
          clearTimeout(handle as ReturnType<typeof setTimeout>),
        setInterval: (callback, intervalMs) =>
          setInterval(callback, intervalMs),
        clearInterval: (handle) =>
          clearInterval(handle as ReturnType<typeof setInterval>),
      },
    };
    const extension = createExtension();
    const runtime = await extension.activate(host, {
      instanceId: "pomodoro-test",
      createdAt: Date.now(),
    });
    const start = runtime.tools?.find(
      (tool) => tool.definition.function.name === "startPomodoro",
    );
    if (!start) throw new Error("startPomodoro tool was not registered");

    await start.handler(
      { sessionDuration: 5, breakDuration: 5 },
      { extensionId: "pomodoro" },
    );
    jest.advanceTimersByTime(5 * 60 * 1_000);
    await Promise.resolve();
    jest.advanceTimersByTime(5 * 60 * 1_000);
    await Promise.resolve();

    expect(published).toHaveLength(2);
    expect(published[0]).toMatchObject({
      type: "timer.completed",
      payload: { completedPhase: "focus", nextPhase: "break" },
      turnPolicy: "start-turn",
    });
    expect(published[1]).toMatchObject({
      type: "timer.completed",
      payload: { completedPhase: "break", nextPhase: "focus" },
      turnPolicy: "start-turn",
    });
    expect(published[0]?.deduplicationKey).not.toBe(
      published[1]?.deduplicationKey,
    );

    await runtime.dispose?.();
  });
});
