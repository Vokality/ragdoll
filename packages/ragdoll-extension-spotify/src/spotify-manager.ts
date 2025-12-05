/**
 * Spotify Manager - Handles OAuth PKCE flow, token management, and Spotify Web API calls.
 *
 * This manager runs in the main process (Node.js) and handles:
 * - OAuth PKCE authorization flow (no client secret needed)
 * - Token refresh
 * - REST API calls (search, playback control)
 * - Providing access tokens to the renderer for Web Playback SDK
 */

import crypto from "crypto";
import type {
  SpotifyTokens,
  SpotifyState,
  SpotifyPlaybackState,
  SpotifyTrack,
  SpotifyArtist,
  SpotifyAlbum,
  SpotifySearchResults,
  SpotifyEvent,
  SpotifyEventCallback,
} from "./types.js";

// Re-import constants (can't import const from type-only imports)
const EMPTY_PLAYBACK: SpotifyPlaybackState = {
  isPlaying: false,
  track: null,
  progressMs: 0,
  device: null,
  shuffleState: false,
  repeatState: "off",
  timestamp: Date.now(),
};

const INITIAL_STATE: SpotifyState = {
  connectionStatus: "disconnected",
  playback: EMPTY_PLAYBACK,
  error: null,
  isAuthenticated: false,
};

// =============================================================================
// Configuration
// =============================================================================

export interface SpotifyManagerConfig {
  /** Spotify Client ID (from Spotify Developer Dashboard) */
  clientId: string;
  /** Redirect URI for OAuth (e.g., "lumen://spotify-callback") */
  redirectUri: string;
  /** Scopes to request (defaults to playback + user read) */
  scopes?: string[];
  /** Initial tokens if already authenticated */
  initialTokens?: SpotifyTokens;
  /** Callback when state changes */
  onStateChange?: SpotifyEventCallback;
}

const DEFAULT_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
];

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

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hashed = sha256(verifier);
  return base64UrlEncode(hashed);
}

// =============================================================================
// Spotify Manager Class
// =============================================================================

export class SpotifyManager {
  private config: SpotifyManagerConfig;
  private tokens: SpotifyTokens | null = null;
  private state: SpotifyState;
  private listeners: Set<SpotifyEventCallback> = new Set();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  // PKCE state
  private codeVerifier: string | null = null;

  constructor(config: SpotifyManagerConfig) {
    this.config = {
      ...config,
      scopes: config.scopes ?? DEFAULT_SCOPES,
    };
    this.state = { ...INITIAL_STATE };

    if (config.initialTokens) {
      this.tokens = config.initialTokens;
      this.state.isAuthenticated = true;
      this.state.connectionStatus = "connected";
      this.scheduleTokenRefresh();
    }

    if (config.onStateChange) {
      this.listeners.add(config.onStateChange);
    }
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  getState(): SpotifyState {
    return { ...this.state };
  }

  private setState(partial: Partial<SpotifyState>): void {
    this.state = { ...this.state, ...partial };
    this.emitEvent("spotify:playback-changed");
  }

  private emitEvent(type: SpotifyEvent["type"]): void {
    const event: SpotifyEvent = {
      type,
      state: this.getState(),
      timestamp: Date.now(),
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[SpotifyManager] Error in listener:", error);
      }
    }
  }

  onStateChange(callback: SpotifyEventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // ===========================================================================
  // OAuth PKCE Flow
  // ===========================================================================

  /**
   * Get the OAuth authorization URL with PKCE challenge.
   * Returns both the URL and stores the code verifier internally.
   */
  async getAuthorizationUrl(state?: string): Promise<string> {
    // Generate PKCE code verifier and challenge
    this.codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(this.codeVerifier);

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      scope: (this.config.scopes ?? DEFAULT_SCOPES).join(" "),
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      ...(state && { state }),
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens using PKCE.
   */
  async exchangeCode(code: string): Promise<SpotifyTokens> {
    if (!this.codeVerifier) {
      throw new Error("No code verifier available. Call getAuthorizationUrl first.");
    }

    this.setState({ connectionStatus: "connecting" });

    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          grant_type: "authorization_code",
          code,
          redirect_uri: this.config.redirectUri,
          code_verifier: this.codeVerifier,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const data = await response.json();

      this.tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope,
      };

      // Clear the code verifier after successful exchange
      this.codeVerifier = null;

      this.setState({
        connectionStatus: "connected",
        isAuthenticated: true,
        error: null,
      });

      this.scheduleTokenRefresh();
      this.emitEvent("spotify:connected");

      return this.tokens;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.setState({
        connectionStatus: "error",
        error: message,
        isAuthenticated: false,
      });
      this.emitEvent("spotify:error");
      throw error;
    }
  }

  /**
   * Refresh the access token using the refresh token.
   * PKCE refresh doesn't require client secret.
   */
  async refreshAccessToken(): Promise<SpotifyTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          grant_type: "refresh_token",
          refresh_token: this.tokens.refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      const data = await response.json();

      this.tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? this.tokens.refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope ?? this.tokens.scope,
      };

      this.scheduleTokenRefresh();
      this.emitEvent("spotify:token-refreshed");

      return this.tokens;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.setState({
        connectionStatus: "error",
        error: message,
      });
      this.emitEvent("spotify:error");
      throw error;
    }
  }

  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.tokens) return;

    // Refresh 5 minutes before expiry
    const refreshIn = this.tokens.expiresAt - Date.now() - 5 * 60 * 1000;

    if (refreshIn > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshAccessToken().catch((error) => {
          console.error("[SpotifyManager] Auto-refresh failed:", error);
        });
      }, refreshIn);
    }
  }

  // ===========================================================================
  // Token Access (for Web Playback SDK in renderer)
  // ===========================================================================

  /**
   * Get the current access token for the Web Playback SDK.
   * Returns null if not authenticated.
   */
  getAccessToken(): string | null {
    if (!this.tokens) return null;

    // Check if token is expired or about to expire
    if (Date.now() >= this.tokens.expiresAt - 60 * 1000) {
      // Token expired or expiring soon - trigger refresh
      this.refreshAccessToken().catch(console.error);
      return null;
    }

    return this.tokens.accessToken;
  }

  /**
   * Get tokens for persistence.
   */
  getTokens(): SpotifyTokens | null {
    return this.tokens ? { ...this.tokens } : null;
  }

  /**
   * Load tokens (e.g., from storage on startup).
   */
  loadTokens(tokens: SpotifyTokens): void {
    this.tokens = tokens;

    // Check if tokens are still valid
    if (Date.now() < tokens.expiresAt) {
      this.setState({
        connectionStatus: "connected",
        isAuthenticated: true,
        error: null,
      });
      this.scheduleTokenRefresh();
      this.emitEvent("spotify:connected");
    } else {
      // Tokens expired, try to refresh
      this.refreshAccessToken().catch((error) => {
        console.error("[SpotifyManager] Failed to refresh expired tokens:", error);
        this.setState({
          connectionStatus: "disconnected",
          isAuthenticated: false,
        });
      });
    }
  }

  /**
   * Check if authenticated.
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated && this.tokens !== null;
  }

  // ===========================================================================
  // Playback State (from Web Playback SDK)
  // ===========================================================================

  /**
   * Update playback state from Web Playback SDK events.
   * Called by the renderer via IPC when SDK state changes.
   */
  updatePlaybackState(playback: SpotifyPlaybackState): void {
    this.setState({ playback });
  }

  /**
   * Clear playback state (e.g., when SDK disconnects).
   */
  clearPlaybackState(): void {
    this.setState({ playback: EMPTY_PLAYBACK });
  }

  // ===========================================================================
  // Spotify Web API - Playback Control
  // ===========================================================================

  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.tokens?.accessToken) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.tokens.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token expired, try to refresh and retry
      await this.refreshAccessToken();
      return this.apiRequest(endpoint, options);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Spotify API error: ${response.status} - ${error}`);
    }

    // Some endpoints return no content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Start or resume playback.
   */
  async play(options: {
    uri?: string;
    deviceId?: string;
    positionMs?: number;
  } = {}): Promise<void> {
    const { uri, deviceId, positionMs } = options;

    const params = deviceId ? `?device_id=${deviceId}` : "";
    const body: Record<string, unknown> = {};

    if (uri) {
      if (uri.includes(":track:")) {
        body.uris = [uri];
      } else {
        body.context_uri = uri;
      }
    }

    if (positionMs !== undefined) {
      body.position_ms = positionMs;
    }

    await this.apiRequest(`/me/player/play${params}`, {
      method: "PUT",
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Pause playback.
   */
  async pause(deviceId?: string): Promise<void> {
    const params = deviceId ? `?device_id=${deviceId}` : "";
    await this.apiRequest(`/me/player/pause${params}`, {
      method: "PUT",
    });
  }

  /**
   * Skip to next track.
   */
  async skipToNext(deviceId?: string): Promise<void> {
    const params = deviceId ? `?device_id=${deviceId}` : "";
    await this.apiRequest(`/me/player/next${params}`, {
      method: "POST",
    });
  }

  /**
   * Skip to previous track.
   */
  async skipToPrevious(deviceId?: string): Promise<void> {
    const params = deviceId ? `?device_id=${deviceId}` : "";
    await this.apiRequest(`/me/player/previous${params}`, {
      method: "POST",
    });
  }

  /**
   * Get current playback state from API (fallback when SDK not available).
   */
  async getPlaybackState(): Promise<SpotifyPlaybackState> {
    try {
      const data = await this.apiRequest<{
        is_playing: boolean;
        item: SpotifyApiTrack | null;
        progress_ms: number;
        device: SpotifyApiDevice | null;
        shuffle_state: boolean;
        repeat_state: "off" | "track" | "context";
      } | null>("/me/player");

      if (!data) {
        return EMPTY_PLAYBACK;
      }

      const playback: SpotifyPlaybackState = {
        isPlaying: data.is_playing,
        track: data.item ? this.mapTrackResponse(data.item) : null,
        progressMs: data.progress_ms ?? 0,
        device: data.device
          ? {
              id: data.device.id,
              name: data.device.name,
              type: data.device.type,
              isActive: data.device.is_active,
              volumePercent: data.device.volume_percent,
            }
          : null,
        shuffleState: data.shuffle_state,
        repeatState: data.repeat_state,
        timestamp: Date.now(),
      };

      this.setState({ playback });
      return playback;
    } catch (error) {
      console.error("[SpotifyManager] Failed to get playback state:", error);
      return EMPTY_PLAYBACK;
    }
  }

  // ===========================================================================
  // Spotify Web API - Search
  // ===========================================================================

  /**
   * Search for tracks, albums, artists, or playlists.
   */
  async search(
    query: string,
    types: Array<"track" | "album" | "artist" | "playlist"> = ["track"],
    limit = 5
  ): Promise<SpotifySearchResults> {
    const params = new URLSearchParams({
      q: query,
      type: types.join(","),
      limit: limit.toString(),
    });

    const data = await this.apiRequest<SpotifyApiSearchResponse>(
      `/search?${params.toString()}`
    );

    return {
      tracks: data.tracks?.items.map((t) => this.mapTrackResponse(t)) ?? [],
      albums: data.albums?.items.map((a) => this.mapAlbumResponse(a)) ?? [],
      artists: data.artists?.items.map((a) => this.mapArtistResponse(a)) ?? [],
      playlists: data.playlists?.items.map((p) => this.mapPlaylistResponse(p)) ?? [],
    };
  }

  // ===========================================================================
  // Response Mapping
  // ===========================================================================

  private mapTrackResponse = (track: SpotifyApiTrack): SpotifyTrack => {
    return {
      id: track.id,
      name: track.name,
      uri: track.uri,
      durationMs: track.duration_ms,
      artists: track.artists.map((a) => this.mapArtistResponse(a)),
      album: this.mapAlbumResponse(track.album),
      artworkUrl: this.getPrimaryImage(track.album.images),
    };
  };

  private mapArtistResponse = (artist: SpotifyApiArtist): SpotifyArtist => {
    return {
      id: artist.id,
      name: artist.name,
      uri: artist.uri,
    };
  };

  private mapAlbumResponse = (album: SpotifyApiAlbum): SpotifyAlbum => {
    return {
      id: album.id,
      name: album.name,
      uri: album.uri,
      images: album.images.map((img) => ({
        url: img.url,
        height: img.height,
        width: img.width,
      })),
    };
  };

  private mapPlaylistResponse = (playlist: SpotifyApiPlaylist) => {
    return {
      id: playlist.id,
      name: playlist.name,
      uri: playlist.uri,
      description: playlist.description,
      images: playlist.images.map((img) => ({
        url: img.url,
        height: img.height,
        width: img.width,
      })),
      owner: {
        id: playlist.owner.id,
        displayName: playlist.owner.display_name,
      },
      tracksTotal: playlist.tracks.total,
    };
  };

  private getPrimaryImage(images: SpotifyApiImage[]): string | null {
    if (!images || images.length === 0) return null;
    // Prefer medium-sized image (300x300 ish)
    const medium = images.find((img) => img.width && img.width >= 200 && img.width <= 400);
    return medium?.url ?? images[0]?.url ?? null;
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Disconnect and clean up.
   */
  disconnect(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.tokens = null;
    this.codeVerifier = null;
    this.setState({
      connectionStatus: "disconnected",
      isAuthenticated: false,
      playback: EMPTY_PLAYBACK,
      error: null,
    });

    this.emitEvent("spotify:disconnected");
  }

  /**
   * Destroy the manager.
   */
  destroy(): void {
    this.disconnect();
    this.listeners.clear();
  }
}

// =============================================================================
// Spotify API Response Types (internal)
// =============================================================================

interface SpotifyApiImage {
  url: string;
  height: number | null;
  width: number | null;
}

interface SpotifyApiArtist {
  id: string;
  name: string;
  uri: string;
}

interface SpotifyApiAlbum {
  id: string;
  name: string;
  uri: string;
  images: SpotifyApiImage[];
}

interface SpotifyApiTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: SpotifyApiArtist[];
  album: SpotifyApiAlbum;
}

interface SpotifyApiDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

interface SpotifyApiPlaylist {
  id: string;
  name: string;
  uri: string;
  description: string | null;
  images: SpotifyApiImage[];
  owner: {
    id: string;
    display_name: string | null;
  };
  tracks: {
    total: number;
  };
}

interface SpotifyApiSearchResponse {
  tracks?: { items: SpotifyApiTrack[] };
  albums?: { items: SpotifyApiAlbum[] };
  artists?: { items: SpotifyApiArtist[] };
  playlists?: { items: SpotifyApiPlaylist[] };
}

// =============================================================================
// Factory Function
// =============================================================================

export function createSpotifyManager(config: SpotifyManagerConfig): SpotifyManager {
  return new SpotifyManager(config);
}
