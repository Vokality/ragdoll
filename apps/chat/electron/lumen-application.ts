import { Notification, ipcMain, safeStorage, shell } from "electron";
import { mkdir } from "node:fs/promises";
import { BUILT_IN_EXTENSIONS } from "./built-in-extensions.js";
import type { MainProcessConfig } from "./main-process-config.js";
import { createExtensionPackageFileSystem } from "./infrastructure/extension-package-file-system.js";
import { ExtensionStorage } from "./infrastructure/extension-storage.js";
import { createStorageRepository } from "./infrastructure/storage-repository.js";
import type { StorageRepository } from "./infrastructure/storage-repository.js";
import { InstalledExtensionRepository } from "./infrastructure/installed-extension-repository.js";
import { ExtensionHostDataRepository } from "./infrastructure/extension-host-data-repository.js";
import { registerIpc } from "./ipc/register-ipc.js";
import { ApiKeyService } from "./services/api-key-service.js";
import { ChatApplicationService } from "./services/chat-application-service.js";
import { ConversationEventService } from "./services/conversation-event-service.js";
import { ExtensionInstaller } from "./services/extension-installer.js";
import { ExtensionArchiveService } from "./services/extension-archive-service.js";
import { ExtensionManager } from "./services/extension-manager.js";
import { ExtensionMessageBus } from "./services/extension-message-bus.js";
import { ExtensionOperationsService } from "./services/extension-operations-service.js";
import { ExternalNavigationService } from "./services/external-navigation-service.js";
import { GitHubReleaseService } from "./services/github-release-service.js";
import { createHostTimersCapability } from "./services/host-timers-capability.js";
import { OAuthLoopbackService } from "./services/oauth-loopback-service.js";
import {
  createOpenAICompletionSessionFactory,
  OpenAIAgentRunner,
} from "./services/openai-service.js";
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
  private readonly oauthRedirects;
  private readonly apiKeys;
  private readonly chat;
  private readonly conversationEvents;
  private readonly unsubscribeConversationEvents: () => void;
  private disposeIpc: (() => void) | null = null;

  private constructor(
    private readonly config: MainProcessConfig,
    storage: StorageRepository,
    disabledExtensions: string[],
  ) {
    this.storage = storage;
    this.conversationEvents = new ConversationEventService(storage, {
      createId: () => globalThis.crypto.randomUUID(),
      now: Date.now,
    });
    const timers = createHostTimersCapability();
    this.oauthRedirects = new OAuthLoopbackService(
      config.oauth.callbackTimeoutMs,
      timers,
    );
    const messageBus = new ExtensionMessageBus((name, args) =>
      this.rendererEvents.functionCall(name, args),
    );
    this.extensions = new ExtensionManager({
      packageRoots: [{ path: config.userExtensionsPath, layout: "installed" }],
      builtInExtensions: BUILT_IN_EXTENSIONS,
      fileSystem: createExtensionPackageFileSystem(),
      storage: new ExtensionStorage(config.userExtensionsPath),
      messageBus,
      conversationEvents: this.conversationEvents,
      logger: console,
      timers,
      request: fetch,
      now: Date.now,
      hostData: new ExtensionHostDataRepository(storage, safeStorage),
      oauthRedirects: this.oauthRedirects,
      disabledExtensions,
      openExternal: async (url) => {
        const result = await this.navigation.open(url);
        if (!result.success) throw new Error(result.error);
      },
      events: {
        slotStateChanged: (extensionId, slotId, state) =>
          this.rendererEvents.slotStateChanged({ extensionId, slotId, state }),
        slotsChanged: () => this.rendererEvents.slotsChanged(),
        oauthConnected: (extensionId) => {
          this.rendererEvents.oauthConnected({ extensionId });
          this.rendererEvents.focus();
        },
        oauthFailed: (extensionId, error) =>
          this.rendererEvents.oauthFailed({ extensionId, error }),
      },
      onNotification: Notification.isSupported()
        ? (request) => new Notification(request).show()
        : undefined,
    });
    this.windows = new WindowService(
      config,
      this.navigation,
      this.rendererEvents,
    );
    this.apiKeys = new ApiKeyService(this.storage, safeStorage);
    this.chat = new ChatApplicationService(
      this.storage,
      this.apiKeys,
      new OpenAIAgentRunner(
        this.extensions,
        this.config.chat,
        createOpenAICompletionSessionFactory(),
      ),
      (conversation) => this.rendererEvents.conversationChanged(conversation),
      (error) => console.error("Failed to process extension event turn", error),
    );
    this.unsubscribeConversationEvents = this.conversationEvents.onTurnQueued(
      () => void this.chat.schedulePendingEventTurns(),
    );
  }

  static async create(config: MainProcessConfig): Promise<LumenApplication> {
    const storage = createStorageRepository(config.userDataPath);
    const disabledExtensions = (await storage.read()).settings
      .disabledExtensions;
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

  async destroy(): Promise<void> {
    this.disposeIpc?.();
    this.disposeIpc = null;
    this.unsubscribeConversationEvents();
    await this.extensions.destroy();
    this.oauthRedirects.destroy();
  }

  private async initialize(): Promise<void> {
    await mkdir(this.config.userExtensionsPath, { recursive: true });
    await this.extensions.initialize();
    void this.chat.schedulePendingEventTurns();

    const installer = new ExtensionInstaller({
      extensionsPath: this.config.userExtensionsPath,
      repository: new InstalledExtensionRepository(
        this.config.extensionsRegistryPath,
        this.config.userExtensionsPath,
      ),
      releases: new GitHubReleaseService(fetch),
      archives: new ExtensionArchiveService(fetch),
      createId: () => globalThis.crypto.randomUUID(),
      now: Date.now,
      logger: console,
    });
    const extensionOperations = new ExtensionOperationsService(
      this.extensions,
      installer,
      this.storage,
    );
    this.disposeIpc = registerIpc(ipcMain, {
      apiKeys: this.apiKeys,
      chat: this.chat,
      extensions: this.extensions,
      extensionOperations,
      navigation: this.navigation,
      storage: this.storage,
    });
  }
}
