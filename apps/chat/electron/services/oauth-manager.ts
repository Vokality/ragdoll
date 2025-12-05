/**
 * Generic OAuth Manager - Handles OAuth PKCE flows for any provider.
 *
 * This manager runs in the Electron main process and provides:
 * - OAuth PKCE authorization flow (no client secrets needed)
 * - Token storage and refresh
 * - Generic interface for any OAuth provider
 *
 * Extensions declare their OAuth requirements in package.json, and
 * this manager handles the flow automatically.
 */

import crypto from "crypto";
import type {
  OAuthConfig,
  OAuthTokens,
  OAuthState,
  HostOAuthCapability,
} from "@vokality/ragdoll-extensions/core";

// =============================================================================
// Types
// =============================================================================

export interface OAuthManagerConfig {
  /** OAuth configuration from extension package.json */
  oauthConfig: OAuthConfig;
  /** Extension ID (for storage keys) */
  extensionId: string;
  /** Client ID getter - called dynamically to get current clientId */
  getClientId: () => string;
  /** Redirect URI for OAuth callback */
  redirectUri: string;
  /** Load tokens from storage */
  loadTokens: () => Promise<OAuthTokens | null>;
  /** Save tokens to storage */
  saveTokens: (tokens: OAuthTokens) => Promise<void>;
  /** Clear tokens from storage */
  clearTokens: () => Promise<void>;
  /** Open URL in system browser */
  openExternal: (url: string) => Promise<void>;
  /** Logger */
  logger?: {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

type OAuthStateListener = (state: OAuthState) => void;

// =============================================================================
// PKCE Helpers
// =============================================================================

function generateRandomString(length: number): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.randomBytes(length);
  return Array.from(values)
    .map((x) => possible[x % possible.length])
    .join("");
}

function sha256(plain: string): Buffer {
  return crypto.createHash("sha256").update(plain).digest();
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateCodeChallenge(verifier: string): string {
  const hashed = sha256(verifier);
  return base64UrlEncode(hashed);
}

// =============================================================================
// OAuth Manager
// =============================================================================

export class OAuthManager implements HostOAuthCapability {
  private config: OAuthManagerConfig;
  private tokens: OAuthTokens | null = null;
  private state: OAuthState;
  private listeners: Set<OAuthStateListener> = new Set();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private codeVerifier: string | null = null;
  private initialized = false;

  constructor(config: OAuthManagerConfig) {
    this.config = config;
    this.state = {
      status: "disconnected",
      isAuthenticated: false,
    };
  }

  /**
   * Initialize the manager - load existing tokens from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const tokens = await this.config.loadTokens();
      if (tokens) {
        this.tokens = tokens;

        // Check if tokens are still valid
        if (tokens.expiresAt && Date.now() < tokens.expiresAt) {
          this.setState({
            status: "connected",
            isAuthenticated: true,
            expiresAt: tokens.expiresAt,
          });
          this.scheduleTokenRefresh();
        } else if (tokens.refreshToken) {
          // Tokens expired, try to refresh
          await this.refreshAccessToken();
        } else {
          // No refresh token, need to re-auth
          this.setState({
            status: "expired",
            isAuthenticated: false,
          });
        }
      }
    } catch (error) {
      this.log("error", "Failed to initialize OAuth:", error);
    }

    this.initialized = true;
  }

  // ===========================================================================
  // HostOAuthCapability Implementation
  // ===========================================================================

  getState(): OAuthState {
    return { ...this.state };
  }

  subscribe(listener: OAuthStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async startFlow(): Promise<string> {
    // Generate PKCE code verifier and challenge
    this.codeVerifier = generateRandomString(64);

    const oauthConfig = this.config.oauthConfig;
    const usePkce = oauthConfig.pkce !== false; // Default to true

    const clientId = this.config.getClientId();
    if (!clientId) {
      throw new Error("Client ID is not configured");
    }

    const params: Record<string, string> = {
      client_id: clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      scope: oauthConfig.scopes.join(" "),
      state: this.config.extensionId, // Use extension ID as state for routing
      ...(oauthConfig.additionalAuthParams ?? {}),
    };

    if (usePkce) {
      const codeChallenge = generateCodeChallenge(this.codeVerifier);
      params.code_challenge_method = "S256";
      params.code_challenge = codeChallenge;
    }

    const authUrl = `${oauthConfig.authorizationUrl}?${new URLSearchParams(params).toString()}`;

    this.setState({ status: "connecting", isAuthenticated: false });

    // Open in system browser
    await this.config.openExternal(authUrl);

    return authUrl;
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.tokens?.accessToken) {
      return null;
    }

    // Check if token is expired or about to expire (within 60 seconds)
    if (this.tokens.expiresAt && Date.now() >= this.tokens.expiresAt - 60 * 1000) {
      // Try to refresh
      if (this.tokens.refreshToken) {
        try {
          await this.refreshAccessToken();
        } catch (error) {
          this.log("error", "Failed to refresh token:", error);
          return null;
        }
      } else {
        return null;
      }
    }

    return this.tokens.accessToken;
  }

  async getTokens(): Promise<OAuthTokens | null> {
    return this.tokens ? { ...this.tokens } : null;
  }

  async disconnect(): Promise<void> {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.tokens = null;
    this.codeVerifier = null;

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

  // ===========================================================================
  // OAuth Flow Handling
  // ===========================================================================

  /**
   * Handle OAuth callback - exchange code for tokens.
   * Called by the ExtensionManager when a callback is received.
   */
  async handleCallback(code: string): Promise<void> {
    if (!this.codeVerifier) {
      throw new Error("No code verifier available. Call startFlow first.");
    }

    const oauthConfig = this.config.oauthConfig;
    const usePkce = oauthConfig.pkce !== false;

    try {
      const body: Record<string, string> = {
        client_id: this.config.getClientId(),
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
        ...(oauthConfig.additionalTokenParams ?? {}),
      };

      if (usePkce) {
        body.code_verifier = this.codeVerifier;
      }

      const response = await fetch(oauthConfig.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const data = await response.json();

      this.tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        scope: data.scope,
        tokenType: data.token_type,
      };

      // Clear the code verifier after successful exchange
      this.codeVerifier = null;

      // Save tokens
      await this.config.saveTokens(this.tokens);

      this.setState({
        status: "connected",
        isAuthenticated: true,
        expiresAt: this.tokens.expiresAt,
        error: undefined,
      });

      this.scheduleTokenRefresh();

      this.log("info", `OAuth connected for ${this.config.extensionId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.setState({
        status: "error",
        isAuthenticated: false,
        error: message,
      });
      throw error;
    }
  }

  /**
   * Refresh the access token using the refresh token.
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new Error("No refresh token available");
    }

    const oauthConfig = this.config.oauthConfig;

    try {
      const body: Record<string, string> = {
        client_id: this.config.getClientId(),
        grant_type: "refresh_token",
        refresh_token: this.tokens.refreshToken,
      };

      const response = await fetch(oauthConfig.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      const data = await response.json();

      this.tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? this.tokens.refreshToken,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        scope: data.scope ?? this.tokens.scope,
        tokenType: data.token_type ?? this.tokens.tokenType,
      };

      // Save updated tokens
      await this.config.saveTokens(this.tokens);

      this.setState({
        status: "connected",
        isAuthenticated: true,
        expiresAt: this.tokens.expiresAt,
        error: undefined,
      });

      this.scheduleTokenRefresh();

      this.log("debug", `Token refreshed for ${this.config.extensionId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.setState({
        status: "error",
        isAuthenticated: false,
        error: message,
      });
      throw error;
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private setState(partial: Partial<OAuthState>): void {
    this.state = { ...this.state, ...partial };
    this.emitState();
  }

  private emitState(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (error) {
        this.log("error", "Error in OAuth state listener:", error);
      }
    }
  }

  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!this.tokens?.expiresAt || !this.tokens.refreshToken) {
      return;
    }

    // Refresh 5 minutes before expiry
    const refreshIn = this.tokens.expiresAt - Date.now() - 5 * 60 * 1000;

    if (refreshIn > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshAccessToken().catch((error) => {
          this.log("error", "Auto-refresh failed:", error);
        });
      }, refreshIn);
    }
  }

  private log(level: "debug" | "info" | "warn" | "error", ...args: unknown[]): void {
    const logger = this.config.logger;
    if (logger) {
      logger[level](`[OAuth:${this.config.extensionId}]`, ...args);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.listeners.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createOAuthManager(config: OAuthManagerConfig): OAuthManager {
  return new OAuthManager(config);
}
