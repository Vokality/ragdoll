import {
  OAuthTokensSchema,
  z,
  type ConfigSchema,
  type ConfigValues,
  type OAuthTokens,
} from "@vokality/ragdoll-extensions";
import type { EncryptionService } from "./encryption-service.js";
import type { StorageRepository } from "./storage-repository.js";

const configValuesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
);

export interface ExtensionHostDataStore {
  loadConfig(
    extensionId: string,
    schema: ConfigSchema,
  ): Promise<ConfigValues | null>;
  saveConfig(
    extensionId: string,
    schema: ConfigSchema,
    values: ConfigValues,
  ): Promise<void>;
  loadOAuthTokens(extensionId: string): Promise<OAuthTokens | null>;
  saveOAuthTokens(extensionId: string, tokens: OAuthTokens): Promise<void>;
  clearOAuthTokens(extensionId: string): Promise<void>;
}

export class ExtensionHostDataRepository implements ExtensionHostDataStore {
  constructor(
    private readonly storage: StorageRepository,
    private readonly encryption: EncryptionService,
  ) {}

  async loadConfig(
    extensionId: string,
    schema: ConfigSchema,
  ): Promise<ConfigValues | null> {
    const stored = (await this.storage.read()).extensionHost?.[extensionId];
    if (!stored?.configValues && !stored?.configSecretsEncrypted) return null;

    const publicValues = configValuesSchema.parse(stored.configValues ?? {});
    for (const key of Object.keys(publicValues)) {
      if (isSecretField(schema[key])) {
        throw new Error(
          `Secret configuration '${key}' for '${extensionId}' is stored in plaintext`,
        );
      }
    }

    const secretValues = stored.configSecretsEncrypted
      ? configValuesSchema.parse(
          JSON.parse(this.decrypt(stored.configSecretsEncrypted)),
        )
      : {};
    for (const key of Object.keys(secretValues)) {
      if (!isSecretField(schema[key])) {
        throw new Error(
          `Non-secret configuration '${key}' for '${extensionId}' is stored as a secret`,
        );
      }
    }
    return { ...publicValues, ...secretValues };
  }

  async saveConfig(
    extensionId: string,
    schema: ConfigSchema,
    values: ConfigValues,
  ): Promise<void> {
    const publicValues: ConfigValues = {};
    const secretValues: ConfigValues = {};
    for (const [key, value] of Object.entries(values)) {
      (isSecretField(schema[key]) ? secretValues : publicValues)[key] = value;
    }

    const encryptedSecrets =
      Object.keys(secretValues).length > 0
        ? this.encrypt(JSON.stringify(secretValues))
        : undefined;
    await this.storage.update((draft) => {
      const extensionHost = (draft.extensionHost ??= {});
      extensionHost[extensionId] = {
        ...extensionHost[extensionId],
        configValues: publicValues,
        configSecretsEncrypted: encryptedSecrets,
      };
    });
  }

  async loadOAuthTokens(extensionId: string): Promise<OAuthTokens | null> {
    const encrypted = (await this.storage.read()).extensionHost?.[extensionId]
      ?.oauthTokensEncrypted;
    if (!encrypted) return null;
    return OAuthTokensSchema.parse(JSON.parse(this.decrypt(encrypted)));
  }

  async saveOAuthTokens(
    extensionId: string,
    tokens: OAuthTokens,
  ): Promise<void> {
    const encrypted = this.encrypt(
      JSON.stringify(OAuthTokensSchema.parse(tokens)),
    );
    await this.storage.update((draft) => {
      const extensionHost = (draft.extensionHost ??= {});
      extensionHost[extensionId] = {
        ...extensionHost[extensionId],
        oauthTokensEncrypted: encrypted,
      };
    });
  }

  async clearOAuthTokens(extensionId: string): Promise<void> {
    await this.storage.update((draft) => {
      const data = draft.extensionHost?.[extensionId];
      if (data) delete data.oauthTokensEncrypted;
    });
  }

  private encrypt(value: string): string {
    if (!this.encryption.isEncryptionAvailable()) {
      throw new Error("Secure credential storage is unavailable");
    }
    return this.encryption.encryptString(value).toString("base64");
  }

  private decrypt(value: string): string {
    if (!this.encryption.isEncryptionAvailable()) {
      throw new Error("Secure credential storage is unavailable");
    }
    return this.encryption.decryptString(Buffer.from(value, "base64"));
  }
}

function isSecretField(field: ConfigSchema[string] | undefined): boolean {
  return Boolean(field && "secret" in field && field.secret);
}
