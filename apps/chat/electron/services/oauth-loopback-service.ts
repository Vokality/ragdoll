import { createServer, type Server } from "node:http";
import type { HostTimersCapability } from "@vokality/ragdoll-extensions";

const LOOPBACK_HOST = "127.0.0.1";

export interface OAuthCallbackResult {
  code: string | null;
  error: string | null;
  state: string | null;
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

  constructor(
    private readonly callbackTimeoutMs: number,
    private readonly timers: HostTimersCapability,
  ) {}

  async createSession(
    extensionId: string,
    callbackPort?: number,
  ): Promise<OAuthRedirectSession> {
    const callbackPath = `/oauth/callback/${encodeURIComponent(extensionId)}`;
    let settle:
      | {
          resolve: (value: OAuthCallbackResult) => void;
          reject: (reason: Error) => void;
        }
      | undefined;
    const result = new Promise<OAuthCallbackResult>((resolve, reject) => {
      settle = { resolve, reject };
    });

    let completed = false;
    const server = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? "/", `http://${LOOPBACK_HOST}`);
      if (request.method !== "GET" || requestUrl.pathname !== callbackPath) {
        response.writeHead(404).end();
        return;
      }

      response
        .writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        })
        .end(
          "<!doctype html><html><body><p>Authentication complete. You can close this window.</p></body></html>",
        );
      completed = true;
      settle?.resolve({
        code: requestUrl.searchParams.get("code"),
        error: requestUrl.searchParams.get("error"),
        state: requestUrl.searchParams.get("state"),
      });
      this.closeServer(server);
    });
    this.servers.set(server, () => {
      if (!completed) {
        completed = true;
        settle?.reject(new Error("OAuth callback service was stopped"));
      }
      if (server.listening) server.close();
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(callbackPort ?? 0, LOOPBACK_HOST);
    }).catch((error: unknown) => {
      this.closeServer(server);
      throw error;
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      this.closeServer(server);
      throw new Error("OAuth callback listener did not bind to a TCP port");
    }

    const timeout = this.timers.setTimeout(() => {
      if (completed) return;
      completed = true;
      settle?.reject(new Error("OAuth authorization timed out"));
      this.closeServer(server);
    }, this.callbackTimeoutMs);
    result
      .finally(() => this.timers.clearTimeout(timeout))
      .catch(() => undefined);

    return {
      redirectUri: `http://${LOOPBACK_HOST}:${address.port}${callbackPath}`,
      result,
      close: () => {
        if (!completed) {
          completed = true;
          settle?.reject(new Error("OAuth authorization was cancelled"));
        }
        this.closeServer(server);
      },
    };
  }

  destroy(): void {
    for (const cancel of this.servers.values()) cancel();
    this.servers.clear();
  }

  private closeServer(server: Server): void {
    this.servers.delete(server);
    if (server.listening) server.close();
  }
}
