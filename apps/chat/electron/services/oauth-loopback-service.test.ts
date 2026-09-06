import { describe, expect, it } from "bun:test";
import { request } from "node:http";
import { OAuthLoopbackService } from "./oauth-loopback-service.js";
import { createHostTimersCapability } from "./host-timers-capability.js";

describe("OAuthLoopbackService", () => {
  it("rejects malformed request targets without crashing the callback listener", async () => {
    const service = new OAuthLoopbackService(
      1_000,
      createHostTimersCapability(),
    );
    const session = await service.createSession("spotify");
    try {
      const status = await new Promise<number | undefined>(
        (resolve, reject) => {
          const connection = request(
            session.redirectUri,
            { path: "http://[" },
            (response) => {
              response.resume();
              resolve(response.statusCode);
            },
          );
          connection.on("error", reject);
          connection.end();
        },
      );
      expect(status).toBe(400);
      await fetch(`${session.redirectUri}?code=valid`);
      expect(await session.result).toMatchObject({ code: "valid" });
    } finally {
      service.destroy();
    }
  });

  it("rejects startup interrupted by shutdown and forbids new sessions", async () => {
    const service = new OAuthLoopbackService(
      1_000,
      createHostTimersCapability(),
    );
    const starting = service.createSession("spotify");
    service.destroy();
    await expect(starting).rejects.toThrow("stopped");
    await expect(service.createSession("spotify")).rejects.toThrow("stopped");
  });

  it("a port conflict rejects only the contender and preserves the existing session", async () => {
    const owner = new OAuthLoopbackService(1_000, createHostTimersCapability());
    const contender = new OAuthLoopbackService(
      1_000,
      createHostTimersCapability(),
    );
    const session = await owner.createSession("spotify");
    try {
      await expect(
        contender.createSession(
          "spotify",
          Number(new URL(session.redirectUri).port),
        ),
      ).rejects.toThrow();
      contender.destroy();
      expect(
        (await fetch(`${session.redirectUri}?code=valid&state=expected`))
          .status,
      ).toBe(200);
      expect(await session.result).toMatchObject({
        code: "valid",
        state: "expected",
      });
    } finally {
      owner.destroy();
      contender.destroy();
    }
  });

  it("rejects invalid ports without retaining a session or unhandled rejection", async () => {
    const service = new OAuthLoopbackService(
      1_000,
      createHostTimersCapability(),
    );
    await expect(service.createSession("spotify", -1)).rejects.toThrow();
    service.destroy();
    await Bun.sleep(0);
  });

  it("shutdown cancels a pending callback and releases its port", async () => {
    const service = new OAuthLoopbackService(
      1_000,
      createHostTimersCapability(),
    );
    const session = await service.createSession("spotify");
    service.destroy();
    await expect(session.result).rejects.toThrow("stopped");
    await expect(fetch(session.redirectUri)).rejects.toThrow();
  });

  it("timeout rejects the result and closes the listener", async () => {
    const service = new OAuthLoopbackService(10, createHostTimersCapability());
    const session = await service.createSession("spotify");
    await expect(session.result).rejects.toThrow("timed out");
    await expect(fetch(session.redirectUri)).rejects.toThrow();
    service.destroy();
  });

  it("honors a provider-declared fixed loopback port", async () => {
    const service = new OAuthLoopbackService(
      1_000,
      createHostTimersCapability(),
    );
    const session = await service.createSession("spotify", 43821);
    const redirect = new URL(session.redirectUri);

    expect(redirect.port).toBe("43821");

    const callbackUrl = new URL(session.redirectUri);
    callbackUrl.searchParams.set("code", "authorization-code");
    callbackUrl.searchParams.set("state", "state-value");
    await fetch(callbackUrl);
    await session.result;
    service.destroy();
  });

  it("binds only to loopback and accepts one extension-specific callback", async () => {
    const service = new OAuthLoopbackService(
      1_000,
      createHostTimersCapability(),
    );
    const session = await service.createSession("spotify");
    const redirect = new URL(session.redirectUri);

    expect(redirect.hostname).toBe("127.0.0.1");
    expect(redirect.pathname).toBe("/oauth/callback/spotify");
    expect((await fetch(`${redirect.origin}/wrong-path`)).status).toBe(404);

    const callbackUrl = new URL(session.redirectUri);
    callbackUrl.searchParams.set("code", "authorization-code");
    callbackUrl.searchParams.set("state", "state-value");
    expect((await fetch(callbackUrl)).status).toBe(200);
    expect(await session.result).toEqual({
      code: "authorization-code",
      error: null,
      state: "state-value",
    });
    service.destroy();
  });
});
