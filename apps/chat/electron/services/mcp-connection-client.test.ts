import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { z } from "zod";
import { SdkMcpConnectionFactory } from "./mcp-connection-client.js";
import { ConnectionCredentialRepository } from "../infrastructure/connection-credential-repository.js";
import { createInMemoryStorageRepository } from "../test-support/in-memory-storage-repository.js";
import { OAuthLoopbackService } from "./oauth-loopback-service.js";
import { createHostTimersCapability } from "./host-timers-capability.js";
import type { ConnectionRecord } from "../electron-api.js";

async function fixture(
  options: {
    invalidState?: boolean;
    invalidIssuer?: boolean;
    missingIssuer?: boolean;
    oidc?: boolean;
    expiresIn?: number;
    deny?: boolean;
    auth?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const tokenRequests: URLSearchParams[] = [];
  const authorizations: URL[] = [];
  let accessToken = "access-one";
  let challenge = "";
  const rpc = z.object({
    id: z.union([z.number(), z.string()]).optional(),
    method: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const base = url.origin;
      if (url.pathname.startsWith("/.well-known/oauth-protected-resource"))
        return Response.json({
          resource: `${base}/mcp`,
          authorization_servers: [base],
          scopes_supported: ["read"],
        });
      if (
        url.pathname === "/.well-known/oauth-authorization-server" &&
        options.oidc
      )
        return new Response(null, { status: 404 });
      if (
        url.pathname === "/.well-known/oauth-authorization-server" ||
        url.pathname === "/.well-known/openid-configuration"
      )
        return Response.json({
          jwks_uri: `${base}/jwks`,
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          issuer: base,
          authorization_endpoint: `${base}/authorize`,
          token_endpoint: `${base}/token`,
          registration_endpoint: `${base}/register`,
          response_types_supported: ["code"],
          code_challenge_methods_supported: ["S256"],
          authorization_response_iss_parameter_supported: true,
        });
      if (url.pathname === "/register") {
        const input = z
          .object({ redirect_uris: z.array(z.string()) })
          .parse(await request.json());
        return Response.json({
          client_id: "lumen-test",
          redirect_uris: input.redirect_uris,
        });
      }
      if (url.pathname === "/token") {
        const input = new URLSearchParams(await request.text());
        tokenRequests.push(input);
        if (input.get("grant_type") === "authorization_code") {
          const verifier = input.get("code_verifier") ?? "";
          if (
            createHash("sha256").update(verifier).digest("base64url") !==
            challenge
          )
            return Response.json({ error: "invalid_grant" }, { status: 400 });
          return Response.json({
            access_token: accessToken,
            refresh_token: "refresh-one",
            token_type: "Bearer",
            expires_in: options.expiresIn ?? 3600,
          });
        }
        accessToken = "access-refreshed";
        return Response.json({
          access_token: accessToken,
          refresh_token: "refresh-rotated",
          token_type: "Bearer",
          expires_in: 3600,
        });
      }
      if (url.pathname !== "/mcp") return new Response(null, { status: 404 });
      if (
        options.auth !== false &&
        request.headers.get("Authorization") !== `Bearer ${accessToken}`
      )
        return new Response(null, {
          status: 401,
          headers: {
            "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp", scope="read"`,
          },
        });
      if (request.method !== "POST") return new Response(null, { status: 405 });
      const message = rpc.parse(await request.json());
      calls.push(message.method);
      if (message.id === undefined) return new Response(null, { status: 202 });
      const result =
        message.method === "initialize"
          ? {
              protocolVersion: "2025-03-26",
              capabilities: { tools: {} },
              serverInfo: { name: "Fixture", version: "1" },
            }
          : message.method === "tools/list"
            ? message.params?.cursor
              ? { tools: [{ name: "second", inputSchema: { type: "object" } }] }
              : {
                  tools: [
                    {
                      name: "echo",
                      inputSchema: {
                        type: "object",
                        properties: { text: { type: "string" } },
                        required: ["text"],
                        additionalProperties: false,
                      },
                    },
                  ],
                  nextCursor: "page-two",
                }
            : { content: [{ type: "text", text: "Echo completed" }] };
      return Response.json({ jsonrpc: "2.0", id: message.id, result });
    },
  });
  const connection: ConnectionRecord = {
    id: crypto.randomUUID(),
    name: "Fixture",
    enabled: true,
    serverUrl: new URL("/mcp", server.url).href,
    authentication:
      options.auth === false ? { type: "none" } : { type: "oauth" },
  };
  const storage = createInMemoryStorageRepository({
    connections: [connection],
  });
  const credentials = new ConnectionCredentialRepository(storage, {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value),
    decryptString: (value) => value.toString(),
  });
  const redirects = new OAuthLoopbackService(
    2000,
    createHostTimersCapability(),
  );
  const factory = new SdkMcpConnectionFactory(
    credentials,
    redirects,
    async (value) => {
      const url = new URL(value);
      authorizations.push(url);
      challenge = url.searchParams.get("code_challenge") ?? "";
      const callback = new URL(url.searchParams.get("redirect_uri") ?? "");
      callback.searchParams.set(
        "state",
        options.invalidState ? "wrong" : (url.searchParams.get("state") ?? ""),
      );
      if (!options.missingIssuer)
        callback.searchParams.set(
          "iss",
          options.invalidIssuer ? "https://wrong.example" : server.url.origin,
        );
      callback.searchParams.set(
        options.deny ? "error" : "code",
        options.deny ? "access_denied" : "valid-code",
      );
      await fetch(callback);
    },
  );
  return {
    connection,
    factory,
    credentials,
    storage,
    calls,
    tokenRequests,
    authorizations,
    close: () => {
      redirects.destroy();
      server.stop(true);
    },
  };
}

describe("MCP SDK connection transport", () => {
  it("performs discovery, PKCE, issuer validation, exchange, pagination and validated remote calls", async () => {
    const test = await fixture();
    try {
      const client = await test.factory.connect(
        test.connection,
        true,
        new AbortController().signal,
      );
      expect(client.tools.map((tool) => tool.name)).toEqual(["echo", "second"]);
      expect(test.authorizations[0]?.searchParams.get("resource")).toBe(
        test.connection.serverUrl,
      );
      expect(test.authorizations[0]?.searchParams.get("scope")).toBe("read");
      expect(test.tokenRequests[0]?.get("resource")).toBe(
        test.connection.serverUrl,
      );
      expect(
        test.tokenRequests[0]?.get("code_verifier")?.length,
      ).toBeGreaterThan(40);
      await expect(client.call("echo", { text: 42 })).rejects.toThrow(
        "Invalid tool arguments",
      );
      expect(
        test.calls.filter((method) => method === "tools/call"),
      ).toHaveLength(0);
      expect((await client.call("echo", { text: "hello" })).content).toEqual([
        { type: "text", text: "Echo completed" },
      ]);
      await client.close();
      const restored = await test.factory.connect(
        test.connection,
        false,
        new AbortController().signal,
      );
      expect(restored.tools).toHaveLength(2);
      expect(test.authorizations).toHaveLength(1);
      await restored.close();
    } finally {
      test.close();
    }
  });
  it("refreshes expiring tokens once before concurrent calls and saves rotation", async () => {
    const test = await fixture({ expiresIn: 1 });
    try {
      const client = await test.factory.connect(
        test.connection,
        true,
        new AbortController().signal,
      );
      await Promise.all([
        client.call("echo", { text: "one" }),
        client.call("echo", { text: "two" }),
      ]);
      expect(
        test.tokenRequests.filter(
          (request) => request.get("grant_type") === "refresh_token",
        ),
      ).toHaveLength(1);
      expect(
        (await test.credentials.load(test.connection.id)).oauth?.tokens
          ?.refresh_token,
      ).toBe("refresh-rotated");
      expect(test.authorizations).toHaveLength(1);
      await client.close();
    } finally {
      test.close();
    }
  });
  for (const options of [
    { invalidState: true },
    { invalidIssuer: true },
    { missingIssuer: true },
    { missingIssuer: true, oidc: true },
    { deny: true },
  ]) {
    it(`rejects invalid callbacks before token exchange: ${JSON.stringify(options)}`, async () => {
      const test = await fixture(options);
      try {
        await expect(
          test.factory.connect(
            test.connection,
            true,
            new AbortController().signal,
          ),
        ).rejects.toThrow();
        expect(test.tokenRequests).toHaveLength(0);
      } finally {
        test.close();
      }
    });
  }
  it("connects unauthenticated servers without starting OAuth", async () => {
    const test = await fixture({ auth: false });
    try {
      const client = await test.factory.connect(
        test.connection,
        true,
        new AbortController().signal,
      );
      expect(client.tools).toHaveLength(2);
      expect(test.authorizations).toHaveLength(0);
      await client.close();
    } finally {
      test.close();
    }
  });
});
