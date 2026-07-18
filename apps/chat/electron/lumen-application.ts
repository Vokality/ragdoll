import { Notification, ipcMain, safeStorage, shell } from "electron";
import { mkdir } from "node:fs/promises";
import { BUILT_IN_EXTENSIONS } from "./built-in-extensions.js";
import type { MainProcessConfig } from "./main-process-config.js";
import { createExtensionPackageFileSystem } from "./infrastructure/extension-package-file-system.js";
import { ExtensionStorage } from "./infrastructure/extension-storage.js";
import { createStorageRepository } from "./infrastructure/storage-repository.js";
import type { StorageRepository } from "./infrastructure/storage-repository.js";
import { InstalledExtensionRepository } from "./infrastructure/installed-extension-repository.js";
import { registerIpc } from "./ipc/register-ipc.js";
import { ApiKeyService } from "./services/api-key-service.js";
import { ChatApplicationService } from "./services/chat-application-service.js";
import { ExtensionInstaller } from "./services/extension-installer.js";
import { ExtensionArchiveService } from "./services/extension-archive-service.js";
import { ExtensionManager } from "./services/extension-manager.js";
import { ExtensionMessageBus } from "./services/extension-message-bus.js";
import { ExtensionOperationsService } from "./services/extension-operations-service.js";
import { ExternalNavigationService } from "./services/external-navigation-service.js";
import { GitHubReleaseService } from "./services/github-release-service.js";
import { OAuthCallbackService } from "./services/oauth-callback-service.js";
import { RendererEventService } from "./services/renderer-event-service.js";
import { WindowService } from "./services/window-service.js";

export class LumenApplication {
  private readonly rendererEvents = new RendererEventService();
  private readonly navigation = new ExternalNavigationService((url) =>
    shell.openExternal(url),
  );
  private readonly storage: StorageRepository;
  private readonly extensions;
  private readonly windows;
  private readonly oauthCallbacks;
  private disposeIpc: (() => void) | null = null;

  private constructor(
    private readonly config: MainProcessConfig,
    storage: StorageRepository,
    disabledExtensions: string[],
  ) {
    this.storage = storage;
    const messageBus = new ExtensionMessageBus((name, args) =>
      this.rendererEvents.functionCall(name, args),
    );
    this.extensions = new ExtensionManager({
      packageRoots: [{ path: config.userExtensionsPath, layout: "installed" }],
      builtInExtensions: BUILT_IN_EXTENSIONS,
      fileSystem: createExtensionPackageFileSystem(),
      storage: new ExtensionStorage(config.userExtensionsPath),
      messageBus,
      disabledExtensions,
      oauthRedirectBase: config.oauthRedirectBase,
      openExternal: async (url) => {
        const result = await this.navigation.open(url);
        if (!result.success) throw new Error(result.error);
      },
      onSlotStateChange: (extensionId, slotId, state) =>
        this.rendererEvents.slotChanged({ extensionId, slotId, state }),
      onSlotsChange: () => this.rendererEvents.slotsChanged(),
      onNotification: Notification.isSupported()
        ? (request) => new Notification(request).show()
        : undefined,
    });
    this.windows = new WindowService(
      config,
      this.navigation,
      this.rendererEvents,
    );
    this.oauthCallbacks = new OAuthCallbackService(
      config.protocolScheme,
      this.extensions,
      this.rendererEvents,
    );
  }

  static async create(config: MainProcessConfig): Promise<LumenApplication> {
    const storage = createStorageRepository(config.userDataPath);
    const disabledExtensions =
      (await storage.read()).settings?.disabledExtensions ?? [];
    const application = new LumenApplication(
      config,
      storage,
      disabledExtensions,
    );
    await application.initialize();
    return application;
  }

  async createWindow(): Promise<void> {
    await this.windows.create();
  }

  hasWindow(): boolean {
    return this.windows.hasWindow();
  }

  focusWindow(): void {
    this.windows.focus();
  }

  handleOAuthUrl(url: string): Promise<void> {
    return this.oauthCallbacks.handle(url);
  }

  async destroy(): Promise<void> {
    this.disposeIpc?.();
    this.disposeIpc = null;
    await this.extensions.destroy();
  }

  private async initialize(): Promise<void> {
    await mkdir(this.config.userExtensionsPath, { recursive: true });
    await this.extensions.initialize();

    const apiKeys = new ApiKeyService(this.storage, safeStorage);
    const installer = new ExtensionInstaller({
      extensionsPath: this.config.userExtensionsPath,
      repository: new InstalledExtensionRepository(
        this.config.extensionsRegistryPath,
        this.config.userExtensionsPath,
      ),
      releases: new GitHubReleaseService(),
      archives: new ExtensionArchiveService(),
    });
    const extensionOperations = new ExtensionOperationsService(
      this.extensions,
      installer,
      this.storage,
    );
    this.disposeIpc = registerIpc(ipcMain, {
      apiKeys,
      chat: new ChatApplicationService(
        this.storage,
        apiKeys,
        this.extensions,
        this.config.chat,
      ),
      extensions: this.extensions,
      extensionOperations,
      navigation: this.navigation,
      storage: this.storage,
    });
  }
}
