import { checkResourceAllowed } from "@modelcontextprotocol/sdk/shared/auth-utils.js";
import { z } from "zod";
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import { randomBytes } from "node:crypto";
import {
  auth,
  UnauthorizedError,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { ConnectionRecord } from "../electron-api.js";
import type {
  ConnectionCredentialRepository,
  ConnectionCredentials,
} from "../infrastructure/connection-credential-repository.js";
import type {
  OAuthRedirectService,
  OAuthRedirectSession,
} from "./oauth-loopback-service.js";

export class ConnectionOAuthError extends Error {}

export class ConnectionAuthorizationRequired extends Error {
  constructor() {
    super("Sign in from Settings to authorize this connection");
  }
}

/** One provider per connection session. PKCE/state remain in memory; tokens are encrypted. */
export class ConnectionOAuthProvider implements OAuthClientProvider {
  private verifier: string | undefined;
  private readonly nonce = randomBytes(32).toString("base64url");
  private session: OAuthRedirectSession | undefined;
  private allowBrowser = false;
  private refreshing: Promise<void> | undefined;
  private constructor(
    private readonly connection: ConnectionRecord,
    private credentials: ConnectionCredentials,
    private readonly store: ConnectionCredentialRepository,
    private readonly openExternal: (url: string) => Promise<void>,
    private readonly request: FetchLike,
    private readonly signal: AbortSignal,
    private readonly issuerRequirement: (issuer: string) => boolean | undefined,
  ) {}

  static async create(
    connection: ConnectionRecord,
    store: ConnectionCredentialRepository,
    redirects: OAuthRedirectService,
    openExternal: (url: string) => Promise<void>,
    request: FetchLike,
    interactive: boolean,
    signal: AbortSignal,
    issuerRequirement: (issuer: string) => boolean | undefined,
  ): Promise<ConnectionOAuthProvider> {
    const credentials = await store.load(connection.id);
    const provider = new ConnectionOAuthProvider(
      connection,
      credentials,
      store,
      openExternal,
      request,
      signal,
      issuerRequirement,
    );
    if (interactive) {
      const configuredPort =
        connection.authentication.type === "oauth"
          ? connection.authentication.callbackPort
          : undefined;
      const previousPort = credentials.oauth
        ? Number(new URL(credentials.oauth.redirectUri).port)
        : undefined;
      provider.session = await redirects.createSession(
        connection.id,
        configuredPort ?? previousPort,
      );
      provider.allowBrowser = true;
      credentials.oauth = {
        ...credentials.oauth,
        redirectUri: provider.session.redirectUri,
      };
    }
    return provider;
  }
  get redirectUrl(): string {
    if (!this.credentials.oauth) throw new ConnectionAuthorizationRequired();
    return this.credentials.oauth.redirectUri;
  }
  get clientMetadataUrl(): string | undefined {
    return this.connection.authentication.type === "oauth"
      ? this.connection.authentication.clientMetadataUrl
      : undefined;
  }
  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "Lumen",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }
  state(): string {
    return this.nonce;
  }
  clientInformation(): OAuthClientInformationMixed | undefined {
    const configured = this.connection.authentication;
    return configured.type === "oauth" && configured.clientId
      ? { client_id: configured.clientId }
      : this.credentials.oauth?.client;
  }
  async saveClientInformation(
    client: OAuthClientInformationMixed,
  ): Promise<void> {
    if (client.client_secret)
      throw new ConnectionOAuthError(
        "This provider requires a confidential client; Lumen uses desktop public clients",
      );
    await this.update({ client });
  }
  tokens(): OAuthTokens | undefined {
    return this.credentials.oauth?.tokens;
  }
  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const previous = this.credentials.oauth?.tokens;
    await this.update({
      tokens: {
        ...tokens,
        refresh_token: tokens.refresh_token ?? previous?.refresh_token,
        scope: tokens.scope ?? previous?.scope,
      },
      expiresAt:
        tokens.expires_in === undefined
          ? undefined
          : Date.now() + tokens.expires_in * 1000,
    });
  }
  saveCodeVerifier(verifier: string): void {
    this.verifier = verifier;
  }
  codeVerifier(): string {
    if (!this.verifier)
      throw new ConnectionOAuthError("OAuth transaction has expired");
    return this.verifier;
  }
  async redirectToAuthorization(url: URL): Promise<void> {
    if (!this.allowBrowser || !this.session)
      throw new ConnectionAuthorizationRequired();
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      )
    )
      throw new ConnectionOAuthError(
        "The provider login endpoint must use HTTPS",
      );
    await this.openExternal(url.href);
  }
  discoveryState(): OAuthDiscoveryState | undefined {
    return this.credentials.oauth?.discovery;
  }
  async saveDiscoveryState(discovery: OAuthDiscoveryState): Promise<void> {
    const metadata = discovery.authorizationServerMetadata;
    if (!metadata || metadata.issuer !== discovery.authorizationServerUrl)
      throw new ConnectionOAuthError(
        "OAuth discovery issuer does not match its authorization server",
      );
    if (!metadata.code_challenge_methods_supported?.includes("S256"))
      throw new ConnectionOAuthError(
        "The provider must support OAuth PKCE S256",
      );
    const previousIssuer =
      this.credentials.oauth?.discovery?.authorizationServerMetadata?.issuer;
    if (previousIssuer && previousIssuer !== metadata.issuer)
      throw new ConnectionOAuthError(
        "OAuth issuer changed; disconnect and reconnect to authorize the new provider",
      );
    await this.update({
      discovery,
      requireResponseIssuer:
        this.issuerRequirement(metadata.issuer) ??
        z
          .object({
            authorization_response_iss_parameter_supported: z
              .boolean()
              .optional(),
          })
          .parse(metadata).authorization_response_iss_parameter_supported ??
        this.credentials.oauth?.requireResponseIssuer ??
        false,
    });
  }
  async validateResourceURL(
    server: string | URL,
    resource?: string,
  ): Promise<URL> {
    const expected = new URL(server);
    if (
      resource &&
      !checkResourceAllowed({
        requestedResource: expected,
        configuredResource: resource,
      })
    )
      throw new ConnectionOAuthError(
        "OAuth resource does not match the MCP server",
      );
    return new URL(resource ?? expected.href);
  }
  async invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier" | "discovery",
  ): Promise<void> {
    if (scope === "verifier") {
      this.verifier = undefined;
      return;
    }
    if (scope === "all") {
      await this.update({
        client: undefined,
        tokens: undefined,
        expiresAt: undefined,
        discovery: undefined,
      });
    } else if (scope === "tokens")
      await this.update({ tokens: undefined, expiresAt: undefined });
    else if (scope === "client") await this.update({ client: undefined });
    else await this.update({ discovery: undefined });
  }
  async finishAuthorization(): Promise<void> {
    if (!this.session) throw new ConnectionAuthorizationRequired();
    const callback = await this.session.result;
    if (callback.state !== this.nonce)
      throw new ConnectionOAuthError("OAuth state mismatch");
    if (callback.error)
      throw new ConnectionOAuthError("Provider authorization was denied");
    if (!callback.code)
      throw new ConnectionOAuthError(
        "Provider did not return an authorization code",
      );
    const metadata = this.discoveryState()?.authorizationServerMetadata;
    if (!metadata) throw new ConnectionOAuthError("OAuth discovery is missing");
    if (
      (this.credentials.oauth?.requireResponseIssuer === true &&
        !callback.issuer) ||
      (callback.issuer && callback.issuer !== metadata.issuer)
    )
      throw new ConnectionOAuthError("OAuth callback issuer mismatch");
    const result = await auth(this, {
      serverUrl: this.connection.serverUrl,
      authorizationCode: callback.code,
      fetchFn: this.request,
    });
    if (result !== "AUTHORIZED") throw new UnauthorizedError();
    this.endInteractive();
  }
  async ensureFresh(): Promise<void> {
    const expiresAt = this.credentials.oauth?.expiresAt;
    if (
      !this.tokens() ||
      expiresAt === undefined ||
      expiresAt > Date.now() + 60_000
    )
      return;
    if (!this.refreshing) {
      this.refreshing = (async () => {
        if (!this.tokens()?.refresh_token)
          throw new ConnectionAuthorizationRequired();
        const result = await auth(this, {
          serverUrl: this.connection.serverUrl,
          fetchFn: this.request,
        });
        if (result !== "AUTHORIZED")
          throw new ConnectionAuthorizationRequired();
      })().finally(() => {
        this.refreshing = undefined;
      });
    }
    await this.refreshing;
  }
  endInteractive(): void {
    this.allowBrowser = false;
    this.verifier = undefined;
    this.session?.close();
    this.session = undefined;
  }
  private async update(
    update: Partial<NonNullable<ConnectionCredentials["oauth"]>>,
  ): Promise<void> {
    this.credentials = {
      ...this.credentials,
      oauth: {
        ...this.credentials.oauth,
        redirectUri: this.redirectUrl,
        ...update,
      },
    };
    await this.store.save(this.connection.id, this.credentials, this.signal);
  }
}
