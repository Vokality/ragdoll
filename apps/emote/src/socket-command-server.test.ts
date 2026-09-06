import { afterEach, describe, expect, it, spyOn } from "bun:test";
import * as net from "node:net";
import { writeFile, readFile, unlink, rename } from "node:fs/promises";
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
      resolve(
        JSON.parse(buffer.slice(0, newline)) as {
          ok: boolean;
          type?: string;
          error?: string;
        },
      );
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

  it("settles startup when disposed while listen is pending and can start again", async () => {
    const socketPath = path.join(
      os.tmpdir(),
      `emote-cancel-${crypto.randomUUID()}.sock`,
    );
    const subject = new SocketCommandServer(
      { executeRaw: async () => {} },
      { info() {}, warn() {}, error() {}, notifyErrorOnce() {} },
      socketPath,
    );
    server = subject;
    const originalListen = net.Server.prototype.listen;
    const listen = spyOn(net.Server.prototype, "listen").mockImplementation(
      function (this: net.Server, ...args: Parameters<net.Server["listen"]>) {
        Reflect.apply(originalListen, this, args);
        subject.dispose();
        return this;
      },
    );
    try {
      await expect(subject.start()).rejects.toThrow("disposed during startup");
    } finally {
      listen.mockRestore();
    }
    await subject.start();
    expect(await send(socketPath, { type: "setMood", mood: "smile" })).toEqual({
      ok: true,
      type: "setMood",
    });
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
    await server.start();

    await expect(
      send(socketPath, { type: "setMood", mood: "smile" }),
    ).resolves.toEqual({ ok: true, type: "setMood" });
    expect(executed).toEqual([{ type: "setMood", mood: "smile" }]);

    await expect(
      send(socketPath, { type: "setMood", mood: "nope" }),
    ).resolves.toEqual({
      ok: false,
      error: 'Unknown mood "nope"',
    });
  });
});

const quietLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  notifyErrorOnce: () => {},
};

it("preserves Unicode split across socket chunks", async () => {
  const socketPath = path.join(
    os.tmpdir(),
    `emote-${crypto.randomUUID()}.sock`,
  );
  const received = Promise.withResolvers<RawCommand>();
  const server = new SocketCommandServer(
    {
      executeRaw: async (raw) => {
        received.resolve(raw);
      },
    },
    quietLogger,
    socketPath,
  );
  await server.start();
  const client = net.createConnection(socketPath);
  try {
    await new Promise<void>((resolve, reject) => {
      client.once("connect", resolve);
      client.once("error", reject);
    });
    const bytes = Buffer.from(
      JSON.stringify({
        type: "setSpeechBubble",
        text: "Hello 🌍",
        tone: "default",
      }) + "\n",
    );
    const cut = bytes.indexOf(Buffer.from("🌍")) + 2;
    client.write(bytes.subarray(0, cut));
    await Bun.sleep(10);
    client.write(bytes.subarray(cut));
    expect((await received.promise).text).toBe("Hello 🌍");
  } finally {
    client.destroy();
    server.dispose();
  }
});

it("runs commands in connection order and closes connected clients on disposal", async () => {
  const socketPath = path.join(
    os.tmpdir(),
    `emote-${crypto.randomUUID()}.sock`,
  );
  const first = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const second = Promise.withResolvers<void>();
  const order: unknown[] = [];
  const server = new SocketCommandServer(
    {
      executeRaw: async (raw) => {
        order.push(raw.type);
        if (raw.type === "show") {
          started.resolve();
          await first.promise;
        } else second.resolve();
      },
    },
    quietLogger,
    socketPath,
  );
  await server.start();
  const client = net.createConnection(socketPath);
  client.resume();
  try {
    await new Promise<void>((resolve, reject) => {
      client.once("connect", resolve);
      client.once("error", reject);
    });
    client.write('{"type":"show"}\n{"type":"hide"}\n');
    await started.promise;
    await Bun.sleep(10);
    expect(order).toEqual(["show"]);
    first.resolve();
    await second.promise;
    expect(order).toEqual(["show", "hide"]);
    const closed = new Promise<void>((resolve) =>
      client.once("close", () => resolve()),
    );
    server.dispose();
    await closed;
    expect(client.destroyed).toBe(true);
  } finally {
    first.resolve();
    client.destroy();
    server.dispose();
  }
});

it("a competing instance cannot take over or delete the active socket", async () => {
  const socketPath = path.join(
    os.tmpdir(),
    `emote-${crypto.randomUUID()}.sock`,
  );
  const owner = new SocketCommandServer(
    { executeRaw: async () => {} },
    quietLogger,
    socketPath,
  );
  const contender = new SocketCommandServer(
    {
      executeRaw: async () => {
        throw new Error("Wrong instance");
      },
    },
    quietLogger,
    socketPath,
  );
  try {
    await owner.start();
    await expect(contender.start()).rejects.toThrow("already in use");
    contender.dispose();
    expect(await send(socketPath, { type: "show" })).toEqual({
      ok: true,
      type: "show",
    });
  } finally {
    contender.dispose();
    owner.dispose();
  }
});

it("leaves an unrelated file at the socket path untouched", async () => {
  const socketPath = path.join(
    os.tmpdir(),
    `emote-${crypto.randomUUID()}.sock`,
  );
  await writeFile(socketPath, "keep me");
  const server = new SocketCommandServer(
    { executeRaw: async () => {} },
    quietLogger,
    socketPath,
  );
  try {
    await expect(server.start()).rejects.toThrow("non-socket file");
    server.dispose();
    expect(await readFile(socketPath, "utf8")).toBe("keep me");
  } finally {
    server.dispose();
    await unlink(socketPath);
  }
});

it("recovers an abandoned Unix socket", async () => {
  const socketPath = path.join(
    os.tmpdir(),
    `emote-${crypto.randomUUID()}.sock`,
  );
  const previous = net.createServer();
  await new Promise<void>((resolve) =>
    previous.listen(socketPath + ".old", resolve),
  );
  // Moving the directory entry prevents close() from unlinking it, leaving a
  // real socket inode with no listener, as after a process crash.
  await rename(socketPath + ".old", socketPath);
  await new Promise<void>((resolve, reject) =>
    previous.close((error) => (error ? reject(error) : resolve())),
  );
  const server = new SocketCommandServer(
    { executeRaw: async () => {} },
    quietLogger,
    socketPath,
  );
  try {
    await server.start();
    expect(await send(socketPath, { type: "show" })).toEqual({
      ok: true,
      type: "show",
    });
  } finally {
    server.dispose();
  }
});
