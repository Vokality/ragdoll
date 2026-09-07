import { z } from "zod";
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ConnectionRecord } from "../electron-api.js";
import type { ConnectionCredentialRepository } from "../infrastructure/connection-credential-repository.js";
import type { OAuthRedirectService } from "./oauth-loopback-service.js";
import {
  ConnectionOAuthProvider,
  ConnectionAuthorizationRequired,
} from "./connection-oauth-provider.js";

export class ConnectionToolInputError extends Error {}

export interface McpConnectionClient {
  tools: readonly Tool[];
  call(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<CallToolResult>;
  close(): Promise<void>;
}
export interface McpConnectionFactory {
  connect(
    connection: ConnectionRecord,
    interactive: boolean,
    signal: AbortSignal,
  ): Promise<McpConnectionClient>;
}

export class SdkMcpConnectionFactory implements McpConnectionFactory {
  constructor(
    private readonly credentials: ConnectionCredentialRepository,
    private readonly redirects: OAuthRedirectService,
    private readonly openExternal: (url: string) => Promise<void>,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  async connect(
    connection: ConnectionRecord,
    interactive: boolean,
    parentSignal: AbortSignal,
  ): Promise<McpConnectionClient> {
    const lifetime = new AbortController();
    const signal = AbortSignal.any([parentSignal, lifetime.signal]);
    const issuerRequirements = new Map<string, boolean>();
    // Never follow redirects carrying credentials. Each request has a bounded lifetime.
    const request: FetchLike = async (input, init) => {
      const target = new URL(
        input instanceof Request ? input.url : String(input),
      );
      if (
        target.protocol !== "https:" &&
        !(
          target.protocol === "http:" &&
          ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
        )
      )
        throw new Error("MCP and OAuth endpoints must use HTTPS or local HTTP");
      const response = await this.fetcher(input, {
        ...init,
        redirect: "error",
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(30_000),
          ...(init?.signal ? [init.signal] : []),
        ]),
      });
      if (response.ok && target.pathname.includes("/.well-known/")) {
        const metadata = z
          .object({
            issuer: z.string(),
            authorization_response_iss_parameter_supported: z
              .boolean()
              .optional(),
          })
          .safeParse(
            await response
              .clone()
              .json()
              .catch(() => null),
          );
        if (metadata.success)
          issuerRequirements.set(
            metadata.data.issuer,
            metadata.data.authorization_response_iss_parameter_supported ===
              true,
          );
      }
      return response;
    };
    const provider =
      connection.authentication.type === "oauth"
        ? await ConnectionOAuthProvider.create(
            connection,
            this.credentials,
            this.redirects,
            this.openExternal,
            request,
            interactive,
            signal,
            (issuer) => issuerRequirements.get(issuer),
          )
        : undefined;
    const stored =
      connection.authentication.type === "bearer"
        ? await this.credentials.load(connection.id)
        : {};
    if (connection.authentication.type === "bearer" && !stored.bearerToken) {
      provider?.endInteractive();
      throw new ConnectionAuthorizationRequired();
    }
    const createTransport = () =>
      new StreamableHTTPClientTransport(new URL(connection.serverUrl), {
        authProvider: provider,
        fetch: request,
        requestInit:
          connection.authentication.type === "bearer"
            ? { headers: { Authorization: `Bearer ${stored.bearerToken}` } }
            : undefined,
      });
    let client = new Client({ name: "Lumen", version: "1.0.0" });
    const cancel = () => {
      provider?.endInteractive();
      void client.close().catch(() => undefined);
    };
    signal.addEventListener("abort", cancel, { once: true });
    const close = async () => {
      signal.removeEventListener("abort", cancel);
      lifetime.abort();
      provider?.endInteractive();
      await client.close();
    };
    try {
      signal.throwIfAborted();
      if (!interactive) await provider?.ensureFresh();
      try {
        await client.connect(createTransport());
      } catch (error) {
        if (!(error instanceof UnauthorizedError) || !provider || !interactive)
          throw error;
        await provider.finishAuthorization();
        await client.close();
        client = new Client({ name: "Lumen", version: "1.0.0" });
        await client.connect(createTransport());
      }
      provider?.endInteractive();
      const tools: Tool[] = [];
      const cursors = new Set<string>();
      let cursor: string | undefined;
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined, {
          signal,
        });
        tools.push(...page.tools);
        cursor = page.nextCursor;
        if (cursor && cursors.has(cursor))
          throw new Error("MCP server repeated a tools cursor");
        if (cursor) cursors.add(cursor);
        if (tools.length > 1000 || cursors.size > 100)
          throw new Error("MCP tool listing exceeded its limit");
      } while (cursor);
      if (new Set(tools.map((tool) => tool.name)).size !== tools.length)
        throw new Error("MCP server returned duplicate tool names");
      const validator = new AjvJsonSchemaValidator();
      const validators = new Map(
        tools.map((tool) => [
          tool.name,
          validator.getValidator<Record<string, unknown>>(tool.inputSchema),
        ]),
      );
      return {
        tools,
        call: async (name, args, callSignal) => {
          signal.throwIfAborted();
          const validate = validators.get(name);
          if (!validate)
            throw new ConnectionToolInputError(
              "Unknown connection tool; discover the available tools first",
            );
          const validated = validate(args);
          if (!validated.valid)
            throw new ConnectionToolInputError(
              `Invalid tool arguments: ${validated.errorMessage}`,
            );
          await provider?.ensureFresh();
          return CallToolResultSchema.parse(
            await client.callTool(
              { name, arguments: validated.data },
              CallToolResultSchema,
              {
                signal: AbortSignal.any([
                  signal,
                  ...(callSignal ? [callSignal] : []),
                ]),
                timeout: 60_000,
              },
            ),
          );
        },
        close,
      };
    } catch (error) {
      await close();
      throw error;
    }
  }
}
