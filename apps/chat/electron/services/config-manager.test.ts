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

describe("ConfigManager", () => {
  it("rejects stored fields outside the declared schema", async () => {
    const manager = new ConfigManager({
      extensionId: "example",
      schema,
      loadValues: async () => ({ unexpected: "value" }),
      saveValues: async () => undefined,
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
    });
    await manager.initialize();

    await expect(manager.setValue("clientId", "new-value")).rejects.toThrow(
      "storage unavailable",
    );
    expect(manager.getValues()).toEqual({});
    expect(stored).toBeNull();
  });
});
