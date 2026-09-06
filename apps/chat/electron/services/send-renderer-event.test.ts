import { expect, it } from "bun:test";
import { sendRendererEvent } from "./send-renderer-event.js";
import { ChatApplicationService } from "./chat-application-service.js";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";

it("finishes and persists a streamed response after its renderer closes", async () => {
  let destroyed = false;
  const delivered: unknown[][] = [];
  const contents = {
    isDestroyed: () => destroyed,
    send: (channel: string, ...args: unknown[]) => {
      if (destroyed) throw new Error("Object has been destroyed");
      delivered.push([channel, ...args]);
    },
  };
  const storage = createInMemoryStorageRepository();
  const chat = new ChatApplicationService(
    storage,
    { getKey: async () => "key" },
    {
      runUserTurn: async (_key, _history, stream) => {
        stream("Hello");
        destroyed = true;
        stream(" there");
        return "Hello there";
      },
      runEventTurn: async () => ({ disposition: "silent" }),
    },
    (history) => sendRendererEvent(contents, "history", history),
    () => {},
  );
  expect(
    await chat.sendMessage("Hi", {
      streamingText: (text) => sendRendererEvent(contents, "text", text),
      streamEnded: () => sendRendererEvent(contents, "end"),
    }),
  ).toEqual({ success: true });
  expect(delivered).toEqual([
    ["history", [{ role: "user", content: "Hi" }]],
    ["text", "Hello"],
  ]);
  expect(await chat.getConversation()).toEqual([
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello there" },
  ]);
});

it("preserves delivery errors unrelated to renderer destruction", () => {
  const contents = {
    isDestroyed: () => false,
    send: () => {
      throw new Error("Cannot serialize event");
    },
  };
  expect(() => sendRendererEvent(contents, "event")).toThrow(
    "Cannot serialize event",
  );
});
