import type {
  InstallResult,
  OperationResult,
  UpdateCheckResult,
} from "../electron-api.js";
import type { ExtensionInstaller } from "./extension-installer.js";
import type { ExtensionManager } from "./extension-manager.js";
import type { StorageRepository } from "../infrastructure/storage-repository.js";

export class ExtensionOperationsService {
  constructor(
    private readonly manager: Pick<
      ExtensionManager,
      | "getDiscoveredExtensions"
      | "getAvailableExtensions"
      | "discoverAndLoadPackages"
      | "unloadPackage"
      | "loadPackage"
      | "forgetPackage"
      | "getDisabledExtensions"
      | "setDisabledExtensions"
    >,
    private readonly installer: Pick<
      ExtensionInstaller,
      | "installFromGitHub"
      | "uninstall"
      | "getInstalledExtensions"
      | "checkForUpdates"
      | "prepareUpdate"
    >,
    private readonly storage: Pick<StorageRepository, "update">,
  ) {}

  async install(repoUrl: string): Promise<InstallResult> {
    const result = await this.installer.installFromGitHub(repoUrl);
    if (!result.success) return result;
    try {
      await this.manager.discoverAndLoadPackages();
    } catch (error) {
      // Never leave a package on disk that the host could not activate.
      await this.installer.uninstall(result.extensionId);
      return { success: false, error: errorMessage(error) };
    }
    const extension = this.manager
      .getDiscoveredExtensions()
      .find(({ id }) => id === result.extensionId);
    const loaded = this.manager
      .getAvailableExtensions()
      .some(({ id }) => id === result.extensionId);

    if (loaded) return result;
    if (extension?.hasConfigSchema || extension?.hasOAuth) {
      return {
        ...result,
        requiresConfiguration: true,
        message: "Extension requires configuration before it can be enabled",
      };
    }

    await this.installer.uninstall(result.extensionId);
    if (extension) await this.manager.forgetPackage(extension.packageName);
    return {
      success: false,
      error: `Extension '${result.extensionId}' did not load after installation`,
    };
  }

  async uninstall(extensionId: string): Promise<OperationResult> {
    const known = this.manager
      .getDiscoveredExtensions()
      .find(({ id }) => id === extensionId);
    const loaded = this.manager
      .getAvailableExtensions()
      .find(({ id }) => id === extensionId);
    if (loaded && !(await this.manager.unloadPackage(loaded.packageName))) {
      return {
        success: false,
        error: `Failed to unload extension '${extensionId}'`,
      };
    }
    let result: OperationResult;
    try {
      result = await this.installer.uninstall(extensionId);
    } catch (error) {
      result = { success: false, error: errorMessage(error) };
    }
    if (!result.success) {
      if (loaded) await this.restoreAfterFailure(loaded.packageName);
      return result;
    }
    if (known) await this.manager.forgetPackage(known.packageName);
    // A removed extension left in the disabled list would be rejected as
    // unknown on the next toggle of any other extension.
    const disabled = this.manager.getDisabledExtensions();
    if (disabled.includes(extensionId)) {
      await this.setDisabled(disabled.filter((id) => id !== extensionId));
    }
    return result;
  }

  getInstalled() {
    return this.installer.getInstalledExtensions();
  }

  checkUpdates(): Promise<UpdateCheckResult[]> {
    return this.installer.checkForUpdates();
  }

  getDisabled(): string[] {
    return this.manager.getDisabledExtensions();
  }

  async setDisabled(extensionIds: string[]): Promise<OperationResult> {
    const previous = this.manager.getDisabledExtensions();
    try {
      await this.manager.setDisabledExtensions(extensionIds);
      const applied = this.manager.getDisabledExtensions();
      await this.storage.update((draft) => {
        draft.settings.disabledExtensions = applied;
      });
      return { success: true };
    } catch (error) {
      try {
        await this.manager.setDisabledExtensions(previous);
      } catch {
        // The original failure is the one worth reporting.
      }
      return { success: false, error: errorMessage(error) };
    }
  }

  async update(extensionId: string): Promise<InstallResult> {
    const known = this.manager
      .getDiscoveredExtensions()
      .find(({ id }) => id === extensionId);
    const loaded = this.manager
      .getAvailableExtensions()
      .find(({ id }) => id === extensionId);
    if (loaded && !(await this.manager.unloadPackage(loaded.packageName))) {
      return {
        success: false,
        error: `Failed to unload extension '${extensionId}'`,
      };
    }

    let update: Awaited<ReturnType<ExtensionInstaller["prepareUpdate"]>>;
    try {
      update = await this.installer.prepareUpdate(extensionId);
    } catch (error) {
      if (loaded) await this.restoreAfterFailure(loaded.packageName);
      return { success: false, error: errorMessage(error) };
    }
    if ("success" in update) {
      if (loaded) await this.restoreAfterFailure(loaded.packageName);
      return update;
    }
    try {
      // Read the new version's metadata, not what was cached for the old one.
      if (known) await this.manager.forgetPackage(known.packageName);
      const loadResults = await this.manager.discoverAndLoadPackages();
      const loadResult = loadResults.find(
        ({ extensionId: loadedId }) => loadedId === extensionId,
      );
      // A disabled or unconfigured extension is discovered without loading.
      const discovered = this.manager
        .getDiscoveredExtensions()
        .some(({ id }) => id === extensionId);
      if (loadResult ? !loadResult.success : loaded || !discovered) {
        throw new Error(
          loadResult?.error ??
            `Extension '${extensionId}' did not load after updating`,
        );
      }
      await update.commit();
      return update.result;
    } catch (error) {
      try {
        await update.rollback();
        if (known) await this.manager.forgetPackage(known.packageName);
      } catch (rollbackError) {
        return {
          success: false,
          error: `${errorMessage(error)}; restoring the previous version failed: ${errorMessage(rollbackError)}`,
        };
      }
      if (loaded) await this.restoreAfterFailure(loaded.packageName);
      return { success: false, error: errorMessage(error) };
    }
  }

  /** Best effort: the caller is already reporting the failure that led here. */
  private async restoreAfterFailure(packageName: string): Promise<void> {
    try {
      await this.manager.loadPackage(packageName);
    } catch {
      // Reported through the operation result instead.
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
