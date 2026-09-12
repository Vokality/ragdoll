import type { ModelProviderId, ProviderKey } from "./domain/model-provider.js";
import { contextBridge, ipcRenderer } from "electron";
import type {
  CharacterReaction,
  ChatMessageDto,
  CharacterSettingsUpdate,
  ElectronAPI,
  OAuthConnectedEvent,
  OAuthFailedEvent,
  SlotActionRequest,
  SlotChangeEvent,
} from "./electron-api.js";
import { IPC_CHANNELS } from "./electron-api.js";

contextBridge.exposeInMainWorld("electronAPI", {
  getExperience: () => ipcRenderer.invoke(IPC_CHANNELS.experience.get),
  beginExperience: () => ipcRenderer.invoke(IPC_CHANNELS.experience.begin),
  saveProfile: (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.experience.saveProfile, input),
  onExperienceChanged: (callback) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.experience.changed, handler);
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.experience.changed, handler);
  },
  onCharacterReaction: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      reaction: CharacterReaction,
    ) => callback(reaction);
    ipcRenderer.on(IPC_CHANNELS.experience.reaction, handler);
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.experience.reaction, handler);
  },
  getConnections: () => ipcRenderer.invoke(IPC_CHANNELS.connections.list),
  saveConnection: (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.connections.save, input),
  connectConnection: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.connections.connect, id),
  disconnectConnection: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.connections.disconnect, id),
  setConnectionEnabled: (id, enabled) =>
    ipcRenderer.invoke(IPC_CHANNELS.connections.setEnabled, id, enabled),
  removeConnection: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.connections.remove, id),
  onConnectionsChanged: (callback) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.connections.changed, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.connections.changed, handler);
    };
  },
  // Auth
  getModelProviders: () => ipcRenderer.invoke(IPC_CHANNELS.auth.providers),
  selectModelProvider: (provider: ModelProviderId) =>
    ipcRenderer.invoke(IPC_CHANNELS.auth.selectProvider, provider),
  hasApiKey: () => ipcRenderer.invoke(IPC_CHANNELS.auth.hasKey),
  setApiKey: (key: ProviderKey) =>
    ipcRenderer.invoke(IPC_CHANNELS.auth.setKey, key),
  validateApiKey: (key: ProviderKey) =>
    ipcRenderer.invoke(IPC_CHANNELS.auth.validateKey, key),
  clearApiKey: (provider?: ModelProviderId) =>
    ipcRenderer.invoke(IPC_CHANNELS.auth.clearKey, provider),
  openExternal: (url: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.shell.openExternal, url),

  // Chat
  sendMessage: (message: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.chat.sendMessage, message),
  cancelMessage: () => ipcRenderer.invoke(IPC_CHANNELS.chat.cancelMessage),
  getConversation: () => ipcRenderer.invoke(IPC_CHANNELS.chat.getConversation),
  clearConversation: () =>
    ipcRenderer.invoke(IPC_CHANNELS.chat.clearConversation),

  // Streaming events
  onStreamingText: (callback: (text: string, messageId: string) => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      text: string,
      messageId: string,
    ) => callback(text, messageId);
    ipcRenderer.on(IPC_CHANNELS.chat.streamingText, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.chat.streamingText, handler);
    };
  },
  onConversationChanged: (
    callback: (conversation: ChatMessageDto[]) => void,
  ) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      conversation: ChatMessageDto[],
    ) => callback(conversation);
    ipcRenderer.on(IPC_CHANNELS.chat.conversationChanged, handler);
    return () => {
      ipcRenderer.removeListener(
        IPC_CHANNELS.chat.conversationChanged,
        handler,
      );
    };
  },
  onFunctionCall: (
    callback: (name: string, args: Record<string, unknown>) => void,
  ) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      name: string,
      args: Record<string, unknown>,
    ) => callback(name, args);
    ipcRenderer.on(IPC_CHANNELS.chat.functionCall, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.chat.functionCall, handler);
    };
  },
  onStreamEnd: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.chat.streamEnd, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.chat.streamEnd, handler);
    };
  },

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settings.get),
  setSettings: (settings: CharacterSettingsUpdate) =>
    ipcRenderer.invoke(IPC_CHANNELS.settings.set, settings),

  // Extensions
  getActiveExtensionCard: () =>
    ipcRenderer.invoke(IPC_CHANNELS.cards.getActive),
  selectExtensionCard: (slotId) =>
    ipcRenderer.invoke(IPC_CHANNELS.cards.select, slotId),
  onActiveExtensionCardChanged: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      slotId: string | null,
    ) => callback(slotId);
    ipcRenderer.on(IPC_CHANNELS.cards.changed, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.cards.changed, handler);
    };
  },

  getExtensionSlots: () => ipcRenderer.invoke(IPC_CHANNELS.extensions.getSlots),
  getSlotState: (slotId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.getSlotState, slotId),
  getDiscoveredExtensions: () =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.getDiscovered),
  getDisabledExtensions: () =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.getDisabled),
  setDisabledExtensions: (extensionIds: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.setDisabled, extensionIds),
  onSlotStateChanged: (callback: (event: SlotChangeEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: SlotChangeEvent) =>
      callback(event);
    ipcRenderer.on(IPC_CHANNELS.extensions.slotStateChanged, handler);
    return () => {
      ipcRenderer.removeListener(
        IPC_CHANNELS.extensions.slotStateChanged,
        handler,
      );
    };
  },
  onExtensionSlotsChanged: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.extensions.slotsChanged, callback);
    return () => {
      ipcRenderer.removeListener(
        IPC_CHANNELS.extensions.slotsChanged,
        callback,
      );
    };
  },
  executeSlotAction: (slotId: string, request: SlotActionRequest) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.extensions.executeSlotAction,
      slotId,
      request,
    ),

  // Extension OAuth
  getOAuthState: (extensionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.oauthGetState, extensionId),
  startOAuthFlow: (extensionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.oauthStartFlow, extensionId),
  disconnectOAuth: (extensionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.oauthDisconnect, extensionId),
  onOAuthConnected: (callback: (event: OAuthConnectedEvent) => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      event: OAuthConnectedEvent,
    ) => callback(event);
    ipcRenderer.on(IPC_CHANNELS.extensions.oauthConnected, handler);
    return () => {
      ipcRenderer.removeListener(
        IPC_CHANNELS.extensions.oauthConnected,
        handler,
      );
    };
  },
  onOAuthFailed: (callback: (event: OAuthFailedEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: OAuthFailedEvent) =>
      callback(event);
    ipcRenderer.on(IPC_CHANNELS.extensions.oauthFailed, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.extensions.oauthFailed, handler);
    };
  },

  // Extension Config
  getConfigStatus: (extensionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.configGetStatus, extensionId),
  getConfigSchema: (extensionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.configGetSchema, extensionId),
  setConfigValues: (
    extensionId: string,
    values: Record<string, string | number | boolean>,
  ) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.extensions.configSetValues,
      extensionId,
      values,
    ),

  // Extension Installation
  installExtensionFromGitHub: (repoUrl: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.installFromGitHub, repoUrl),
  uninstallExtension: (extensionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.uninstall, extensionId),
  getUserInstalledExtensions: () =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.getUserInstalled),
  checkExtensionUpdates: () =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.checkUpdates),
  updateExtension: (extensionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.extensions.update, extensionId),
} satisfies ElectronAPI);
