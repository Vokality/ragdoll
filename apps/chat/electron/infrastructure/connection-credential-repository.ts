import { z } from "zod";
import {
  OAuthTokensSchema,
  OAuthClientInformationSchema,
  OAuthMetadataSchema,
  OpenIdProviderDiscoveryMetadataSchema,
  OAuthProtectedResourceMetadataSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { EncryptionService } from "./encryption-service.js";
import type { StorageRepository } from "./storage-repository.js";

export const connectionCredentialsSchema = z.strictObject({
  bearerToken: z.string().optional(),
  oauth: z
    .strictObject({
      redirectUri: z.string().url(),
      client: OAuthClientInformationSchema.optional(),
      tokens: OAuthTokensSchema.optional(),
      expiresAt: z.number().optional(),
      requireResponseIssuer: z.boolean().optional(),
      discovery: z
        .object({
          authorizationServerUrl: z.string(),
          resourceMetadataUrl: z.string().optional(),
          resourceMetadata: OAuthProtectedResourceMetadataSchema.optional(),
          authorizationServerMetadata: z
            .union([OAuthMetadataSchema, OpenIdProviderDiscoveryMetadataSchema])
            .optional(),
        })
        .optional(),
    })
    .optional(),
});
export type ConnectionCredentials = z.infer<typeof connectionCredentialsSchema>;

export class ConnectionCredentialRepository {
  constructor(
    private readonly storage: StorageRepository,
    private readonly encryption: EncryptionService,
  ) {}
  async load(id: string): Promise<ConnectionCredentials> {
    const encrypted = (await this.storage.read()).connectionCredentials[id];
    if (!encrypted) return {};
    this.requireEncryption();
    return connectionCredentialsSchema.parse(
      JSON.parse(
        this.encryption.decryptString(Buffer.from(encrypted, "base64")),
      ),
    );
  }
  async save(
    id: string,
    credentials: ConnectionCredentials,
    signal?: AbortSignal,
  ): Promise<void> {
    const encrypted = this.seal(credentials);
    await this.storage.update((draft) => {
      signal?.throwIfAborted();
      if (!draft.connections.some((connection) => connection.id === id))
        throw new Error("Connection no longer exists");
      draft.connectionCredentials[id] = encrypted;
    });
  }
  /** Prepare encryption before an atomic configuration-and-credential transaction. */
  seal(credentials: ConnectionCredentials): string {
    this.requireEncryption();
    return this.encryption
      .encryptString(
        JSON.stringify(connectionCredentialsSchema.parse(credentials)),
      )
      .toString("base64");
  }
  async clear(id: string): Promise<void> {
    await this.storage.update((draft) => {
      delete draft.connectionCredentials[id];
    });
  }
  private requireEncryption(): void {
    if (!this.encryption.isEncryptionAvailable())
      throw new Error("Secure credential storage is unavailable");
  }
}
