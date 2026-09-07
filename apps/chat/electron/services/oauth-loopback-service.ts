import { createServer, type Server } from "node:http";
import type { HostTimersCapability } from "@vokality/ragdoll-extensions";

const LOOPBACK_HOST = "127.0.0.1";

export interface OAuthCallbackResult {
  code: string | null;
  error: string | null;
  state: string | null;
  issuer?: string | null;
}

export interface OAuthRedirectSession {
  redirectUri: string;
  result: Promise<OAuthCallbackResult>;
  close(): void;
}

export interface OAuthRedirectService {
  createSession(
    extensionId: string,
    callbackPort?: number,
  ): Promise<OAuthRedirectSession>;
  destroy(): void;
}

export class OAuthLoopbackService implements OAuthRedirectService {
  private readonly servers = new Map<Server, () => void>();
  private stopped = false;

  constructor(
    private readonly callbackTimeoutMs: number,
    private readonly timers: HostTimersCapability,
  ) {}

  async createSession(
    extensionId: string,
    callbackPort?: number,
  ): Promise<OAuthRedirectSession> {
    if (this.stopped) throw new Error("OAuth callback service was stopped");
    const callbackPath = `/oauth/callback/${encodeURIComponent(extensionId)}`;
    const callback = Promise.withResolvers<OAuthCallbackResult>();
    const listening = Promise.withResolvers<void>();
    // Startup can fail before a caller receives the session and its result.
    // Observe rejection immediately while preserving it for the eventual caller.
    void callback.promise.catch(() => undefined);
    void listening.promise.catch(() => undefined);
    const abort = new AbortController();
    let completed = false;
    let timeout: unknown;

    const server = createServer((request, response) => {
      let requestUrl: URL;
      try {
        requestUrl = new URL(request.url ?? "/", `http://${LOOPBACK_HOST}`);
      } catch {
        response.writeHead(400).end();
        return;
      }
      if (
        completed ||
        request.method !== "GET" ||
        requestUrl.pathname !== callbackPath
      ) {
        response.writeHead(404).end();
        return;
      }

      response
        .writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          Connection: "close",
        })
        .end(
          "<!doctype html><html><body><p>Authentication complete. You can close this window.</p></body></html>",
        );
      completed = true;
      callback.resolve({
        code: requestUrl.searchParams.get("code"),
        error: requestUrl.searchParams.get("error"),
        state: requestUrl.searchParams.get("state"),
        ...(requestUrl.searchParams.has("iss")
          ? { issuer: requestUrl.searchParams.get("iss") }
          : {}),
      });
      this.timers.clearTimeout(timeout);
      // Let the callback page finish sending before closing its connection.
      server.close();
    });

    const cancel = (error: Error): void => {
      if (!completed) {
        completed = true;
        callback.reject(error);
      }
      listening.reject(error);
      this.timers.clearTimeout(timeout);
      abort.abort();
      server.closeAllConnections();
      this.servers.delete(server);
    };
    this.servers.set(server, () =>
      cancel(new Error("OAuth callback service was stopped")),
    );
    server.once("close", () => this.servers.delete(server));
    server.on("error", cancel);
    server.once("listening", listening.resolve);

    try {
      server.listen({
        port: callbackPort ?? 0,
        host: LOOPBACK_HOST,
        signal: abort.signal,
      });
      await listening.promise;
      if (this.stopped) throw new Error("OAuth callback service was stopped");
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("OAuth callback listener did not bind to a TCP port");
      }
      timeout = this.timers.setTimeout(() => {
        cancel(new Error("OAuth authorization timed out"));
      }, this.callbackTimeoutMs);
      return {
        redirectUri: `http://${LOOPBACK_HOST}:${address.port}${callbackPath}`,
        result: callback.promise,
        close: () => cancel(new Error("OAuth authorization was cancelled")),
      };
    } catch (error) {
      cancel(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  destroy(): void {
    this.stopped = true;
    for (const cancel of this.servers.values()) cancel();
    this.servers.clear();
  }
}
