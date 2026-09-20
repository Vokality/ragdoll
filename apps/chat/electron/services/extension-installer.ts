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
  /** Extension ids owned by the host's built-in extensions. */
  reservedExtensionIds: readonly string[];
  createId(): string;
  now(): number;
  logger: ServiceLogger;
}

// Extensions persist their data beside the package, so an update has to carry
// it into the replacement directory.
const EXTENSION_STORAGE_FILE = "storage.json";

export interface PreparedExtensionUpdate {
  result: Extract<InstallResult, { success: true }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export class ExtensionInstaller {
  // Installs and uninstalls check, move, and register in several steps; two at
  // once can each pass the checks and then destroy the other's directory.
  private operations = Promise.resolve();

  constructor(private readonly config: ExtensionInstallerConfig) {}

  installFromGitHub(sourceUrl: string): Promise<InstallResult> {
    return this.installPackage(sourceUrl, { kind: "install" });
  }

  private installPackage(
    sourceUrl: string,
    target: { kind: "install" } | { kind: "update"; extensionId: string },
  ): Promise<InstallResult> {
    return this.enqueue(() => this.installPackageNow(sourceUrl, target));
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation, operation);
    this.operations = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async installPackageNow(
    sourceUrl: string,
    target: { kind: "install" } | { kind: "update"; extensionId: string },
  ): Promise<InstallResult> {
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
        release.sha256,
      );

      const manifest = parseExtensionPackageJson(
        await readFile(join(extractedPath, "package.json"), "utf8"),
      );
      const metadata = manifest.ragdollExtension;
      if (!metadata) throw new Error("Package is not a Ragdoll extension");
      if (this.config.reservedExtensionIds.includes(metadata.id)) {
        throw new Error(
          `Extension id '${metadata.id}' belongs to a built-in extension`,
        );
      }
      if (target.kind === "update" && metadata.id !== target.extensionId) {
        throw new Error(
          `Update package id '${metadata.id}' does not match '${target.extensionId}'`,
        );
      }
      const packageVersion = this.parseVersion(manifest.version);
      if (packageVersion !== releaseVersion) {
        throw new Error(
          `Release version ${releaseVersion} does not match package version ${packageVersion}`,
        );
      }

      const finalPath = join(this.config.extensionsPath, metadata.id);
      const existing = await this.config.repository.get(metadata.id);
      if (existing && target.kind === "install") {
        throw new Error(
          `Extension '${metadata.id}' is already installed; use update`,
        );
      }
      if (!existing && (await this.pathExists(finalPath))) {
        throw new Error(
          `Extension directory already exists for '${metadata.id}'`,
        );
      }
      const backupPath = `${finalPath}.backup-${this.config.createId()}`;
      if (existing) await rename(finalPath, backupPath);

      let moved = false;
      try {
        await rename(extractedPath, finalPath);
        moved = true;
        if (existing) {
          const storedData = join(backupPath, EXTENSION_STORAGE_FILE);
          if (await this.pathExists(storedData)) {
            await cp(storedData, join(finalPath, EXTENSION_STORAGE_FILE));
          }
        }
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
        // Only remove what this install put there.
        if (moved) await rm(finalPath, { recursive: true, force: true });
        if (existing) await rename(backupPath, finalPath);
        throw error;
      }
      if (existing) await this.removeGarbage(backupPath);

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

  uninstall(extensionId: string): Promise<OperationResult> {
    return this.enqueue(async () => {
      const extension = await this.config.repository.get(extensionId);
      if (!extension) return { success: false, error: "Extension not found" };
      const backupPath = `${extension.path}.uninstall-${this.config.createId()}`;
      // A directory that is already gone still leaves a registry entry to
      // remove; otherwise the extension can be neither removed nor reinstalled.
      const present = await this.pathExists(extension.path);
      if (present) await rename(extension.path, backupPath);
      try {
        await this.config.repository.delete(extensionId);
      } catch (error) {
        if (present) await rename(backupPath, extension.path);
        throw error;
      }
      if (present) await this.removeGarbage(backupPath);
      return { success: true };
    });
  }

  getInstalledExtensions(): Promise<InstalledExtension[]> {
    return this.config.repository.list();
  }

  async checkForUpdates(): Promise<UpdateCheckResult[]> {
    const extensions = await this.config.repository.list();
    return Promise.all(
      extensions.map(async (extension) => {
        const release = await this.config.releases.resolve(extension.repoUrl);
        const latestVersion = this.parseVersion(release.tag);
        return {
          extensionId: extension.id,
          currentVersion: extension.version,
          latestVersion,
          hasUpdate: compareSemver(latestVersion, extension.version) > 0,
          repoUrl: extension.repoUrl,
        };
      }),
    );
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
    let result: InstallResult;
    try {
      await cp(extension.path, snapshotPath, { recursive: true });
      result = await this.installPackage(extension.repoUrl, {
        kind: "update",
        extensionId,
      });
    } catch (error) {
      await this.removeGarbage(snapshotRoot);
      throw error;
    }
    if (!result.success) {
      await this.removeGarbage(snapshotRoot);
      return result;
    }
    let state: "pending" | "settling" | "settled" = "pending";
    return {
      result,
      commit: async () => {
        if (state !== "pending")
          throw new Error(
            "Extension update transaction is settled or settling",
          );
        state = "settled";
        await this.removeGarbage(snapshotRoot);
      },
      rollback: async () => {
        if (state !== "pending")
          throw new Error(
            "Extension update transaction is settled or settling",
          );
        state = "settling";
        try {
          await rm(extension.path, { recursive: true, force: true });
          // Keep the recovery copy until both files and repository are restored.
          await cp(snapshotPath, extension.path, { recursive: true });
          await this.config.repository.set(extension);
          state = "settled";
        } catch (error) {
          state = "pending";
          throw error;
        }
        await this.removeGarbage(snapshotRoot);
      },
    };
  }

  private async removeGarbage(path: string): Promise<void> {
    try {
      await rm(path, { recursive: true, force: true });
    } catch (error) {
      this.config.logger.error("Failed to remove obsolete extension files", {
        path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
