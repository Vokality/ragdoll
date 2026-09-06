import { describe, expect, it } from "bun:test";
import { EMOTE_VERSION } from "./version";

describe("EMOTE_VERSION", () => {
  it("matches the VS Code extension package version", async () => {
    const pkg = (await Bun.file(
      new URL("../package.json", import.meta.url),
    ).json()) as { version: string };
    expect(EMOTE_VERSION).toBe(pkg.version);
  });
});
