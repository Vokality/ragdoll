import { describe, expect, it } from "bun:test";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import { ConnectionCredentialRepository } from "../infrastructure/connection-credential-repository.js";
import { ConnectionService } from "./connection-service.js";
import type { McpConnectionFactory } from "./mcp-connection-client.js";
import { ConnectionToolService } from "./connection-tool-service.js";
import { connectionSaveSchema } from "../electron-api.js";

function setup(
  factory: McpConnectionFactory = {
    connect: async () => ({
      tools: [{ name: "read", inputSchema: { type: "object" } }],
      call: async () => ({ content: [{ type: "text", text: "done" }] }),
      close: async () => {},
    }),
  },
) {
  const storage = createInMemoryStorageRepository();
  const credentials = new ConnectionCredentialRepository(storage, {
    isEncryptionAvailable: () => true,
    encryptString: (text) => Buffer.from(text.split("").reverse().join("")),
    decryptString: (buffer) => buffer.toString().split("").reverse().join(""),
  });
  return {
    storage,
    credentials,
    factory,
    service: new ConnectionService(storage, credentials, factory, () => {}),
  };
}
const config = {
  name: "Workspace",
  serverUrl: "https://mcp.example.com/mcp",
  authentication: { type: "bearer" as const },
  bearerToken: "private-access-token",
};

describe("connections", () => {
  it("keeps credentials encrypted and out of public settings; connect and agent access are separate", async () => {
    const { storage, service, credentials } = setup();
    const saved = await service.save(config);
    expect(JSON.stringify(storage.snapshot())).not.toContain(
      config.bearerToken,
    );
    expect(JSON.stringify(service.list())).not.toContain("Token");
    expect((await credentials.load(saved.id)).bearerToken).toBe(
      config.bearerToken,
    );
    expect(saved.status).toBe("disconnected");
    expect(saved.enabled).toBe(false);
    await service.connect(saved.id);
    expect(service.list()[0]?.status).toBe("connected");
    expect(() => service.tools(saved.id)).toThrow("not available");
    await service.setEnabled(saved.id, true);
    expect(service.tools(saved.id)).toHaveLength(1);
    await service.setEnabled(saved.id, false);
    expect(() => service.tools(saved.id)).toThrow("not available");
    expect((await credentials.load(saved.id)).bearerToken).toBe(
      config.bearerToken,
    );
    await service.disconnect(saved.id);
    expect(await credentials.load(saved.id)).toEqual({});
    await service.destroy();
  });
  it("clears credentials when the resource changes and preserves them on a rename", async () => {
    const { service, credentials } = setup();
    const saved = await service.save(config);
    await service.save({
      id: saved.id,
      name: "Renamed",
      serverUrl: config.serverUrl,
      authentication: config.authentication,
    });
    expect((await credentials.load(saved.id)).bearerToken).toBe(
      config.bearerToken,
    );
    await service.save({
      id: saved.id,
      name: "Renamed",
      serverUrl: "https://different.example/mcp",
      authentication: config.authentication,
    });
    expect(await credentials.load(saved.id)).toEqual({});
    await service.remove(saved.id);
    expect(service.list()).toEqual([]);
  });
  it("cancels an in-progress login before remove and cannot resurrect it", async () => {
    const started = Promise.withResolvers<void>();
    const { service, storage } = setup({
      connect: async (_record, _interactive, signal) => {
        started.resolve();
        await new Promise<void>((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        );
        throw new Error("unreachable");
      },
    });
    const saved = await service.save(config);
    const connecting = service.connect(saved.id);
    await started.promise;
    expect(service.list()[0]?.status).toBe("connecting");
    await service.remove(saved.id);
    expect((await connecting).success).toBe(false);
    expect(service.list()).toEqual([]);
    expect(storage.snapshot().connectionCredentials).toEqual({});
  });
  it("reconnects enabled connections on startup without blocking or opening a browser", async () => {
    const attempts: boolean[] = [];
    const factory: McpConnectionFactory = {
      connect: async (_record, interactive) => {
        attempts.push(interactive);
        throw new Error("remote failure with PRIVATE_HEADER");
      },
    };
    const { service, storage, credentials } = setup(factory);
    const saved = await service.save(config);
    await service.setEnabled(saved.id, true);
    await service.destroy();
    const restored = new ConnectionService(
      storage,
      credentials,
      factory,
      () => {},
    );
    await restored.initialize();
    await Bun.sleep(0);
    expect(attempts).toEqual([false, false]);
    expect(restored.list()[0]?.status).toBe("error");
    expect(JSON.stringify(restored.list())).not.toContain("PRIVATE_HEADER");
    await restored.destroy();
  });
  it("routes actual remote results through host tools and rejects calls after disable", async () => {
    const { service } = setup();
    const saved = await service.save(config);
    await service.setEnabled(saved.id, true);
    const tools = new ConnectionToolService(
      {
        getTools: () => [],
        getToolsForExtension: () => [],
        executeTool: async () => ({ success: false, error: "unknown" }),
      },
      service,
    );
    const args = { connectionId: saved.id, toolName: "read", arguments: {} };
    const result = await tools.executeTool("lumen_call_connection_tool", args);
    expect(result).toMatchObject({
      success: true,
      data: { content: [{ text: "done" }] },
    });
    await service.setEnabled(saved.id, false);
    expect(
      (await tools.executeTool("lumen_call_connection_tool", args)).success,
    ).toBe(false);
    await service.destroy();
  });
  it("validates remote addresses and rejects misplaced credentials", () => {
    for (const serverUrl of [
      "http://public.example/mcp",
      "https://token@host/mcp",
      "https://host/mcp?token=secret",
      "file:///tmp/server",
    ]) {
      expect(
        connectionSaveSchema.safeParse({ ...config, serverUrl }).success,
      ).toBe(false);
    }
    expect(
      connectionSaveSchema.safeParse({
        ...config,
        authentication: { type: "none" },
      }).success,
    ).toBe(false);
  });
});

it("a cancelled credential write cannot restore tokens after disconnect", async () => {
  const { service, credentials } = setup();
  const saved = await service.save(config);
  const controller = new AbortController();
  controller.abort();
  await service.disconnect(saved.id);
  await expect(
    credentials.save(
      saved.id,
      { bearerToken: "late-refresh" },
      controller.signal,
    ),
  ).rejects.toThrow();
  expect(await credentials.load(saved.id)).toEqual({});
});

it("credential encryption failure does not create a partial saved connection", async () => {
  const storage = createInMemoryStorageRepository();
  const credentials = new ConnectionCredentialRepository(storage, {
    isEncryptionAvailable: () => false,
    encryptString: () => {
      throw new Error("unavailable");
    },
    decryptString: () => {
      throw new Error("unavailable");
    },
  });
  const service = new ConnectionService(
    storage,
    credentials,
    setup().factory,
    () => {},
  );
  await expect(service.save(config)).rejects.toThrow(
    "Secure credential storage",
  );
  expect(service.list()).toEqual([]);
  expect(storage.snapshot().connections).toEqual([]);
});
