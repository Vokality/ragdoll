import { describe, expect, it } from "bun:test";
import type { ConfigSchema } from "@vokality/ragdoll-extensions";
import type { EncryptionService } from "./encryption-service.js";
import { ExtensionHostDataRepository } from "./extension-host-data-repository.js";
import type { StorageData, StorageRepository } from "./storage-repository.js";

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

const schema: ConfigSchema = {
  clientId: { type: "string", label: "Client ID", required: true },
  clientSecret: {
    type: "string",
    label: "Client secret",
    required: true,
    secret: true,
  },
};

describe("ExtensionHostDataRepository", () => {
  it("keeps tokens and secret configuration out of plaintext storage", async () => {
    const storage = createStorage();
    const repository = new ExtensionHostDataRepository(storage, encryption);

    await repository.saveConfig("example", schema, {
      clientId: "public-client",
      clientSecret: "private-secret",
    });
    await repository.saveOAuthTokens("example", {
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    const serialized = JSON.stringify(await storage.read());
    expect(serialized).toContain("public-client");
    expect(serialized).not.toContain("private-secret");
    expect(serialized).not.toContain("access-token");
    expect(serialized).not.toContain("refresh-token");
    expect(await repository.loadConfig("example", schema)).toEqual({
      clientId: "public-client",
      clientSecret: "private-secret",
    });
    expect(await repository.loadOAuthTokens("example")).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });

  it("fails closed when secure storage is unavailable", async () => {
    const repository = new ExtensionHostDataRepository(createStorage(), {
      ...encryption,
      isEncryptionAvailable: () => false,
    });

    await expect(
      repository.saveOAuthTokens("example", { accessToken: "token" }),
    ).rejects.toThrow("Secure credential storage is unavailable");
    await expect(
      repository.saveConfig("example", schema, {
        clientId: "public-client",
        clientSecret: "secret",
      }),
    ).rejects.toThrow("Secure credential storage is unavailable");
  });
});
