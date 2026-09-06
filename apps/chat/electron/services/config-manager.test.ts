import { describe, expect, it } from "bun:test";
import type { ConfigValues } from "@vokality/ragdoll-extensions";
import { ConfigManager } from "./config-manager.js";

const schema = {
  clientId: {
    type: "string" as const,
    label: "Client ID",
    required: true,
  },
};

const logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

describe("ConfigManager", () => {
  it("rejects stored fields outside the declared schema", async () => {
    const manager = new ConfigManager({
      extensionId: "example",
      schema,
      loadValues: async () => ({ unexpected: "value" }),
      saveValues: async () => undefined,
      logger,
    });

    await expect(manager.initialize()).rejects.toThrow("Unknown config field");
  });

  it("changes in-memory values only after persistence succeeds", async () => {
    let stored: ConfigValues | null = null;
    const manager = new ConfigManager({
      extensionId: "example",
      schema,
      loadValues: async () => stored,
      saveValues: async () => {
        throw new Error("storage unavailable");
      },
      logger,
    });
    await manager.initialize();

    await expect(manager.setValue("clientId", "new-value")).rejects.toThrow(
      "storage unavailable",
    );
    expect(manager.getValues()).toEqual({});
    expect(stored).toBeNull();
  });
});

it("serializes loading, saves, and clear without losing newer values", async () => {
  const loading = Promise.withResolvers<ConfigValues | null>();
  const saved: ConfigValues[] = [];
  let loads = 0;
  const manager = new ConfigManager({
    extensionId: "example",
    schema: {
      ...schema,
      region: { type: "string", label: "Region", default: "default" },
    },
    loadValues: () => {
      loads++;
      return loading.promise;
    },
    saveValues: async (values) => {
      saved.push({ ...values });
    },
    logger,
  });
  const initialize = manager.initialize();
  const duplicateInitialize = manager.initialize();
  const changes = { clientId: "chosen" };
  const update = manager.setValues(changes);
  changes.clientId = "mutated later";
  loading.resolve({ clientId: "stored", region: "loaded" });
  await Promise.all([initialize, duplicateInitialize, update]);
  expect(loads).toBe(1);
  expect(manager.getValues()).toEqual({ clientId: "chosen", region: "loaded" });
  const first = manager.setValue("clientId", "first");
  const second = manager.setValue("region", "second");
  await Promise.all([first, second]);
  expect(saved.at(-1)).toEqual({ clientId: "first", region: "second" });
  const clear = manager.clear();
  const afterClear = manager.setValue("clientId", "after clear");
  await Promise.all([clear, afterClear]);
  expect(saved.at(-1)).toEqual({ clientId: "after clear", region: "default" });
});

it("rejects invalid select and numeric values before persistence", async () => {
  let writes = 0;
  const manager = new ConfigManager({
    extensionId: "example",
    schema: {
      mode: {
        type: "select",
        label: "Mode",
        options: [{ value: "one", label: "One" }],
      },
      amount: { type: "number", label: "Amount" },
    },
    loadValues: async () => null,
    saveValues: async () => {
      writes++;
    },
    logger,
  });
  for (const value of [0, true, "unknown"]) {
    await expect(manager.setValue("mode", value)).rejects.toThrow();
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    await expect(manager.setValue("amount", value)).rejects.toThrow(
      "finite number",
    );
  }
  await expect(manager.setValue("constructor", "invalid")).rejects.toThrow(
    "Unknown config field",
  );
  expect(writes).toBe(0);
  await manager.setValues({ mode: "one", amount: 0 });
  expect(writes).toBe(1);
});

it("redacts zero-valued numeric secrets", async () => {
  const manager = new ConfigManager({
    extensionId: "example",
    schema: { secret: { type: "number", label: "Secret", secret: true } },
    loadValues: async () => ({ secret: 0 }),
    saveValues: async () => {},
    logger,
  });
  await manager.initialize();
  expect(manager.getStatus().values.secret).toBe("********");
  expect(manager.getValues().secret).toBe(0);
});

it("a failed queued save does not contaminate later commits", async () => {
  let writes = 0;
  const manager = new ConfigManager({
    extensionId: "example",
    schema,
    loadValues: async () => null,
    saveValues: async () => {
      if (++writes === 1) throw new Error("Failed save");
    },
    logger,
  });
  const first = manager.setValue("clientId", "failed");
  const second = manager.setValue("clientId", "saved");
  await expect(first).rejects.toThrow("Failed save");
  await second;
  expect(manager.getValues()).toEqual({ clientId: "saved" });
});

it("rejects defaults that violate the field constraints", () => {
  expect(
    () =>
      new ConfigManager({
        extensionId: "example",
        schema: {
          count: { type: "number", label: "Count", min: 1, default: 0 },
        },
        loadValues: async () => null,
        saveValues: async () => {},
        logger,
      }),
  ).toThrow("must be at least 1");
});
