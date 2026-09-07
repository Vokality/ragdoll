import { expect, it } from "bun:test";
import type { IpcMain } from "electron";
import { IpcRegistrar } from "./registrar.js";
import { registerConnectionIpc } from "./register-connection-ipc.js";
import { ConnectionService } from "../services/connection-service.js";
import { ConnectionCredentialRepository } from "../infrastructure/connection-credential-repository.js";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import { IPC_CHANNELS } from "../electron-api.js";

it("connection IPC rejects unknown payloads and unauthorized renderer requests", async () => {
  const handlers = new Map<string, Parameters<IpcMain["handle"]>[1]>();
  let authorized = true;
  const registrar = new IpcRegistrar(
    {
      handle: (channel, handler) => {
        handlers.set(channel, handler);
      },
      removeHandler: (channel) => {
        handlers.delete(channel);
      },
    },
    () => authorized,
  );
  const storage = createInMemoryStorageRepository();
  const credentials = new ConnectionCredentialRepository(storage, {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value),
    decryptString: (value) => value.toString(),
  });
  const service = new ConnectionService(
    storage,
    credentials,
    {
      connect: async () => {
        throw new Error("Not used");
      },
    },
    () => {},
  );
  registerConnectionIpc(registrar, service);
  const invoke = (channel: string, ...args: unknown[]): unknown => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error("Missing handler");
    return Reflect.apply(handler, undefined, [undefined, ...args]);
  };
  const input = {
    name: "Public",
    serverUrl: "https://example.com/mcp",
    authentication: { type: "none" },
  };
  await expect(
    Promise.resolve(
      invoke(IPC_CHANNELS.connections.save, { ...input, enabled: true }),
    ),
  ).rejects.toThrow();
  await invoke(IPC_CHANNELS.connections.save, input);
  const id = service.list()[0]?.id;
  await expect(
    Promise.resolve(invoke(IPC_CHANNELS.connections.setEnabled, id, "true")),
  ).rejects.toThrow();
  expect(service.list()[0]?.enabled).toBe(false);
  authorized = false;
  expect(() => invoke(IPC_CHANNELS.connections.remove, id)).toThrow(
    "Unauthorized",
  );
  expect(service.list()).toHaveLength(1);
  authorized = true;
  await invoke(IPC_CHANNELS.connections.remove, id);
  expect(service.list()).toEqual([]);
  await registrar.dispose();
  expect(handlers.size).toBe(0);
});
