import { describe, expect, it } from "bun:test";
import { ExtensionMessageBus } from "./extension-message-bus.js";

describe("ExtensionMessageBus", () => {
  it("forwards owned tool topics to the host tool runner", () => {
    const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
    const bus = new ExtensionMessageBus((tool, args) => {
      calls.push({ tool, args });
    });
    const ipc = bus.forExtension("character");

    ipc.publish("extension-tool:character", {
      tool: "setMood",
      args: { mood: "smile" },
    });

    expect(calls).toEqual([{ tool: "setMood", args: { mood: "smile" } }]);
  });

  it("allows an extension to subscribe to its own prefixed topics", () => {
    const bus = new ExtensionMessageBus(() => undefined);
    const ipc = bus.forExtension("tasks");
    const received: unknown[] = [];
    const unsubscribe = ipc.subscribe("tasks:changed", (payload) => {
      received.push(payload);
    });

    ipc.publish("tasks:changed", { count: 1 });
    unsubscribe();
    ipc.publish("tasks:changed", { count: 2 });

    expect(received).toEqual([{ count: 1 }]);
  });

  it("rejects publish and subscribe on another extension's topics", () => {
    const bus = new ExtensionMessageBus(() => undefined);
    const ipc = bus.forExtension("tasks");

    expect(() => ipc.publish("pomodoro:tick", {})).toThrow(
      "cannot use IPC topic 'pomodoro:tick'",
    );
    expect(() =>
      ipc.subscribe("extension-tool:character", () => undefined),
    ).toThrow("cannot use IPC topic 'extension-tool:character'");
  });
});

it("rejects malformed tool arguments before forwarding", () => {
  const calls: unknown[] = [];
  const ipc = new ExtensionMessageBus((...args) =>
    calls.push(args),
  ).forExtension("character");
  for (const args of [null, [], "smile", 2]) {
    expect(() =>
      ipc.publish("extension-tool:character", { tool: "setMood", args }),
    ).toThrow();
  }
  expect(() =>
    ipc.publish("extension-tool:character", { tool: "", args: {} }),
  ).toThrow();
  expect(calls).toHaveLength(0);
});

it("an old unsubscribe cannot remove listeners registered after clear", () => {
  const bus = new ExtensionMessageBus(() => undefined);
  const ipc = bus.forExtension("tasks");
  const oldUnsubscribe = ipc.subscribe("tasks:changed", () => undefined);
  bus.clear();
  const received: unknown[] = [];
  ipc.subscribe("tasks:changed", (payload) => received.push(payload));
  oldUnsubscribe();
  ipc.publish("tasks:changed", 1);
  expect(received).toEqual([1]);
});
