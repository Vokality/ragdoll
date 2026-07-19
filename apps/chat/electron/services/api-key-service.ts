import OpenAI from "openai";
import type {
  ApiKeyValidationResult,
  OperationResult,
} from "../electron-api.js";
import type { StorageRepository } from "../infrastructure/storage-repository.js";
import type { EncryptionService } from "../infrastructure/encryption-service.js";

export type { EncryptionService } from "../infrastructure/encryption-service.js";

export class ApiKeyService {
  constructor(
    private readonly storage: StorageRepository,
    private readonly encryption: EncryptionService,
  ) {}

  async hasKey(): Promise<boolean> {
    return Boolean((await this.storage.read()).apiKeyEncrypted);
  }

  async setKey(key: string): Promise<OperationResult> {
    if (!key.startsWith("sk-") || key.length < 20) {
      return { success: false, error: "Invalid API key format" };
    }
    if (!this.encryption.isEncryptionAvailable()) {
      return {
        success: false,
        error: "Secure credential storage is unavailable on this system",
      };
    }

    const encrypted = this.encryption.encryptString(key).toString("base64");
    await this.storage.update((draft) => {
      draft.apiKeyEncrypted = encrypted;
    });
    return { success: true };
  }

  async getKey(): Promise<string> {
    if (!this.encryption.isEncryptionAvailable()) {
      throw new Error("Secure credential storage is unavailable");
    }
    const encrypted = (await this.storage.read()).apiKeyEncrypted;
    if (!encrypted) throw new Error("No API key configured");
    return this.encryption.decryptString(Buffer.from(encrypted, "base64"));
  }

  async clearKey(): Promise<OperationResult> {
    await this.storage.update((draft) => {
      delete draft.apiKeyEncrypted;
    });
    return { success: true };
  }

  async validateKey(key: string): Promise<ApiKeyValidationResult> {
    if (!key.startsWith("sk-") || key.length < 20) {
      return { valid: false, error: "Invalid API key format" };
    }
    try {
      await new OpenAI({ apiKey: key }).models.list();
      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("401") || message.includes("invalid_api_key")) {
        return { valid: false, error: "Invalid API key" };
      }
      if (message.includes("429")) {
        return { valid: false, error: "Rate limited. Please try again later." };
      }
      return { valid: false, error: message };
    }
  }
}
