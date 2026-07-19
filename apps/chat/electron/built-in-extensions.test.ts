import { describe, expect, it } from "bun:test";
import { BUILT_IN_EXTENSIONS } from "./built-in-extensions.js";

describe("built-in extension descriptors", () => {
  it("uses canonical package metadata and includes Spotify OAuth hooks", () => {
    expect(
      BUILT_IN_EXTENSIONS.map(({ descriptor }) => descriptor.extensionId),
    ).toEqual(["character", "tasks", "pomodoro", "spotify"]);

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
