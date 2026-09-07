import { UserProfileService } from "./services/user-profile-service.js";
import { ExperienceService } from "./services/experience-service.js";
import { PersonalAgent } from "./services/personal-agent.js";
import { ConnectionService } from "./services/connection-service.js";
import { ConnectionToolService } from "./services/connection-tool-service.js";
import { SdkMcpConnectionFactory } from "./services/mcp-connection-client.js";
import { ConnectionCredentialRepository } from "./infrastructure/connection-credential-repository.js";
import { createOpenAIResponseSessionFactory } from "./services/openai-response-session.js";
import { WebToolService } from "./services/web-tool-service.js";
import {
  OpenAIWebSearchService,
  createWebSearchTransport,
} from "./services/web-search-service.js";
import { ToolHistoryService } from "./services/tool-history-service.js";
import { ExtensionCardService } from "./services/extension-card-service.js";
import { AppToolService } from "./services/app-tool-service.js";
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
import { createHostSchedulerCapability } from "./services/host-scheduler-capability.js";
import { createHostTimersCapability } from "./services/host-timers-capability.js";
import { OAuthLoopbackService } from "./services/oauth-loopback-service.js";
import { RendererEventService } from "./services/renderer-event-service.js";
import { WindowService } from "./services/window-service.js";

export class LumenApplication {
  private readonly rendererEvents = new RendererEventService();
  private readonly navigation = new ExternalNavigationService((url) =>
    shell.openExternal(url),
  );
  private readonly storage: StorageRepository;
  private readonly extensions;
  private readonly profile;
  private readonly experience;
  private readonly cards;
  private readonly connections;
  private readonly windows;
  private readonly oauthRedirects;
  private readonly apiKeys;
  private readonly chat;
  private readonly conversationEvents;
  private readonly unsubscribeConversationEvents: () => void;
  private disposeIpc: (() => Promise<void>) | null = null;

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
    this.profile = new UserProfileService(storage, () =>
      this.rendererEvents.experienceChanged(),
    );
    this.experience = new ExperienceService(
      storage,
      () => this.chat.schedulePendingEventTurns(),
      () => this.rendererEvents.experienceChanged(),
      (reaction) => this.rendererEvents.characterReaction(reaction),
    );
    const timers = createHostTimersCapability();
    const scheduler = createHostSchedulerCapability(timers);
    this.oauthRedirects = new OAuthLoopbackService(
      config.oauth.callbackTimeoutMs,
      timers,
    );
    const connectionCredentials = new ConnectionCredentialRepository(
      storage,
      safeStorage,
    );
    this.connections = new ConnectionService(
      storage,
      connectionCredentials,
      new SdkMcpConnectionFactory(
        connectionCredentials,
        this.oauthRedirects,
        async (url) => {
          const result = await this.navigation.open(url);
          if (!result.success) throw new Error(result.error);
        },
      ),
      () => this.rendererEvents.connectionsChanged(),
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
      scheduler,
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
        slotStateChanged: (extensionId, slotId, state) => {
          this.rendererEvents.slotStateChanged({ extensionId, slotId, state });
          this.cards.reconcile();
        },
        slotsChanged: () => {
          this.rendererEvents.slotsChanged();
          this.cards.reconcile();
        },
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
    this.cards = new ExtensionCardService(this.extensions, (slotId) =>
      this.rendererEvents.activeCardChanged(slotId),
    );
    this.windows = new WindowService(
      config,
      this.navigation,
      this.rendererEvents,
      {
        focused: () => {
          void this.experience.focus().catch(console.error);
        },
        blurred: () => this.experience.blur(),
      },
    );
    this.apiKeys = new ApiKeyService(this.storage, safeStorage);
    this.chat = new ChatApplicationService(
      this.storage,
      this.apiKeys,
      new PersonalAgent(
        storage,
        this.profile,
        this.experience,
        new ConnectionToolService(
          new WebToolService(
            new AppToolService(this.extensions, this.cards),
            new OpenAIWebSearchService(
              this.apiKeys,
              this.config.chat,
              createWebSearchTransport(),
            ),
          ),
          this.connections,
        ),
        this.config.chat,
        createOpenAIResponseSessionFactory(),
        new ToolHistoryService(this.storage),
      ),
      (conversation) => this.rendererEvents.conversationChanged(conversation),
      (error) => {
        console.error("Failed to process event turn", error);
        this.experience.finished(
          false,
          "Lumen could not finish its check-in. Check your API key or connection and try again.",
        );
      },
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
    try {
      await application.initialize();
    } catch (error) {
      try {
        await application.destroy();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Application startup and cleanup failed",
        );
      }
      throw error;
    }
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
    const pendingIpc = this.disposeIpc?.();
    this.disposeIpc = null;
    this.unsubscribeConversationEvents();
    this.oauthRedirects.destroy();
    await Promise.all([
      this.chat.destroy(),
      this.connections.destroy(),
      pendingIpc,
    ]);
    await this.extensions.destroy();
  }

  private async initialize(): Promise<void> {
    await mkdir(this.config.userExtensionsPath, { recursive: true });
    await this.extensions.initialize();
    await this.connections.initialize();
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
    this.disposeIpc = registerIpc(
      ipcMain,
      {
        profile: this.profile,
        experience: this.experience,
        connections: this.connections,
        apiKeys: this.apiKeys,
        chat: this.chat,
        extensions: this.extensions,
        cards: this.cards,
        extensionOperations,
        navigation: this.navigation,
        storage: this.storage,
      },
      (event) => this.windows.authorizeIpc(event),
    );
  }
}
