import * as fs from "node:fs";
import * as net from "node:net";
import type { Disposable } from "vscode";
import { validateCommand, type RawCommand } from "./command-validator";
import type { EmoteCommandService } from "./emote-command-service";
import type { EmoteLogger } from "./emote-logger";
import { EMOTE_IPC_DIRECTORY, EMOTE_SOCKET_PATH } from "./ipc-path";

export class SocketCommandServer implements Disposable {
  private server: net.Server | null = null;

  constructor(
    private readonly commands: EmoteCommandService,
    private readonly logger: EmoteLogger,
  ) {}

  start(): void {
    if (this.server) throw new Error("Emote command server is already started");
    if (process.platform !== "win32") {
      fs.mkdirSync(EMOTE_IPC_DIRECTORY, { recursive: true });
      if (fs.existsSync(EMOTE_SOCKET_PATH)) fs.unlinkSync(EMOTE_SOCKET_PATH);
    }

    this.server = net.createServer((socket) => this.handleSocket(socket));
    this.server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        this.logger.warn("Socket already in use", { path: EMOTE_SOCKET_PATH });
        return;
      }
      this.logger.error("Socket server error", { error: error.message });
      this.logger.notifyErrorOnce(
        "socket-server-error",
        "Emote could not start the command server. Check the Emote output channel for details.",
      );
    });
    this.server.listen(EMOTE_SOCKET_PATH, () => {
      this.logger.info("Socket server listening", { path: EMOTE_SOCKET_PATH });
    });
  }

  dispose(): void {
    this.server?.close();
    this.server = null;
    if (process.platform !== "win32" && fs.existsSync(EMOTE_SOCKET_PATH)) {
      fs.unlinkSync(EMOTE_SOCKET_PATH);
    }
    this.logger.info("Socket server stopped");
  }

  private handleSocket(socket: net.Socket): void {
    let buffer = "";
    socket.on("data", (data) => {
      buffer += data.toString();
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const message = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (message) void this.handleMessage(socket, message);
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
      const raw = JSON.parse(message) as RawCommand;
      const result = validateCommand(raw);
      if (!result.ok) {
        this.logger.warn("Rejected MCP command", { reason: result.reason });
        this.respond(socket, { ok: false, error: result.reason });
        return;
      }
      await this.commands.executeRaw(raw);
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
    socket.write(`${JSON.stringify(response)}\n`);
  }
}
