import { describe, expect, it } from "bun:test";
import { OAuthLoopbackService } from "./oauth-loopback-service.js";

describe("OAuthLoopbackService", () => {
  it("honors a provider-declared fixed loopback port", async () => {
    const service = new OAuthLoopbackService(1_000);
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
    const service = new OAuthLoopbackService(1_000);
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
