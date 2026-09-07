import { ConnectionToolInputError } from "./mcp-connection-client.js";
import { randomUUID } from "node:crypto";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  connectionSaveSchema,
  type ConnectionInfo,
  type ConnectionSave,
  type ConnectionRecord,
  type OperationResult,
} from "../electron-api.js";
import type { StorageRepository } from "../infrastructure/storage-repository.js";
import type { ConnectionCredentialRepository } from "../infrastructure/connection-credential-repository.js";
import type {
  McpConnectionClient,
  McpConnectionFactory,
} from "./mcp-connection-client.js";
import {
  ConnectionAuthorizationRequired,
  ConnectionOAuthError,
} from "./connection-oauth-provider.js";

interface RuntimeConnection {
  info: ConnectionInfo;
  controller?: AbortController;
  client?: McpConnectionClient;
  pending?: Promise<OperationResult>;
}

/** Owns configuration, actual connectivity, and whether the agent may use a connection. */
export class ConnectionService {
  private readonly entries = new Map<string, RuntimeConnection>();
  private mutations: Promise<unknown> = Promise.resolve();
  private stopped = false;
  constructor(
    private readonly storage: StorageRepository,
    private readonly credentials: ConnectionCredentialRepository,
    private readonly factory: McpConnectionFactory,
    private readonly changed: () => void,
  ) {}

  async initialize(): Promise<void> {
    for (const record of (await this.storage.read()).connections) {
      this.entries.set(record.id, {
        info: { ...record, status: "disconnected", toolCount: 0 },
      });
    }
    // Network/provider outages must not block app startup. Connected is set only after MCP initialization and tool discovery.
    for (const entry of this.entries.values())
      if (entry.info.enabled) void this.connect(entry.info.id, false);
  }
  list(): ConnectionInfo[] {
    return [...this.entries.values()].map(({ info }) => structuredClone(info));
  }
  async save(input: ConnectionSave): Promise<ConnectionInfo> {
    return this.mutate(async () => {
      const {
        id: requestedId,
        bearerToken,
        ...config
      } = connectionSaveSchema.parse(input);
      const id = requestedId ?? randomUUID();
      const existing = requestedId ? this.require(id) : undefined;
      const changedAuth =
        !!existing &&
        (existing.info.serverUrl !== config.serverUrl ||
          JSON.stringify(existing.info.authentication) !==
            JSON.stringify(config.authentication));
      const encrypted = bearerToken
        ? this.credentials.seal({ bearerToken })
        : undefined;
      if (existing) {
        await this.stop(existing);
        this.changed();
      }
      const record: ConnectionRecord = {
        ...config,
        id,
        enabled: changedAuth ? false : (existing?.info.enabled ?? false),
      };
      await this.storage.update((draft) => {
        draft.connections = [
          ...draft.connections.filter((connection) => connection.id !== id),
          record,
        ];
        if (changedAuth) delete draft.connectionCredentials[id];
        if (encrypted !== undefined)
          draft.connectionCredentials[id] = encrypted;
      });
      const entry: RuntimeConnection = {
        info: { ...record, status: "disconnected", toolCount: 0 },
      };
      this.entries.set(id, entry);
      this.changed();
      return structuredClone(entry.info);
    });
  }
  async connect(id: string, interactive = true): Promise<OperationResult> {
    await this.mutations;
    if (this.stopped)
      return { success: false, error: "Connections service is stopped" };
    const entry = this.require(id);
    if (entry.pending) return entry.pending;
    if (entry.client) return { success: true };
    const controller = new AbortController();
    entry.controller = controller;
    entry.info = {
      ...entry.info,
      status: "connecting",
      toolCount: 0,
      error: undefined,
    };
    this.changed();
    const work = async (): Promise<OperationResult> => {
      try {
        const client = await this.factory.connect(
          entry.info,
          interactive,
          controller.signal,
        );
        if (controller.signal.aborted) {
          await client.close();
          controller.signal.throwIfAborted();
        }
        entry.client = client;
        entry.info = {
          ...entry.info,
          status: "connected",
          toolCount: client.tools.length,
        };
        return { success: true };
      } catch (error) {
        const needsAuth =
          error instanceof ConnectionAuthorizationRequired ||
          error instanceof UnauthorizedError;
        const message = controller.signal.aborted
          ? "Connection cancelled"
          : needsAuth
            ? "Sign in or update credentials to connect"
            : error instanceof ConnectionOAuthError
              ? error.message
              : "Could not connect. Check the server URL, provider configuration, and network, then retry.";
        entry.info = {
          ...entry.info,
          status: controller.signal.aborted
            ? "disconnected"
            : needsAuth
              ? "needs_auth"
              : "error",
          toolCount: 0,
          error: controller.signal.aborted ? undefined : message,
        };
        return { success: false, error: message };
      } finally {
        entry.pending = undefined;
        this.changed();
      }
    };
    entry.pending = Promise.resolve().then(work);
    return entry.pending;
  }
  async setEnabled(id: string, enabled: boolean): Promise<OperationResult> {
    await this.mutate(async () => {
      const entry = this.require(id);
      await this.storage.update((draft) => {
        const record = draft.connections.find(
          (connection) => connection.id === id,
        );
        if (!record) throw new Error("Connection no longer exists");
        record.enabled = enabled;
      });
      entry.info.enabled = enabled;
      if (!enabled) await this.stop(entry);
      this.changed();
    });
    return enabled ? this.connect(id, false) : { success: true };
  }
  async disconnect(id: string): Promise<OperationResult> {
    await this.mutate(async () => {
      const entry = this.require(id);
      await this.stop(entry);
      await this.storage.update((draft) => {
        const record = draft.connections.find(
          (connection) => connection.id === id,
        );
        if (record) record.enabled = false;
        delete draft.connectionCredentials[id];
      });
      entry.info.enabled = false;
      this.changed();
    });
    return { success: true };
  }
  async remove(id: string): Promise<OperationResult> {
    await this.mutate(async () => {
      await this.stop(this.require(id));
      await this.storage.update((draft) => {
        draft.connections = draft.connections.filter(
          (connection) => connection.id !== id,
        );
        delete draft.connectionCredentials[id];
      });
      this.entries.delete(id);
      this.changed();
    });
    return { success: true };
  }
  tools(id: string): readonly Tool[] {
    const entry = this.require(id);
    if (
      !entry.info.enabled ||
      !entry.client ||
      entry.info.status !== "connected"
    )
      throw new Error("Connection is not available to the agent");
    return entry.client.tools;
  }
  async call(
    id: string,
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<CallToolResult> {
    this.tools(id);
    const entry = this.require(id);
    const client = entry.client;
    if (!client) throw new Error("Connection is disconnected");
    try {
      return await client.call(name, args, signal);
    } catch (error) {
      if (error instanceof ConnectionToolInputError) throw error;
      if (
        error instanceof ConnectionAuthorizationRequired ||
        error instanceof UnauthorizedError
      ) {
        entry.info = {
          ...entry.info,
          status: "needs_auth",
          toolCount: 0,
          error: "Sign in again from Settings",
        };
        entry.client = undefined;
        await client.close();
        this.changed();
      } else if (!signal?.aborted && entry.client === client) {
        entry.info = {
          ...entry.info,
          status: "error",
          toolCount: 0,
          error: "Connection interrupted. Reconnect to use its tools again.",
        };
        entry.client = undefined;
        await client.close();
        this.changed();
      }
      // Transport errors can include headers/provider responses. Never persist them in model history.
      throw new Error(
        "The remote call did not complete. Its outcome is unknown; verify remote state before repeating the action.",
      );
    }
  }
  async destroy(): Promise<void> {
    this.stopped = true;
    await this.mutations;
    await Promise.all(
      [...this.entries.values()].map((entry) => this.stop(entry)),
    );
  }
  private require(id: string): RuntimeConnection {
    const entry = this.entries.get(id);
    if (!entry) throw new Error("Unknown connection");
    return entry;
  }
  private async stop(entry: RuntimeConnection): Promise<void> {
    entry.controller?.abort();
    await entry.pending;
    await entry.client?.close();
    entry.client = undefined;
    entry.controller = undefined;
    entry.info = {
      ...entry.info,
      status: "disconnected",
      toolCount: 0,
      error: undefined,
    };
  }
  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.mutations.then(() => {
      if (this.stopped) throw new Error("Connections service is stopped");
      return operation();
    });
    this.mutations = pending.catch(() => undefined);
    return pending;
  }
}
