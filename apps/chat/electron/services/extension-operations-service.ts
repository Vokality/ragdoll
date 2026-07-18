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
    private readonly manager: ExtensionManager,
    private readonly installer: ExtensionInstaller,
    private readonly storage: StorageRepository,
  ) {}

  async install(repoUrl: string): Promise<InstallResult> {
    const result = await this.installer.installFromGitHub(repoUrl);
    if (!result.success) return result;
    await this.manager.discoverAndLoadPackages();
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
    return {
      success: false,
      error: `Extension '${result.extensionId}' did not load after installation`,
    };
  }

  async uninstall(extensionId: string): Promise<OperationResult> {
    const loaded = this.manager
      .getAvailableExtensions()
      .find(({ id }) => id === extensionId);
    if (loaded && !(await this.manager.unloadPackage(loaded.packageName))) {
      return {
        success: false,
        error: `Failed to unload extension '${extensionId}'`,
      };
    }
    try {
      return await this.installer.uninstall(extensionId);
    } catch (error) {
      if (loaded) await this.manager.loadPackage(loaded.packageName);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
      await this.storage.update((draft) => {
        draft.settings = {
          ...draft.settings,
          disabledExtensions: extensionIds,
        };
      });
      return { success: true };
    } catch (error) {
      await this.manager.setDisabledExtensions(previous);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async update(extensionId: string): Promise<InstallResult> {
    const loaded = this.manager
      .getAvailableExtensions()
      .find(({ id }) => id === extensionId);
    if (loaded && !(await this.manager.unloadPackage(loaded.packageName))) {
      return {
        success: false,
        error: `Failed to unload extension '${extensionId}'`,
      };
    }

    const update = await this.installer.prepareUpdate(extensionId);
    if ("success" in update) {
      if (loaded) await this.manager.loadPackage(loaded.packageName);
      return update;
    }
    try {
      const loadResults = await this.manager.discoverAndLoadPackages();
      const loadResult = loadResults.find(
        ({ extensionId: loadedId }) => loadedId === extensionId,
      );
      if (!loadResult?.success) {
        throw new Error(
          loadResult?.error ??
            `Extension '${extensionId}' did not load after updating`,
        );
      }
      await update.commit();
      return update.result;
    } catch (error) {
      await update.rollback();
      if (loaded) await this.manager.loadPackage(loaded.packageName);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
