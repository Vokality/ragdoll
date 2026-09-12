import { describe, expect, it } from "bun:test";
import { BUILT_IN_EXTENSIONS } from "./built-in-extensions.js";

describe("built-in extension descriptors", () => {
  it("keeps Working List always on and allows Pomodoro to be disabled", () => {
    const permissions = new Map(
      BUILT_IN_EXTENSIONS.map(({ descriptor }) => [
        descriptor.extensionId,
        descriptor.canDisable,
      ]),
    );
    expect(permissions.get("working-list")).toBe(false);
    expect(permissions.get("notes")).toBe(false);
    expect(permissions.get("pomodoro")).toBe(true);
  });

  it("uses canonical package metadata and includes Spotify OAuth hooks", () => {
    expect(
      BUILT_IN_EXTENSIONS.map(({ descriptor }) => descriptor.extensionId),
    ).toEqual([
      "character",
      "tasks",
      "working-list",
      "notes",
      "pomodoro",
      "spotify",
      "tic-tac-toe",
      "flash-cards",
      "canvas",
    ]);

    const spotify = BUILT_IN_EXTENSIONS.find(
      ({ descriptor }) => descriptor.extensionId === "spotify",
    )?.descriptor;
    expect(spotify).toMatchObject({
      capabilities: ["tools"],
      requiredCapabilities: ["oauth"],
      optionalCapabilities: [],
      oauth: {
        provider: "spotify",
        clientIdConfigKey: "clientId",
        callbackPort: 43821,
        pkce: true,
      },
    });
  });
});
