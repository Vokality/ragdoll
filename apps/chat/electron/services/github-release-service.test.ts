import { describe, expect, it } from "bun:test";
import { GitHubReleaseService } from "./github-release-service.js";

describe("GitHubReleaseService", () => {
  it("captures a sha256 GitHub asset digest", async () => {
    const service = new GitHubReleaseService(async () =>
      Response.json({
        tag_name: "v1.2.3",
        assets: [
          {
            name: "ragdoll-extension.tar.gz",
            browser_download_url:
              "https://github.com/example/ext/releases/download/v1.2.3/ragdoll-extension.tar.gz",
            digest:
              "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
        ],
      }),
    );

    await expect(
      service.resolve("https://github.com/example/ext"),
    ).resolves.toMatchObject({
      tag: "v1.2.3",
      sha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
  });

  it("allows a release asset with no digest", async () => {
    const service = new GitHubReleaseService(async () =>
      Response.json({
        tag_name: "v1.2.3",
        assets: [
          {
            name: "ragdoll-extension.tar.gz",
            browser_download_url:
              "https://github.com/example/ext/releases/download/v1.2.3/ragdoll-extension.tar.gz",
          },
        ],
      }),
    );

    await expect(
      service.resolve("https://github.com/example/ext"),
    ).resolves.toMatchObject({
      tag: "v1.2.3",
      sha256: undefined,
    });
  });

  it("rejects unsupported asset digests", async () => {
    const service = new GitHubReleaseService(async () =>
      Response.json({
        tag_name: "v1.2.3",
        assets: [
          {
            name: "ragdoll-extension.tar.gz",
            browser_download_url:
              "https://github.com/example/ext/releases/download/v1.2.3/ragdoll-extension.tar.gz",
            digest: "md5:not-sha256",
          },
        ],
      }),
    );

    await expect(
      service.resolve("https://github.com/example/ext"),
    ).rejects.toThrow("Unsupported GitHub asset digest");
  });
});
