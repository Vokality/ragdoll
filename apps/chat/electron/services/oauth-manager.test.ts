import { describe, expect, it } from "bun:test";
import type { OAuthTokens } from "@vokality/ragdoll-extensions";
import { OAuthManager } from "./oauth-manager.js";
import type {
  OAuthManagerConfig,
  OAuthManagerEventSink,
} from "./oauth-manager.js";
import { createHostTimersCapability } from "./host-timers-capability.js";
import type {
  OAuthCallbackResult,
  OAuthRedirectService,
} from "./oauth-loopback-service.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createRedirectService(
  callback: ReturnType<typeof deferred<OAuthCallbackResult>>,
  onCreate?: (callbackPort: number | undefined) => void,
) {
  return {
    createSession: async (_extensionId: string, callbackPort?: number) => {
      onCreate?.(callbackPort);
      return {
        redirectUri: "http://127.0.0.1:43123/oauth/callback/example",
        result: callback.promise,
        close: () => callback.reject(new Error("cancelled")),
      };
    },
    destroy: () => undefined,
  } satisfies OAuthRedirectService;
}

const oauthConfig = {
  provider: "example",
  authorizationUrl: "https://accounts.example.com/authorize",
  tokenUrl: "https://accounts.example.com/token",
  scopes: ["playback"],
  clientIdConfigKey: "clientId",
  callbackPort: 43821,
  pkce: true as const,
};

const noOpEvents: OAuthManagerEventSink = {
  connected: () => undefined,
  failed: () => undefined,
};

const noOpLogger: OAuthManagerConfig["logger"] = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const timing = {
  timers: createHostTimersCapability(),
  now: Date.now,
};

describe("OAuthManager", () => {
  it("rejects a callback with the wrong one-use state before token exchange", async () => {
    const callback = deferred<OAuthCallbackResult>();
    let tokenRequests = 0;
    let openedUrl = "";
    let requestedCallbackPort: number | undefined;
    const manager = new OAuthManager({
      extensionId: "example",
      oauthConfig,
      getClientId: () => "client-id",
      redirects: createRedirectService(callback, (callbackPort) => {
        requestedCallbackPort = callbackPort;
      }),
      loadTokens: async () => null,
      saveTokens: async () => undefined,
      clearTokens: async () => undefined,
      openExternal: async (url) => {
        openedUrl = url;
      },
      events: noOpEvents,
      logger: noOpLogger,
      fetch: async () => {
        tokenRequests += 1;
        return new Response();
      },
      ...timing,
    });

    await manager.startFlow();
    expect(requestedCallbackPort).toBe(43821);
    const authorization = new URL(openedUrl);
    expect(authorization.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    expect(authorization.searchParams.get("state")?.length).toBe(64);

    callback.resolve({ code: "code", error: null, state: "wrong-state" });
    await Bun.sleep(0);

    expect(tokenRequests).toBe(0);
    expect(manager.getState()).toMatchObject({
      status: "error",
      isAuthenticated: false,
      error: "OAuth callback state did not match the active flow",
    });
  });

  it("exchanges a valid PKCE callback and keeps refresh tokens host-owned", async () => {
    const callback = deferred<OAuthCallbackResult>();
    let openedUrl = "";
    let saved: OAuthTokens | null = null;
    const manager = new OAuthManager({
      extensionId: "example",
      oauthConfig,
      getClientId: () => "client-id",
      redirects: createRedirectService(callback),
      loadTokens: async () => null,
      saveTokens: async (tokens) => {
        saved = tokens;
      },
      clearTokens: async () => undefined,
      openExternal: async (url) => {
        openedUrl = url;
      },
      events: noOpEvents,
      logger: noOpLogger,
      fetch: async (_url, request) => {
        const body = new URLSearchParams(String(request?.body));
        expect(body.get("code_verifier")?.length).toBe(64);
        expect(body.get("redirect_uri")).toBe(
          "http://127.0.0.1:43123/oauth/callback/example",
        );
        return Response.json({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
        });
      },
      ...timing,
    });

    await manager.startFlow();
    const state = new URL(openedUrl).searchParams.get("state");
    callback.resolve({ code: "authorization-code", error: null, state });
    await Bun.sleep(0);

    expect(saved).toMatchObject({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(await manager.getAccessToken()).toBe("access-token");
    expect(manager.getState()).toMatchObject({
      status: "connected",
      isAuthenticated: true,
    });
    manager.destroy();
  });

  it("coalesces concurrent refresh requests", async () => {
    const refreshResponse = deferred<Response>();
    let requests = 0;
    const manager = new OAuthManager({
      extensionId: "example",
      oauthConfig,
      getClientId: () => "client-id",
      redirects: {
        createSession: async () => {
          throw new Error("not expected");
        },
        destroy: () => undefined,
      },
      loadTokens: async () => ({
        accessToken: "expiring",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 30_000,
      }),
      saveTokens: async () => undefined,
      clearTokens: async () => undefined,
      openExternal: async () => undefined,
      events: noOpEvents,
      logger: noOpLogger,
      fetch: async () => {
        requests += 1;
        return refreshResponse.promise;
      },
      ...timing,
    });
    await manager.initialize();

    const first = manager.getAccessToken();
    const second = manager.getAccessToken();
    expect(requests).toBe(1);
    refreshResponse.resolve(
      Response.json({ access_token: "fresh", expires_in: 3600 }),
    );

    expect(await Promise.all([first, second])).toEqual(["fresh", "fresh"]);
    expect(requests).toBe(1);
    manager.destroy();
  });
});

function createLifecycleFixture(overrides: Partial<OAuthManagerConfig> = {}) {
  const clock = { now: 0 };
  const activeTimers = new Map<symbol, () => void>();
  const delays: number[] = [];
  const saved: OAuthTokens[] = [];
  const failures: string[] = [];
  const manager = new OAuthManager({
    extensionId: "example",
    oauthConfig,
    getClientId: () => "client-id",
    redirects: {
      createSession: async () => {
        throw new Error("Unexpected authorization");
      },
      destroy() {},
    },
    loadTokens: async () => ({
      accessToken: "old",
      refreshToken: "refresh",
      expiresAt: 120_000,
    }),
    saveTokens: async (tokens) => {
      saved.push(tokens);
    },
    clearTokens: async () => {},
    openExternal: async () => {},
    events: {
      connected() {},
      failed(error) {
        failures.push(error);
      },
    },
    logger: noOpLogger,
    fetch: async () => {
      throw new Error("Unexpected token request");
    },
    now: () => clock.now,
    timers: {
      setTimeout(callback, delay) {
        const handle = Symbol();
        activeTimers.set(handle, callback);
        delays.push(delay);
        return handle;
      },
      clearTimeout(handle) {
        if (typeof handle === "symbol") activeTimers.delete(handle);
      },
      setInterval() {
        throw new Error("Unexpected interval");
      },
      clearInterval() {},
    },
    ...overrides,
  });
  return { manager, clock, activeTimers, delays, saved, failures };
}

it("schedules short-lived tokens before expiry without an immediate refresh loop", async () => {
  const fixture = createLifecycleFixture();
  await fixture.manager.initialize();
  expect(fixture.delays).toEqual([60_000]);
  fixture.manager.destroy();
  expect(fixture.activeTimers.size).toBe(0);
});

it("does not save or reschedule a refresh response received after destruction", async () => {
  const response = deferred<Response>();
  let requestSignal: AbortSignal | null | undefined;
  const fixture = createLifecycleFixture({
    fetch: async (_url, request) => {
      requestSignal = request?.signal;
      return response.promise;
    },
  });
  await fixture.manager.initialize();
  fixture.clock.now = 100_000;
  const access = fixture.manager.getAccessToken();
  fixture.manager.destroy();
  expect(requestSignal?.aborted).toBe(true);
  response.resolve(Response.json({ access_token: "new", expires_in: 120 }));
  await expect(access).rejects.toThrow("destroyed");
  expect(fixture.saved).toEqual([]);
  expect(fixture.failures).toEqual([]);
  expect(fixture.activeTimers.size).toBe(0);
  expect(fixture.manager.isAuthenticated()).toBe(false);
});

it("disconnect removes a refresh timer created while it was waiting for a request", async () => {
  const response = deferred<Response>();
  const fixture = createLifecycleFixture({
    fetch: async () => response.promise,
  });
  await fixture.manager.initialize();
  fixture.clock.now = 100_000;
  const access = fixture.manager.getAccessToken();
  const disconnect = fixture.manager.disconnect();
  response.resolve(Response.json({ access_token: "new", expires_in: 120 }));
  await Promise.all([access, disconnect]);
  expect(fixture.activeTimers.size).toBe(0);
  expect(fixture.manager.getState().status).toBe("disconnected");
  expect(await fixture.manager.getAccessToken()).toBeNull();
  fixture.manager.destroy();
});

it("cancels authorization whose callback listener finishes starting after disconnect", async () => {
  const callback = deferred<OAuthCallbackResult>();
  const listener =
    Promise.withResolvers<
      Awaited<ReturnType<OAuthRedirectService["createSession"]>>
    >();
  let closed = false;
  let opened = false;
  const fixture = createLifecycleFixture({
    redirects: { createSession: () => listener.promise, destroy() {} },
    openExternal: async () => {
      opened = true;
    },
  });
  const start = fixture.manager.startFlow();
  await fixture.manager.disconnect();
  listener.resolve({
    redirectUri: "http://127.0.0.1:43123/callback",
    result: callback.promise,
    close() {
      closed = true;
      callback.reject(new Error("cancelled"));
    },
  });
  await expect(start).rejects.toThrow("cancelled");
  expect(closed).toBe(true);
  expect(opened).toBe(false);
  expect(fixture.manager.getState().status).toBe("disconnected");
  fixture.manager.destroy();
});

it("ignores stored tokens loaded after destruction", async () => {
  const tokens = deferred<OAuthTokens | null>();
  const fixture = createLifecycleFixture({ loadTokens: () => tokens.promise });
  const initialize = fixture.manager.initialize();
  fixture.manager.destroy();
  tokens.resolve({
    accessToken: "old",
    refreshToken: "refresh",
    expiresAt: 120_000,
  });
  await initialize;
  expect(fixture.manager.isAuthenticated()).toBe(false);
  expect(fixture.activeTimers.size).toBe(0);
  expect(fixture.failures).toEqual([]);
});
