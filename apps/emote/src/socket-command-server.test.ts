import { afterEach, describe, expect, it } from "bun:test";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { SocketCommandServer } from "./socket-command-server";
import type { RawCommand } from "./command-validator";

function send(
  socketPath: string,
  command: unknown,
): Promise<{ ok: boolean; type?: string; error?: string }> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buffer = "";
    socket.on("connect", () => {
      socket.write(`${JSON.stringify(command)}\n`);
    });
    socket.on("data", (data) => {
      buffer += data.toString();
      const newline = buffer.indexOf("\n");
      if (newline === -1) return;
      socket.end();
      resolve(JSON.parse(buffer.slice(0, newline)) as {
        ok: boolean;
        type?: string;
        error?: string;
      });
    });
    socket.on("error", reject);
  });
}

describe("SocketCommandServer", () => {
  let server: SocketCommandServer | undefined;
  const executed: RawCommand[] = [];

  afterEach(() => {
    server?.dispose();
    server = undefined;
    executed.length = 0;
  });

  it("accepts a valid command over the Unix socket and rejects malformed JSON", async () => {
    const socketPath = path.join(
      os.tmpdir(),
      `emote-test-${crypto.randomUUID()}.sock`,
    );
    server = new SocketCommandServer(
      {
        executeRaw: async (raw) => {
          executed.push(raw);
        },
      },
      {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        notifyErrorOnce: () => undefined,
      },
      socketPath,
    );
    server.start();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await Bun.file(socketPath).exists()) break;
      await Bun.sleep(20);
    }

    await expect(
      send(socketPath, { type: "setMood", mood: "smile" }),
    ).resolves.toEqual({ ok: true, type: "setMood" });
    expect(executed).toEqual([{ type: "setMood", mood: "smile" }]);

    await expect(send(socketPath, { type: "setMood", mood: "nope" })).resolves.toEqual({
      ok: false,
      error: 'Unknown mood "nope"',
    });
  });
});
