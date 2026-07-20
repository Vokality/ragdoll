import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { valid as validSemver, compare as compareSemver } from "semver";
import { parseExtensionPackageJson } from "@vokality/ragdoll-extensions/loader";
import type {
  InstallResult,
  InstalledExtension,
  OperationResult,
  UpdateCheckResult,
} from "../electron-api.js";
import { InstalledExtensionRepository } from "../infrastructure/installed-extension-repository.js";
import { ExtensionArchiveService } from "./extension-archive-service.js";
import { GitHubReleaseService } from "./github-release-service.js";
import type { ServiceLogger } from "./service-logger.js";

export interface ExtensionInstallerConfig {
  extensionsPath: string;
  repository: Pick<
    InstalledExtensionRepository,
    "delete" | "get" | "list" | "set"
  >;
  releases: Pick<GitHubReleaseService, "resolve">;
  archives: Pick<ExtensionArchiveService, "downloadAndExtract">;
  createId(): string;
  now(): number;
  logger: ServiceLogger;
}

export interface PreparedExtensionUpdate {
  result: Extract<InstallResult, { success: true }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export class ExtensionInstaller {
  constructor(private readonly config: ExtensionInstallerConfig) {}

  async installFromGitHub(sourceUrl: string): Promise<InstallResult> {
    let temporaryPath: string | null = null;
    try {
      const release = await this.config.releases.resolve(sourceUrl);
      const releaseVersion = this.parseVersion(release.tag);
      await mkdir(this.config.extensionsPath, { recursive: true });
      temporaryPath = await mkdtemp(
        join(this.config.extensionsPath, ".install-"),
      );
      const extractedPath = join(temporaryPath, "package");
      await this.config.archives.downloadAndExtract(
        release.downloadUrl,
        join(temporaryPath, "extension.tar.gz"),
        extractedPath,
      );

      const manifest = parseExtensionPackageJson(
        await readFile(join(extractedPath, "package.json"), "utf8"),
      );
      const metadata = manifest.ragdollExtension;
      if (!metadata) throw new Error("Package is not a Ragdoll extension");
      const packageVersion = this.parseVersion(manifest.version);
      if (packageVersion !== releaseVersion) {
        throw new Error(
          `Release version ${releaseVersion} does not match package version ${packageVersion}`,
        );
      }

      const finalPath = join(this.config.extensionsPath, metadata.id);
      const existing = await this.config.repository.get(metadata.id);
      if (!existing && (await this.pathExists(finalPath))) {
        throw new Error(
          `Extension directory already exists for '${metadata.id}'`,
        );
      }
      const backupPath = `${finalPath}.backup-${this.config.createId()}`;
      if (existing) await rename(finalPath, backupPath);

      try {
        await rename(extractedPath, finalPath);
        await this.config.repository.set({
          id: metadata.id,
          name: metadata.name,
          version: packageVersion,
          description: metadata.description ?? manifest.description ?? "",
          path: finalPath,
          repoUrl: release.repoUrl,
          installedAt: new Date(this.config.now()).toISOString(),
        });
      } catch (error) {
        await rm(finalPath, { recursive: true, force: true });
        if (existing) await rename(backupPath, finalPath);
        throw error;
      }
      if (existing) await rm(backupPath, { recursive: true });

      return {
        success: true,
        extensionId: metadata.id,
        name: metadata.name,
        version: packageVersion,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (temporaryPath) {
        await rm(temporaryPath, { recursive: true, force: true }).catch(
          (error) => {
            this.config.logger.error(
              "Failed to remove extension install directory",
              {
                error: error instanceof Error ? error.message : String(error),
              },
            );
          },
        );
      }
    }
  }

  async uninstall(extensionId: string): Promise<OperationResult> {
    const extension = await this.config.repository.get(extensionId);
    if (!extension) return { success: false, error: "Extension not found" };
    const backupPath = `${extension.path}.uninstall-${this.config.createId()}`;
    await rename(extension.path, backupPath);
    try {
      await this.config.repository.delete(extensionId);
    } catch (error) {
      await rename(backupPath, extension.path);
      throw error;
    }
    await rm(backupPath, { recursive: true });
    return { success: true };
  }

  getInstalledExtensions(): Promise<InstalledExtension[]> {
    return this.config.repository.list();
  }

  async checkForUpdates(): Promise<UpdateCheckResult[]> {
    const results: UpdateCheckResult[] = [];
    for (const extension of await this.config.repository.list()) {
      const release = await this.config.releases.resolve(extension.repoUrl);
      const latestVersion = this.parseVersion(release.tag);
      results.push({
        extensionId: extension.id,
        currentVersion: extension.version,
        latestVersion,
        hasUpdate: compareSemver(latestVersion, extension.version) > 0,
        repoUrl: extension.repoUrl,
      });
    }
    return results;
  }

  async prepareUpdate(
    extensionId: string,
  ): Promise<
    PreparedExtensionUpdate | Extract<InstallResult, { success: false }>
  > {
    const extension = await this.config.repository.get(extensionId);
    if (!extension) return { success: false, error: "Extension not found" };
    const snapshotRoot = await mkdtemp(
      join(this.config.extensionsPath, ".update-"),
    );
    const snapshotPath = join(snapshotRoot, "package");
    await cp(extension.path, snapshotPath, { recursive: true });
    const result = await this.installFromGitHub(extension.repoUrl);
    if (!result.success) {
      await rm(snapshotRoot, { recursive: true });
      return result;
    }
    let settled = false;
    return {
      result,
      commit: async () => {
        if (settled) throw new Error("Extension update transaction is settled");
        settled = true;
        await rm(snapshotRoot, { recursive: true });
      },
      rollback: async () => {
        if (settled) throw new Error("Extension update transaction is settled");
        settled = true;
        await rm(extension.path, { recursive: true, force: true });
        await rename(snapshotPath, extension.path);
        await this.config.repository.set(extension);
        await rm(snapshotRoot, { recursive: true });
      },
    };
  }

  private parseVersion(value: string): string {
    const normalized = value.startsWith("v") ? value.slice(1) : value;
    const version = validSemver(normalized);
    if (!version) throw new Error(`Invalid semantic version: ${value}`);
    return version;
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch (error) {
      if (error instanceof Error && Reflect.get(error, "code") === "ENOENT") {
        return false;
      }
      throw error;
    }
  }
}
