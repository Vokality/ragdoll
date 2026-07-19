import { contextBridge, ipcRenderer } from "electron";
import type {
  ChatMessageDto,
  CharacterSettings,
  ElectronAPI,
  OAuthConnectedEvent,
  OAuthFailedEvent,
  SlotActionType,
  SlotChangeEvent,
} from "./electron-api.js";
import { EXTENSION_EVENT_CHANNELS } from "./electron-api.js";

contextBridge.exposeInMainWorld("electronAPI", {
  // Auth
  hasApiKey: () => ipcRenderer.invoke("auth:has-key"),
  setApiKey: (key: string) => ipcRenderer.invoke("auth:set-key", key),
  validateApiKey: (key: string) => ipcRenderer.invoke("auth:validate-key", key),
  clearApiKey: () => ipcRenderer.invoke("auth:clear-key"),
  openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", url),

  // Chat
  sendMessage: (message: string) =>
    ipcRenderer.invoke("chat:send-message", message),
  getConversation: () => ipcRenderer.invoke("chat:get-conversation"),
  clearConversation: () => ipcRenderer.invoke("chat:clear-conversation"),

  // Streaming events
  onStreamingText: (callback: (text: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, text: string) =>
      callback(text);
    ipcRenderer.on("chat:streaming-text", handler);
    return () => {
      ipcRenderer.removeListener("chat:streaming-text", handler);
    };
  },
  onConversationChanged: (
    callback: (conversation: ChatMessageDto[]) => void,
  ) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      conversation: ChatMessageDto[],
    ) => callback(conversation);
    ipcRenderer.on("chat:conversation-changed", handler);
    return () => {
      ipcRenderer.removeListener("chat:conversation-changed", handler);
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
    ipcRenderer.on("chat:function-call", handler);
    return () => {
      ipcRenderer.removeListener("chat:function-call", handler);
    };
  },
  onStreamEnd: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("chat:stream-end", handler);
    return () => {
      ipcRenderer.removeListener("chat:stream-end", handler);
    };
  },

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings: CharacterSettings) =>
    ipcRenderer.invoke("settings:set", settings),

  // Extensions
  getExtensionSlots: () => ipcRenderer.invoke("extensions:get-slots"),
  getSlotState: (slotId: string) =>
    ipcRenderer.invoke("extensions:get-slot-state", slotId),
  getDiscoveredExtensions: () =>
    ipcRenderer.invoke("extensions:get-discovered"),
  getDisabledExtensions: () => ipcRenderer.invoke("extensions:get-disabled"),
  setDisabledExtensions: (extensionIds: string[]) =>
    ipcRenderer.invoke("extensions:set-disabled", extensionIds),
  onSlotStateChanged: (callback: (event: SlotChangeEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: SlotChangeEvent) =>
      callback(event);
    ipcRenderer.on(EXTENSION_EVENT_CHANNELS.slotStateChanged, handler);
    return () => {
      ipcRenderer.removeListener(
        EXTENSION_EVENT_CHANNELS.slotStateChanged,
        handler,
      );
    };
  },
  onExtensionSlotsChanged: (callback: () => void) => {
    ipcRenderer.on(EXTENSION_EVENT_CHANNELS.slotsChanged, callback);
    return () => {
      ipcRenderer.removeListener(
        EXTENSION_EVENT_CHANNELS.slotsChanged,
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
      "extensions:execute-slot-action",
      slotId,
      actionType,
      actionId,
    ),

  // Extension OAuth
  getOAuthState: (extensionId: string) =>
    ipcRenderer.invoke("extensions:oauth-get-state", extensionId),
  startOAuthFlow: (extensionId: string) =>
    ipcRenderer.invoke("extensions:oauth-start-flow", extensionId),
  disconnectOAuth: (extensionId: string) =>
    ipcRenderer.invoke("extensions:oauth-disconnect", extensionId),
  onOAuthConnected: (callback: (event: OAuthConnectedEvent) => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      event: OAuthConnectedEvent,
    ) => callback(event);
    ipcRenderer.on(EXTENSION_EVENT_CHANNELS.oauthConnected, handler);
    return () => {
      ipcRenderer.removeListener(
        EXTENSION_EVENT_CHANNELS.oauthConnected,
        handler,
      );
    };
  },
  onOAuthFailed: (callback: (event: OAuthFailedEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: OAuthFailedEvent) =>
      callback(event);
    ipcRenderer.on(EXTENSION_EVENT_CHANNELS.oauthFailed, handler);
    return () => {
      ipcRenderer.removeListener(EXTENSION_EVENT_CHANNELS.oauthFailed, handler);
    };
  },

  // Extension Config
  getConfigStatus: (extensionId: string) =>
    ipcRenderer.invoke("extensions:config-get-status", extensionId),
  getConfigSchema: (extensionId: string) =>
    ipcRenderer.invoke("extensions:config-get-schema", extensionId),
  setConfigValues: (
    extensionId: string,
    values: Record<string, string | number | boolean>,
  ) => ipcRenderer.invoke("extensions:config-set-values", extensionId, values),

  // Extension Installation
  installExtensionFromGitHub: (repoUrl: string) =>
    ipcRenderer.invoke("extensions:install-from-github", repoUrl),
  uninstallExtension: (extensionId: string) =>
    ipcRenderer.invoke("extensions:uninstall", extensionId),
  getUserInstalledExtensions: () =>
    ipcRenderer.invoke("extensions:get-user-installed"),
  checkExtensionUpdates: () => ipcRenderer.invoke("extensions:check-updates"),
  updateExtension: (extensionId: string) =>
    ipcRenderer.invoke("extensions:update", extensionId),
} satisfies ElectronAPI);
