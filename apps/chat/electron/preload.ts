import { contextBridge, ipcRenderer } from "electron";
import type {
  ChatMessageDto,
  CharacterSettingsUpdate,
  ElectronAPI,
  OAuthConnectedEvent,
  OAuthFailedEvent,
  SlotActionType,
  SlotChangeEvent,
} from "./electron-api.js";
import { IPC_CHANNELS } from "./electron-api.js";

contextBridge.exposeInMainWorld("electronAPI", {
  // Auth
  hasApiKey: () => ipcRenderer.invoke(IPC_CHANNELS.auth.hasKey),
  setApiKey: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.auth.setKey, key),
  validateApiKey: (key: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.auth.validateKey, key),
  clearApiKey: () => ipcRenderer.invoke(IPC_CHANNELS.auth.clearKey),
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
  onStreamingText: (callback: (text: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, text: string) =>
      callback(text);
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
  executeSlotAction: (
    slotId: string,
    actionType: SlotActionType,
    actionId: string,
  ) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.extensions.executeSlotAction,
      slotId,
      actionType,
      actionId,
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
