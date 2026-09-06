import { lstat, mkdir, unlink } from "node:fs/promises";
import * as net from "node:net";
import * as path from "node:path";
import type { Disposable } from "vscode";
import { validateCommand } from "./command-validator";
import type { EmoteCommandService } from "./emote-command-service";
import type { EmoteLogger } from "./emote-logger";
import { EMOTE_SOCKET_PATH } from "./ipc-path";

type CommandExecutor = Pick<EmoteCommandService, "executeRaw">;
type CommandLogger = Pick<
  EmoteLogger,
  "info" | "warn" | "error" | "notifyErrorOnce"
>;

export class SocketCommandServer implements Disposable {
  private server: net.Server | null = null;
  private starting: AbortController | null = null;
  private readonly clients = new Set<net.Socket>();

  constructor(
    private readonly commands: CommandExecutor,
    private readonly logger: CommandLogger,
    private readonly socketPath = EMOTE_SOCKET_PATH,
  ) {}

  async start(): Promise<void> {
    if (this.server) throw new Error("Emote command server is already started");
    const server: net.Server = net.createServer((socket) => {
      if (this.server !== server) {
        socket.destroy();
        return;
      }
      this.handleSocket(socket);
    });
    const starting = new AbortController();
    this.starting = starting;
    this.server = server;
    server.on("error", (error: NodeJS.ErrnoException) => {
      this.logger.error("Socket server error", { error: error.message });
    });
    try {
      if (process.platform !== "win32") await this.prepareSocketPath();
      if (this.server !== server)
        throw new Error("Emote command server was disposed during startup");
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          server.off("error", onError);
          server.off("listening", onListening);
          starting.signal.removeEventListener("abort", onAbort);
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const onAbort = () =>
          onError(
            new Error("Emote command server was disposed during startup"),
          );
        const onListening = () => {
          cleanup();
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        starting.signal.addEventListener("abort", onAbort, { once: true });
        try {
          server.listen({ path: this.socketPath, signal: starting.signal });
        } catch (error) {
          cleanup();
          reject(error);
        }
      });
      starting.signal.throwIfAborted();
      this.logger.info("Socket server listening", { path: this.socketPath });
    } catch (error) {
      if (server.listening) server.close();
      if (this.server === server) this.server = null;
      throw error;
    } finally {
      if (this.starting === starting) this.starting = null;
    }
  }

  private async prepareSocketPath(): Promise<void> {
    await mkdir(path.dirname(this.socketPath), { recursive: true });
    let original;
    try {
      original = await lstat(this.socketPath);
    } catch (error) {
      if (error instanceof Error && Reflect.get(error, "code") === "ENOENT")
        return;
      throw error;
    }
    if (!original.isSocket())
      throw new Error("Emote socket path is occupied by a non-socket file");
    const active = await new Promise<boolean>((resolve, reject) => {
      const probe = net.createConnection(this.socketPath);
      probe.setTimeout(2000);
      probe.once("connect", () => {
        probe.destroy();
        resolve(true);
      });
      probe.once("timeout", () => {
        probe.destroy();
        reject(new Error("Timed out checking existing Emote socket"));
      });
      probe.once("error", (error: NodeJS.ErrnoException) => {
        probe.destroy();
        if (error.code === "ECONNREFUSED") resolve(false);
        else reject(error);
      });
    });
    if (active)
      throw new Error("Emote socket is already in use by another instance");
    const current = await lstat(this.socketPath);
    if (current.ino !== original.ino || current.dev !== original.dev) {
      throw new Error("Emote socket changed during startup");
    }
    await unlink(this.socketPath);
  }

  dispose(): void {
    this.starting?.abort(
      new Error("Emote command server was disposed during startup"),
    );
    for (const client of this.clients) client.destroy();
    this.clients.clear();
    this.server?.close();
    this.server = null;
    this.logger.info("Socket server stopped");
  }

  private handleSocket(socket: net.Socket): void {
    this.clients.add(socket);
    socket.on("close", () => this.clients.delete(socket));
    socket.setEncoding("utf8");
    let buffer = "";
    let pending: Promise<void> = Promise.resolve();
    socket.on("data", (data: string) => {
      buffer += data;
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const message = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (message) {
          pending = pending.then(async () => {
            if (!socket.destroyed) await this.handleMessage(socket, message);
          });
        }
        newlineIndex = buffer.indexOf("\n");
      }
    });
    socket.on("error", (error) => {
      this.logger.warn("Socket client error", { error: error.message });
    });
  }

  private async handleMessage(
    socket: net.Socket,
    message: string,
  ): Promise<void> {
    try {
      const raw: unknown = JSON.parse(message);
      const result = validateCommand(raw);
      if (!result.ok) {
        this.logger.warn("Rejected MCP command", { reason: result.reason });
        this.respond(socket, { ok: false, error: result.reason });
        return;
      }
      await this.commands.executeRaw(result.command);
      this.logger.info("Processed MCP command", { type: result.command.type });
      this.respond(socket, { ok: true, type: result.command.type });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn("Failed to process MCP command", { error: message });
      this.respond(socket, { ok: false, error: message });
    }
  }

  private respond(
    socket: net.Socket,
    response: { ok: boolean; type?: string; error?: string },
  ): void {
    if (!socket.destroyed) socket.write(`${JSON.stringify(response)}\n`);
  }
}
