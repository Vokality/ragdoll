import { describe, expect, it } from "bun:test";
import { DEFAULT_CHARACTER_SETTINGS } from "../electron-api.js";
import { storageSchema } from "./storage-repository.js";

describe("storageSchema", () => {
  it("normalizes persisted data into the complete application state", () => {
    expect(storageSchema.parse({})).toEqual({
      settings: {
        ...DEFAULT_CHARACTER_SETTINGS,
        disabledExtensions: [],
      },
      conversation: [],
      pendingAgentTurns: [],
      extensionHost: {},
    });
  });
});
