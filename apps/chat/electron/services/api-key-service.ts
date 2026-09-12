import type {
  ModelProviderId,
  ModelProviderInfo,
  ProviderKey,
} from "../domain/model-provider.js";
import type { ModelProvider } from "./model-provider.js";
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
    private readonly providers: ReadonlyMap<ModelProviderId, ModelProvider>,
  ) {}

  async hasKey(): Promise<boolean> {
    const data = await this.storage.read();
    return Boolean(data.providerKeysEncrypted[data.modelProvider]);
  }

  async setKey({ provider, key }: ProviderKey): Promise<OperationResult> {
    if (!this.providers.has(provider) || key.trim().length < 20) {
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
      draft.providerKeysEncrypted[provider] = encrypted;
      draft.modelProvider = provider;
    });
    return { success: true };
  }

  async getCredentials(): Promise<ProviderKey> {
    if (!this.encryption.isEncryptionAvailable()) {
      throw new Error("Secure credential storage is unavailable");
    }
    const data = await this.storage.read();
    const encrypted = data.providerKeysEncrypted[data.modelProvider];
    if (!encrypted) throw new Error("No API key configured");
    return {
      provider: data.modelProvider,
      key: this.encryption.decryptString(Buffer.from(encrypted, "base64")),
    };
  }

  async clearKey(provider?: ModelProviderId): Promise<OperationResult> {
    await this.storage.update((draft) => {
      delete draft.providerKeysEncrypted[provider ?? draft.modelProvider];
    });
    return { success: true };
  }

  provider(id: ModelProviderId): ModelProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unsupported model provider: ${id}`);
    return provider;
  }

  async listProviders(): Promise<ModelProviderInfo[]> {
    const data = await this.storage.read();
    return [...this.providers.values()].map(({ info }) => ({
      ...info,
      configured: Boolean(data.providerKeysEncrypted[info.id]),
      selected: info.id === data.modelProvider,
    }));
  }

  async selectProvider(id: ModelProviderId): Promise<OperationResult> {
    this.provider(id);
    await this.storage.update((draft) => {
      if (!draft.providerKeysEncrypted[id])
        throw new Error("No API key configured for this provider");
      draft.modelProvider = id;
    });
    return { success: true };
  }

  async validateKey({
    provider,
    key,
  }: ProviderKey): Promise<ApiKeyValidationResult> {
    if (!this.providers.has(provider) || key.trim().length < 20) {
      return { valid: false, error: "Invalid API key format" };
    }
    try {
      await this.provider(provider).validateKey(key);
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
