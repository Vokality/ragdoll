import { expect, it } from "bun:test";
import type { IpcMain } from "electron";
import { IpcRegistrar } from "./registrar.js";

function createTransport() {
  const handlers = new Map<string, Parameters<IpcMain["handle"]>[1]>();
  const ipc: Pick<IpcMain, "handle" | "removeHandler"> = {
    handle(channel, handler) {
      if (handlers.has(channel)) throw new Error("Duplicate handler");
      handlers.set(channel, handler);
    },
    removeHandler(channel) {
      handlers.delete(channel);
    },
  };
  function capture(channel: string): () => unknown {
    const handler = handlers.get(channel);
    if (!handler) throw new Error("Missing handler");
    // Emulate Electron's invocation boundary; these handlers do not inspect
    // an event, so the transport supplies no BrowserWindow-backed event.
    return () => Reflect.apply(handler, undefined, [undefined]);
  }
  return { ipc, handlers, capture };
}

it("removes handlers immediately and waits for operations already admitted", async () => {
  const transport = createTransport();
  const registrar = new IpcRegistrar(transport.ipc, () => true);
  const save = Promise.withResolvers<string>();
  registrar.handle("save", () => save.promise);
  const invoke = transport.capture("save");
  const result = invoke();
  let drained = false;
  const cleanup = registrar.dispose().then(() => {
    drained = true;
  });
  expect(transport.handlers.size).toBe(0);
  expect(() => invoke()).toThrow("disposed");
  expect(() => registrar.handle("late", () => undefined)).toThrow("disposed");
  await Promise.resolve();
  expect(drained).toBe(false);
  save.resolve("saved");
  expect(await result).toBe("saved");
  await cleanup;
  expect(drained).toBe(true);
  await registrar.dispose();
});

it("a failed operation reaches its caller without poisoning cleanup", async () => {
  const transport = createTransport();
  const registrar = new IpcRegistrar(transport.ipc, () => true);
  const save = Promise.withResolvers<void>();
  registrar.handle("save", () => save.promise);
  const result = transport.capture("save")();
  const cleanup = registrar.dispose();
  save.reject(new Error("Save failed"));
  await expect(result).rejects.toThrow("Save failed");
  await cleanup;
});

it("rejects unauthorized requests before starting an operation", async () => {
  const transport = createTransport();
  const registrar = new IpcRegistrar(transport.ipc, () => false);
  let calls = 0;
  registrar.handle("save", () => {
    calls += 1;
  });
  expect(transport.capture("save")).toThrow("Unauthorized");
  expect(calls).toBe(0);
  await registrar.dispose();
});
