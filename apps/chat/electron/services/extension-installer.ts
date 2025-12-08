/**
 * Extension Installer - Handles installation, uninstallation, and updates of user extensions from GitHub.
 *
 * Responsibilities:
 * - Fetch latest release from GitHub API
 * - Download and extract extension tarballs
 * - Validate extension packages
 * - Track installed extensions with metadata
 * - Check for updates
 * - Uninstall extensions with cleanup
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as zlib from "zlib";
import { pipeline } from "stream/promises";
import { createWriteStream, createReadStream } from "fs";


// =============================================================================
// Types
// =============================================================================

export interface InstalledExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  path: string;
  repoUrl: string;
  installedAt: string;
}

export interface InstallResult {
  success: boolean;
  extensionId?: string;
  name?: string;
  version?: string;
  error?: string;
}

export interface UpdateCheckResult {
  extensionId: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  repoUrl: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  assets: GitHubAsset[];
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface ExtensionManifest {
  name: string;
  version: string;
  description?: string;
  ragdollExtension?: {
    id: string;
    name: string;
    description?: string;
  };
}

interface InstalledExtensionsRegistry {
  extensions: Record<string, InstalledExtension>;
}

// =============================================================================
// Extension Installer
// =============================================================================

export class ExtensionInstaller {
  private extensionsPath: string;
  private registryPath: string;

  constructor(userDataPath: string) {
    this.extensionsPath = path.join(userDataPath, "extensions");
    this.registryPath = path.join(userDataPath, "extensions-registry.json");

    // Ensure extensions directory exists
    if (!fs.existsSync(this.extensionsPath)) {
      fs.mkdirSync(this.extensionsPath, { recursive: true });
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Install an extension from a GitHub repository URL.
   * @param repoUrl GitHub repository URL (e.g., https://github.com/owner/repo)
   */
  async installFromGitHub(repoUrl: string): Promise<InstallResult> {
    try {
      // Parse GitHub URL
      const { owner, repo } = this.parseGitHubUrl(repoUrl);
      if (!owner || !repo) {
        return { success: false, error: "Invalid GitHub URL. Expected format: https://github.com/owner/repo" };
      }

      console.info(`[ExtensionInstaller] Installing from ${owner}/${repo}`);

      // Fetch latest release
      const release = await this.fetchLatestRelease(owner, repo);
      if (!release) {
        return { success: false, error: "No releases found for this repository" };
      }

      // Find tarball asset
      const tarballAsset = release.assets.find(
        (asset) => asset.name.endsWith(".tar.gz") && asset.name.includes("ragdoll-extension")
      );
      if (!tarballAsset) {
        return { success: false, error: "No extension tarball found in the latest release" };
      }

      // Parse version from tag
      const version = release.tag_name.replace(/^v/, "").replace(/^[a-z]+-v?/, "");

      // Download tarball
      const tempDir = path.join(this.extensionsPath, ".temp-" + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      const tarballPath = path.join(tempDir, "extension.tar.gz");
      await this.downloadFile(tarballAsset.browser_download_url, tarballPath);

      // Extract tarball
      const extractDir = path.join(tempDir, "extracted");
      fs.mkdirSync(extractDir, { recursive: true });
      await this.extractTarGz(tarballPath, extractDir);

      // Find package.json and validate
      const packageJsonPath = path.join(extractDir, "package.json");
      if (!fs.existsSync(packageJsonPath)) {
        this.cleanup(tempDir);
        return { success: false, error: "Invalid extension: package.json not found" };
      }

      const manifest = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as ExtensionManifest;
      if (!manifest.ragdollExtension?.id) {
        this.cleanup(tempDir);
        return { success: false, error: "Invalid extension: ragdollExtension.id not found in package.json" };
      }

      const extensionId = manifest.ragdollExtension.id;
      const extensionName = manifest.ragdollExtension.name || manifest.name;
      const description = manifest.ragdollExtension.description || manifest.description || "";

      // Check if already installed
      const existingExtension = this.getInstalledExtension(extensionId);
      if (existingExtension) {
        // Remove old installation
        this.cleanup(existingExtension.path);
      }

      // Move to final location
      const finalPath = path.join(this.extensionsPath, extensionId);
      if (fs.existsSync(finalPath)) {
        fs.rmSync(finalPath, { recursive: true });
      }
      fs.renameSync(extractDir, finalPath);

      // Cleanup temp directory
      this.cleanup(tempDir);

      // Register the extension
      this.registerExtension({
        id: extensionId,
        name: extensionName,
        version,
        description,
        path: finalPath,
        repoUrl,
        installedAt: new Date().toISOString(),
      });

      console.info(`[ExtensionInstaller] Successfully installed ${extensionId} v${version}`);

      return {
        success: true,
        extensionId,
        name: extensionName,
        version,
      };
    } catch (error) {
      console.error("[ExtensionInstaller] Installation failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during installation",
      };
    }
  }

  /**
   * Uninstall a user-installed extension.
   */
  async uninstall(extensionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const extension = this.getInstalledExtension(extensionId);
      if (!extension) {
        return { success: false, error: "Extension not found" };
      }

      // Remove extension files
      if (fs.existsSync(extension.path)) {
        fs.rmSync(extension.path, { recursive: true });
      }

      // Remove from registry
      this.unregisterExtension(extensionId);

      console.info(`[ExtensionInstaller] Uninstalled ${extensionId}`);

      return { success: true };
    } catch (error) {
      console.error("[ExtensionInstaller] Uninstall failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during uninstall",
      };
    }
  }

  /**
   * Get list of user-installed extensions.
   */
  getInstalledExtensions(): InstalledExtension[] {
    const registry = this.loadRegistry();
    return Object.values(registry.extensions);
  }

  /**
   * Get a single installed extension by ID.
   */
  getInstalledExtension(extensionId: string): InstalledExtension | null {
    const registry = this.loadRegistry();
    return registry.extensions[extensionId] || null;
  }

  /**
   * Check for updates for all installed extensions.
   */
  async checkForUpdates(): Promise<UpdateCheckResult[]> {
    const extensions = this.getInstalledExtensions();
    const results: UpdateCheckResult[] = [];

    for (const ext of extensions) {
      try {
        const { owner, repo } = this.parseGitHubUrl(ext.repoUrl);
        if (!owner || !repo) continue;

        const release = await this.fetchLatestRelease(owner, repo);
        if (!release) continue;

        const latestVersion = release.tag_name.replace(/^v/, "").replace(/^[a-z]+-v?/, "");
        const hasUpdate = this.compareVersions(latestVersion, ext.version) > 0;

        results.push({
          extensionId: ext.id,
          currentVersion: ext.version,
          latestVersion,
          hasUpdate,
          repoUrl: ext.repoUrl,
        });
      } catch (error) {
        console.warn(`[ExtensionInstaller] Failed to check updates for ${ext.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Update a single extension to the latest version.
   */
  async update(extensionId: string): Promise<InstallResult> {
    const extension = this.getInstalledExtension(extensionId);
    if (!extension) {
      return { success: false, error: "Extension not found" };
    }

    // Reinstall from the same repo URL
    return this.installFromGitHub(extension.repoUrl);
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private parseGitHubUrl(url: string): { owner: string | null; repo: string | null } {
    try {
      // Handle various GitHub URL formats
      // https://github.com/owner/repo
      // https://github.com/owner/repo.git
      // github.com/owner/repo
      const normalized = url.replace(/\.git$/, "");
      const match = normalized.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }
      return { owner: null, repo: null };
    } catch {
      return { owner: null, repo: null };
    }
  }

  private async fetchLatestRelease(owner: string, repo: string): Promise<GitHubRelease | null> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "api.github.com",
        path: `/repos/${owner}/${repo}/releases/latest`,
        method: "GET",
        headers: {
          "User-Agent": "Lumen-Extension-Installer",
          "Accept": "application/vnd.github.v3+json",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data) as GitHubRelease);
            } catch {
              reject(new Error("Failed to parse release data"));
            }
          } else if (res.statusCode === 404) {
            resolve(null);
          } else {
            reject(new Error(`GitHub API error: ${res.statusCode}`));
          }
        });
      });

      req.on("error", reject);
      req.end();
    });
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const handleRedirect = (responseUrl: string) => {
        const protocol = responseUrl.startsWith("https") ? https : https; // GitHub always uses HTTPS
        protocol.get(responseUrl, { headers: { "User-Agent": "Lumen-Extension-Installer" } }, (res) => {
          if (res.statusCode === 302 || res.statusCode === 301) {
            // Follow redirect
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              handleRedirect(redirectUrl);
              return;
            }
          }

          if (res.statusCode !== 200) {
            reject(new Error(`Download failed: ${res.statusCode}`));
            return;
          }

          const fileStream = createWriteStream(destPath);
          res.pipe(fileStream);
          fileStream.on("finish", () => {
            fileStream.close();
            resolve();
          });
          fileStream.on("error", reject);
        }).on("error", reject);
      };

      handleRedirect(url);
    });
  }

  private async extractTarGz(tarballPath: string, destDir: string): Promise<void> {
    // Simple tar.gz extraction using Node.js streams
    // We'll use a basic implementation that handles the common case

    const gunzip = zlib.createGunzip();
    const input = createReadStream(tarballPath);

    // Pipe through gunzip to get tar data
    const tarPath = tarballPath.replace(".gz", "");
    const tarOutput = createWriteStream(tarPath);

    await pipeline(input, gunzip, tarOutput);

    // Now extract the tar file
    await this.extractTar(tarPath, destDir);

    // Cleanup tar file
    fs.unlinkSync(tarPath);
  }

  private async extractTar(tarPath: string, destDir: string): Promise<void> {
    // Basic tar extraction implementation
    // TAR format: 512-byte header blocks followed by file content

    const buffer = fs.readFileSync(tarPath);
    let offset = 0;

    while (offset < buffer.length) {
      // Read header (512 bytes)
      const header = buffer.subarray(offset, offset + 512);
      offset += 512;

      // Check for empty block (end of archive)
      if (header.every((b) => b === 0)) {
        break;
      }

      // Parse header
      const name = this.parseTarString(header, 0, 100);
      const sizeOctal = this.parseTarString(header, 124, 12);
      const typeFlag = header[156];

      if (!name) continue;

      const size = parseInt(sizeOctal, 8) || 0;

      // Strip leading directory component (e.g., "package/")
      const cleanName = name.replace(/^[^/]+\//, "");
      if (!cleanName) {
        offset += Math.ceil(size / 512) * 512;
        continue;
      }

      const filePath = path.join(destDir, cleanName);

      if (typeFlag === 53 || name.endsWith("/")) {
        // Directory
        fs.mkdirSync(filePath, { recursive: true });
      } else if (typeFlag === 0 || typeFlag === 48) {
        // Regular file
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const content = buffer.subarray(offset, offset + size);
        fs.writeFileSync(filePath, content);
      }

      // Move to next block (512-byte aligned)
      offset += Math.ceil(size / 512) * 512;
    }
  }

  private parseTarString(buffer: Buffer, offset: number, length: number): string {
    const slice = buffer.subarray(offset, offset + length);
    const nullIndex = slice.indexOf(0);
    const str = slice.subarray(0, nullIndex === -1 ? length : nullIndex).toString("utf-8");
    return str.trim();
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split(".").map((n) => parseInt(n, 10) || 0);
    const partsB = b.split(".").map((n) => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }
    return 0;
  }

  private cleanup(dir: string): void {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
      }
    } catch (error) {
      console.warn("[ExtensionInstaller] Cleanup failed:", error);
    }
  }

  // ===========================================================================
  // Registry Management
  // ===========================================================================

  private loadRegistry(): InstalledExtensionsRegistry {
    try {
      if (fs.existsSync(this.registryPath)) {
        return JSON.parse(fs.readFileSync(this.registryPath, "utf-8"));
      }
    } catch (error) {
      console.warn("[ExtensionInstaller] Failed to load registry:", error);
    }
    return { extensions: {} };
  }

  private saveRegistry(registry: InstalledExtensionsRegistry): void {
    fs.writeFileSync(this.registryPath, JSON.stringify(registry, null, 2));
  }

  private registerExtension(extension: InstalledExtension): void {
    const registry = this.loadRegistry();
    registry.extensions[extension.id] = extension;
    this.saveRegistry(registry);
  }

  private unregisterExtension(extensionId: string): void {
    const registry = this.loadRegistry();
    delete registry.extensions[extensionId];
    this.saveRegistry(registry);
  }
}

// =============================================================================
// Factory
// =============================================================================

let instance: ExtensionInstaller | null = null;

export function getExtensionInstaller(userDataPath: string): ExtensionInstaller {
  if (!instance) {
    instance = new ExtensionInstaller(userDataPath);
  }
  return instance;
}
