import { describe, expect, it } from "bun:test";
import { IPC_CHANNELS } from "./electron-api.js";

function flattenChannels(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(flattenChannels);
  }
  return [];
}

describe("IPC_CHANNELS", () => {
  it("declares unique namespace:operation channel names", () => {
    const channels = flattenChannels(IPC_CHANNELS);
    expect(channels.length).toBeGreaterThan(0);
    expect(channels.every((channel) => /^[a-z]+:[a-z0-9-]+$/.test(channel))).toBe(
      true,
    );
    expect(new Set(channels).size).toBe(channels.length);
  });
});
