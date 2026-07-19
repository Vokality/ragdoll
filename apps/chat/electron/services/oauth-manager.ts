import {
  z,
  type HostOAuthCapability,
  type OAuthConfig,
  type OAuthState,
  type OAuthTokens,
} from "@vokality/ragdoll-extensions";
import type {
  OAuthCallbackResult,
  OAuthRedirectService,
  OAuthRedirectSession,
} from "./oauth-loopback-service.js";
import type { ServiceLogger } from "./service-logger.js";

const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;
const SCHEDULED_REFRESH_LEAD_MS = 5 * 60 * 1000;

const oauthTokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1).optional(),
    expires_in: z.number().positive().optional(),
    scope: z.string().optional(),
    token_type: z.string().optional(),
  })
  .passthrough();

export interface OAuthManagerConfig {
  oauthConfig: OAuthConfig;
  extensionId: string;
  getClientId: () => string;
  redirects: OAuthRedirectService;
  loadTokens: () => Promise<OAuthTokens | null>;
  saveTokens: (tokens: OAuthTokens) => Promise<void>;
  clearTokens: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  events: OAuthManagerEventSink;
  fetch: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
  logger: ServiceLogger;
}

export interface OAuthManagerEventSink {
  connected(): void;
  failed(error: string): void;
}

interface PendingAuthorization {
  session: OAuthRedirectSession;
  state: string;
  verifier: string;
}

type OAuthStateListener = (state: OAuthState) => void;

function generateRandomString(length: number): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join(
    "",
  );
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const binary = String.fromCharCode(...new Uint8Array(digest));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export class OAuthManager implements HostOAuthCapability {
  private tokens: OAuthTokens | null = null;
  private state: OAuthState = {
    status: "disconnected",
    isAuthenticated: false,
  };
  private readonly listeners = new Set<OAuthStateListener>();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshPromise: Promise<void> | null = null;
  private authorizationCompletion: Promise<void> | null = null;
  private pendingAuthorization: PendingAuthorization | null = null;
  private initialized = false;

  constructor(private readonly config: OAuthManagerConfig) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      this.tokens = await this.config.loadTokens();
      if (!this.tokens) return;

      if (!this.isExpired(this.tokens)) {
        this.setState({
          status: "connected",
          isAuthenticated: true,
          expiresAt: this.tokens.expiresAt,
          error: undefined,
        });
        this.scheduleTokenRefresh();
        return;
      }

      if (this.tokens.refreshToken) {
        await this.refreshAccessToken();
        return;
      }

      this.setState({ status: "expired", isAuthenticated: false });
    } catch (error) {
      this.fail(error);
    }
  }

  getState(): OAuthState {
    return { ...this.state };
  }

  subscribe(listener: OAuthStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async startFlow(): Promise<string> {
    const clientId = this.config.getClientId();
    if (!clientId) throw new Error("OAuth client ID is not configured");

    this.cancelPendingAuthorization();
    const session = await this.config.redirects.createSession(
      this.config.extensionId,
      this.config.oauthConfig.callbackPort,
    );
    const transaction: PendingAuthorization = {
      session,
      state: generateRandomString(64),
      verifier: generateRandomString(64),
    };
    this.pendingAuthorization = transaction;
    const completion = this.completeAuthorization(transaction).finally(() => {
      if (this.authorizationCompletion === completion) {
        this.authorizationCompletion = null;
      }
    });
    this.authorizationCompletion = completion;
    void completion.catch((error) => {
      this.log("error", "OAuth authorization completion failed", error);
    });

    let challenge: string;
    try {
      challenge = await generateCodeChallenge(transaction.verifier);
    } catch (error) {
      if (this.pendingAuthorization === transaction) {
        this.pendingAuthorization = null;
        transaction.session.close();
        this.fail(error);
      }
      throw error;
    }
    const params = new URLSearchParams({
      ...(this.config.oauthConfig.additionalAuthParams ?? {}),
      client_id: clientId,
      response_type: "code",
      redirect_uri: session.redirectUri,
      scope: this.config.oauthConfig.scopes.join(" "),
      state: transaction.state,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    const authorizationUrl = `${this.config.oauthConfig.authorizationUrl}?${params.toString()}`;

    this.setState({
      status: "connecting",
      isAuthenticated: false,
      error: undefined,
    });
    try {
      await this.config.openExternal(authorizationUrl);
      return authorizationUrl;
    } catch (error) {
      if (this.pendingAuthorization === transaction) {
        this.pendingAuthorization = null;
        transaction.session.close();
        this.fail(error);
      }
      throw error;
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.tokens?.accessToken) return null;
    if (this.isExpired(this.tokens, TOKEN_EXPIRY_SKEW_MS)) {
      if (!this.tokens.refreshToken) {
        this.setState({ status: "expired", isAuthenticated: false });
        return null;
      }
      await this.refreshAccessToken();
    }
    return this.tokens.accessToken;
  }

  async disconnect(): Promise<void> {
    this.clearRefreshTimer();
    this.cancelPendingAuthorization();
    await this.authorizationCompletion?.catch(() => undefined);
    await this.refreshPromise?.catch(() => undefined);
    this.tokens = null;
    await this.config.clearTokens();
    this.setState({
      status: "disconnected",
      isAuthenticated: false,
      expiresAt: undefined,
      error: undefined,
    });
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated && this.tokens !== null;
  }

  destroy(): void {
    this.clearRefreshTimer();
    this.cancelPendingAuthorization();
    this.listeners.clear();
  }

  private async completeAuthorization(
    transaction: PendingAuthorization,
  ): Promise<void> {
    try {
      const callback = await transaction.session.result;
      if (this.pendingAuthorization !== transaction) return;
      this.validateCallback(callback, transaction.state);
      const tokens = await this.exchangeAuthorizationCode(
        callback.code!,
        transaction.verifier,
        transaction.session.redirectUri,
      );
      if (this.pendingAuthorization !== transaction) return;
      this.tokens = tokens;
      await this.config.saveTokens(tokens);
      if (this.pendingAuthorization !== transaction) return;
      this.markConnected();
      this.log("info", "OAuth connected");
      this.pendingAuthorization = null;
      this.config.events.connected();
    } catch (error) {
      if (this.pendingAuthorization !== transaction) return;
      this.pendingAuthorization = null;
      this.fail(error);
    }
  }

  private validateCallback(
    callback: OAuthCallbackResult,
    expectedState: string,
  ): void {
    if (callback.state !== expectedState) {
      throw new Error("OAuth callback state did not match the active flow");
    }
    if (callback.error) {
      throw new Error(`OAuth authorization failed: ${callback.error}`);
    }
    if (!callback.code) {
      throw new Error("OAuth callback is missing an authorization code");
    }
  }

  private async exchangeAuthorizationCode(
    code: string,
    verifier: string,
    redirectUri: string,
  ): Promise<OAuthTokens> {
    const response = await this.requestToken({
      ...(this.config.oauthConfig.additionalTokenParams ?? {}),
      client_id: this.getClientId(),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    return this.toTokens(response);
  }

  private refreshAccessToken(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    const operation = this.performTokenRefresh().finally(() => {
      if (this.refreshPromise === operation) this.refreshPromise = null;
    });
    this.refreshPromise = operation;
    return operation;
  }

  private async performTokenRefresh(): Promise<void> {
    const currentTokens = this.tokens;
    const refreshToken = currentTokens?.refreshToken;
    if (!refreshToken) throw new Error("No OAuth refresh token is available");

    try {
      const response = await this.requestToken({
        ...(this.config.oauthConfig.additionalTokenParams ?? {}),
        client_id: this.getClientId(),
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
      this.tokens = this.toTokens(response, currentTokens);
      await this.config.saveTokens(this.tokens);
      this.markConnected();
      this.log("debug", "OAuth access token refreshed");
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }

  private async requestToken(
    parameters: Record<string, string>,
  ): Promise<z.infer<typeof oauthTokenResponseSchema>> {
    const response = await this.config.fetch(this.config.oauthConfig.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(parameters),
    });
    if (!response.ok) {
      throw new Error(
        `OAuth token request failed with status ${response.status}: ${await readOAuthError(response)}`,
      );
    }
    return oauthTokenResponseSchema.parse(await response.json());
  }

  private toTokens(
    response: z.infer<typeof oauthTokenResponseSchema>,
    previous?: OAuthTokens,
  ): OAuthTokens {
    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? previous?.refreshToken,
      expiresAt: response.expires_in
        ? Date.now() + response.expires_in * 1000
        : undefined,
      scope: response.scope ?? previous?.scope,
      tokenType: response.token_type ?? previous?.tokenType,
    };
  }

  private getClientId(): string {
    const clientId = this.config.getClientId();
    if (!clientId) throw new Error("OAuth client ID is not configured");
    return clientId;
  }

  private isExpired(tokens: OAuthTokens, skewMs = 0): boolean {
    return Boolean(tokens.expiresAt && Date.now() >= tokens.expiresAt - skewMs);
  }

  private markConnected(): void {
    this.setState({
      status: "connected",
      isAuthenticated: true,
      expiresAt: this.tokens?.expiresAt,
      error: undefined,
    });
    this.scheduleTokenRefresh();
  }

  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.setState({ status: "error", isAuthenticated: false, error: message });
    this.config.events.failed(message);
  }

  private setState(partial: Partial<OAuthState>): void {
    this.state = { ...this.state, ...partial };
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (error) {
        this.log("error", "OAuth state listener failed", error);
      }
    }
  }

  private scheduleTokenRefresh(): void {
    this.clearRefreshTimer();
    if (!this.tokens?.expiresAt || !this.tokens.refreshToken) return;

    const delay = Math.max(
      0,
      this.tokens.expiresAt - Date.now() - SCHEDULED_REFRESH_LEAD_MS,
    );
    this.refreshTimer = setTimeout(() => {
      void this.refreshAccessToken().catch((error) => {
        this.log("error", "Scheduled OAuth token refresh failed", error);
      });
    }, delay);
  }

  private clearRefreshTimer(): void {
    if (!this.refreshTimer) return;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private cancelPendingAuthorization(): void {
    const pending = this.pendingAuthorization;
    this.pendingAuthorization = null;
    pending?.session.close();
  }

  private log(
    level: "debug" | "info" | "warn" | "error",
    ...args: unknown[]
  ): void {
    this.config.logger[level](`[OAuth:${this.config.extensionId}]`, ...args);
  }
}

async function readOAuthError(response: Response): Promise<string> {
  const body = await response.text();
  if (!body) return response.statusText || "unknown error";
  try {
    const parsed = JSON.parse(body) as {
      error?: string;
      error_description?: string;
    };
    return parsed.error_description ?? parsed.error ?? "unknown error";
  } catch {
    return "provider returned a non-JSON error";
  }
}

export function createOAuthManager(config: OAuthManagerConfig): OAuthManager {
  return new OAuthManager(config);
}
