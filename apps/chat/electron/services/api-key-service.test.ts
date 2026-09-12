import { createModelProviders } from "./model-provider.js";
import { describe, expect, it } from "bun:test";
import type { StorageRepository } from "../infrastructure/storage-repository.js";
import { storageSchema } from "../infrastructure/storage-repository.js";
import { ApiKeyService, type EncryptionService } from "./api-key-service.js";

function createStorage(): StorageRepository {
  let data = storageSchema.parse({});
  return {
    filePath: "/virtual/chat-storage.json",
    read: async () => structuredClone(data),
    write: async (next) => {
      data = structuredClone(next);
    },
    update: async (mutator) => {
      const draft = structuredClone(data);
      mutator(draft);
      data = draft;
      return structuredClone(data);
    },
  };
}

const encryption: EncryptionService = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`encrypted:${value}`),
  decryptString: (value) => value.toString().replace(/^encrypted:/, ""),
};

describe("ApiKeyService", () => {
  it("stores and retrieves only encrypted API keys", async () => {
    const storage = createStorage();
    const service = new ApiKeyService(
      storage,
      encryption,
      createModelProviders(),
    );
    const key = "sk-12345678901234567890";

    expect(await service.setKey({ provider: "openai", key })).toEqual({
      success: true,
    });
    expect((await storage.read()).providerKeysEncrypted.openai).not.toContain(
      key,
    );
    expect(await service.getCredentials()).toEqual({ provider: "openai", key });
  });

  it("rejects storage when system encryption is unavailable", async () => {
    const service = new ApiKeyService(
      createStorage(),
      {
        ...encryption,
        isEncryptionAvailable: () => false,
      },
      createModelProviders(),
    );

    expect(
      await service.setKey({
        provider: "openai",
        key: "sk-12345678901234567890",
      }),
    ).toEqual({
      success: false,
      error: "Secure credential storage is unavailable on this system",
    });
    await expect(service.getCredentials()).rejects.toThrow(
      "Secure credential storage is unavailable",
    );
  });
});

it("migrates the shipped OpenAI key and keeps provider credentials isolated across switches and removal", async () => {
  const storage = createStorage();
  const openai = "sk-original-12345678901234567890";
  const grok = "xai-new-12345678901234567890";
  await storage.write(
    storageSchema.parse({
      apiKeyEncrypted: encryption.encryptString(openai).toString("base64"),
      conversation: [
        { id: "kept-message", role: "user", content: "Keep this conversation" },
      ],
    }),
  );
  const service = new ApiKeyService(
    storage,
    encryption,
    createModelProviders(),
  );
  expect(await service.getCredentials()).toEqual({
    provider: "openai",
    key: openai,
  });
  expect(await service.setKey({ provider: "grok", key: grok })).toEqual({
    success: true,
  });
  expect(await service.getCredentials()).toEqual({
    provider: "grok",
    key: grok,
  });
  const saved = await storage.read();
  expect(saved.conversation).toEqual([
    { id: "kept-message", role: "user", content: "Keep this conversation" },
  ]);
  expect(JSON.stringify(saved)).not.toContain(grok);
  expect(JSON.stringify(saved)).not.toContain(openai);
  expect(saved).not.toHaveProperty("apiKeyEncrypted");
  expect(await service.listProviders()).toMatchObject([
    { id: "openai", configured: true, selected: false },
    { id: "grok", configured: true, selected: true },
  ]);
  await service.selectProvider("openai");
  await service.clearKey("grok");
  expect(await service.getCredentials()).toEqual({
    provider: "openai",
    key: openai,
  });
  await expect(service.selectProvider("grok")).rejects.toThrow("No API key");
  expect((await storage.read()).modelProvider).toBe("openai");
  await service.clearKey();
  expect(await service.hasKey()).toBe(false);
  await expect(service.getCredentials()).rejects.toThrow("No API key");
});

it("does not resurrect a migrated key when the new provider map has a replacement", () => {
  const migrated = storageSchema.parse({
    apiKeyEncrypted: "old",
    providerKeysEncrypted: { openai: "new" },
  });
  expect(migrated.providerKeysEncrypted.openai).toBe("new");
  delete migrated.providerKeysEncrypted.openai;
  expect(
    storageSchema.parse(migrated).providerKeysEncrypted.openai,
  ).toBeUndefined();
});

it("validates keys with the selected provider and leaves configuration unchanged on failure", async () => {
  const providers = new Map(createModelProviders());
  const grok = providers.get("grok");
  if (!grok) throw new Error("Missing Grok adapter");
  const attempts: string[] = [];
  providers.set("grok", {
    ...grok,
    validateKey: async (key) => {
      attempts.push(key);
      throw new Error("401 invalid_api_key");
    },
  });
  const storage = createStorage();
  const service = new ApiKeyService(storage, encryption, providers);
  const credential = {
    provider: "grok",
    key: "xai-invalid-12345678901234567890",
  } as const;
  expect(await service.validateKey(credential)).toEqual({
    valid: false,
    error: "Invalid API key",
  });
  expect(attempts).toEqual([credential.key]);
  expect(await service.hasKey()).toBe(false);
  expect((await storage.read()).modelProvider).toBe("openai");
});
