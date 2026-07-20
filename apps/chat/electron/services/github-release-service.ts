import { z } from "zod";

const releaseSchema = z.object({
  tag_name: z.string().min(1),
  assets: z.array(
    z.object({
      name: z.string().min(1),
      browser_download_url: z.url(),
    }),
  ),
});

export interface ExtensionRelease {
  repoUrl: string;
  tag: string;
  downloadUrl: string;
}

interface GitHubRepository {
  owner: string;
  repo: string;
  tag?: string;
}

export class GitHubReleaseService {
  constructor(private readonly request: typeof fetch) {}

  async resolve(sourceUrl: string): Promise<ExtensionRelease> {
    const direct = this.parseDirectDownloadUrl(sourceUrl);
    if (direct) return direct;

    const repository = this.parseRepositoryUrl(sourceUrl);
    const endpoint = repository.tag
      ? `https://api.github.com/repos/${repository.owner}/${repository.repo}/releases/tags/${repository.tag}`
      : `https://api.github.com/repos/${repository.owner}/${repository.repo}/releases/latest`;
    const response = await this.request(endpoint, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Lumen-Extension-Installer",
      },
    });
    if (response.status === 404) throw new Error("GitHub release not found");
    if (!response.ok) {
      throw new Error(`GitHub release request failed with ${response.status}`);
    }
    const release = releaseSchema.parse(await response.json());
    const asset = release.assets.find(
      ({ name }) =>
        name.toLowerCase().includes("ragdoll") &&
        name.toLowerCase().endsWith(".tar.gz"),
    );
    if (!asset) throw new Error("Release does not contain a Ragdoll tarball");
    return {
      repoUrl: `https://github.com/${repository.owner}/${repository.repo}`,
      tag: release.tag_name,
      downloadUrl: asset.browser_download_url,
    };
  }

  private parseRepositoryUrl(sourceUrl: string): GitHubRepository {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.hostname !== "github.com") {
      throw new Error("Extension source must be an HTTPS GitHub URL");
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 2) {
      return {
        owner: segments[0]!,
        repo: segments[1]!.replace(/\.git$/, ""),
      };
    }
    if (
      segments.length === 5 &&
      segments[2] === "releases" &&
      segments[3] === "tag"
    ) {
      return { owner: segments[0]!, repo: segments[1]!, tag: segments[4]! };
    }
    throw new Error("GitHub URL must identify a repository or release tag");
  }

  private parseDirectDownloadUrl(sourceUrl: string): ExtensionRelease | null {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
    const segments = url.pathname.split("/").filter(Boolean);
    if (
      segments.length !== 6 ||
      segments[2] !== "releases" ||
      segments[3] !== "download"
    ) {
      return null;
    }
    const filename = segments[5]!;
    if (
      !filename.toLowerCase().includes("ragdoll") ||
      !filename.endsWith(".tar.gz")
    ) {
      throw new Error("Extension download must be a Ragdoll .tar.gz asset");
    }
    return {
      repoUrl: `https://github.com/${segments[0]}/${segments[1]}`,
      tag: segments[4]!,
      downloadUrl: url.toString(),
    };
  }
}
