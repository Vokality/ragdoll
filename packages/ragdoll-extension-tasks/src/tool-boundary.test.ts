import { expect, it } from "bun:test";
import { createExtension } from "./index.js";

it("rejects malformed arguments before invoking domain handlers", async () => {
  const calls: unknown[] = [];
  const runtime = await createExtension().activate(
    {
      capabilities: new Set(["storage", "logger"]),
      storage: {
        read: async () => undefined,
        write: async (_id, _key, value) => {
          calls.push(value);
        },
        delete: async () => {},
        list: async () => [],
      },
      logger: { debug() {}, info() {}, warn() {}, error() {} },
    },
    { instanceId: "boundary-test", createdAt: 0 },
  );
  const tools = runtime.tools ?? [];
  calls.length = 0;
  for (const { name, args } of [
    { name: "addTask", args: { text: 42 } },
    { name: "addTask", args: { text: "task", status: "invalid" } },
    {
      name: "updateTaskStatus",
      args: { taskId: "id", status: "blocked", blockedReason: 12 },
    },
    { name: "setActiveTask", args: { taskId: false } },
    { name: "removeTask", args: {} },
  ]) {
    const tool = tools.find((entry) => entry.definition.function.name === name);
    if (!tool) throw new Error(`Missing tool: ${name}`);
    const validation = tool.validate?.(args);
    expect(validation?.valid).toBe(false);
    expect(() => tool.handler(args, {})).toThrow(validation?.error);
  }
  expect(calls).toEqual([]);
  await runtime.dispose?.();
});
