import { describe, expect, it } from "bun:test";
import type {
  StorageData,
  StorageRepository,
} from "../infrastructure/storage-repository.js";
import { ApiKeyService, type EncryptionService } from "./api-key-service.js";

function createStorage(): StorageRepository {
  let data: StorageData = {};
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
    const service = new ApiKeyService(storage, encryption);
    const key = "sk-12345678901234567890";

    expect(await service.setKey(key)).toEqual({ success: true });
    expect((await storage.read()).apiKeyEncrypted).not.toContain(key);
    expect(await service.getKey()).toBe(key);
  });

  it("rejects storage when system encryption is unavailable", async () => {
    const service = new ApiKeyService(createStorage(), {
      ...encryption,
      isEncryptionAvailable: () => false,
    });

    expect(await service.setKey("sk-12345678901234567890")).toEqual({
      success: false,
      error: "Secure credential storage is unavailable on this system",
    });
    await expect(service.getKey()).rejects.toThrow(
      "Secure credential storage is unavailable",
    );
  });
});
