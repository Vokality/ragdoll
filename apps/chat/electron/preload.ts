import { contextBridge, ipcRenderer } from "electron";
import type {
  ChatMessageDto,
  CharacterSettings,
  ElectronAPI,
  OAuthEvent,
  SlotActionType,
  SlotChangeEvent,
} from "./electron-api.js";

contextBridge.exposeInMainWorld("electronAPI", {
  // Auth
  hasApiKey: () => ipcRenderer.invoke("auth:has-key"),
  setApiKey: (key: string) => ipcRenderer.invoke("auth:set-key", key),
  validateApiKey: (key: string) => ipcRenderer.invoke("auth:validate-key", key),
  clearApiKey: () => ipcRenderer.invoke("auth:clear-key"),
  openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", url),

  // Chat
  sendMessage: (conversationHistory: ChatMessageDto[]) =>
    ipcRenderer.invoke("chat:send-message", conversationHistory),
  getConversation: () => ipcRenderer.invoke("chat:get-conversation"),
  clearConversation: () => ipcRenderer.invoke("chat:clear-conversation"),
  saveConversation: (conversation: ChatMessageDto[]) =>
    ipcRenderer.invoke("chat:save-conversation", conversation),

  // Streaming events
  onStreamingText: (callback: (text: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, text: string) =>
      callback(text);
    ipcRenderer.on("chat:streaming-text", handler);
    return () => {
      ipcRenderer.removeListener("chat:streaming-text", handler);
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
    ipcRenderer.on("extension-slot:changed", handler);
    return () => {
      ipcRenderer.removeListener("extension-slot:changed", handler);
    };
  },
  onExtensionSlotsChanged: (callback: () => void) => {
    ipcRenderer.on("extension-slots:changed", callback);
    return () => {
      ipcRenderer.removeListener("extension-slots:changed", callback);
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
  onOAuthSuccess: (callback: (event: OAuthEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: OAuthEvent) =>
      callback(event);
    ipcRenderer.on("oauth:success", handler);
    return () => {
      ipcRenderer.removeListener("oauth:success", handler);
    };
  },
  onOAuthError: (callback: (event: OAuthEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: OAuthEvent) =>
      callback(event);
    ipcRenderer.on("oauth:error", handler);
    return () => {
      ipcRenderer.removeListener("oauth:error", handler);
    };
  },

  // Extension Config
  getConfigStatus: (extensionId: string) =>
    ipcRenderer.invoke("extensions:config-get-status", extensionId),
  getConfigSchema: (extensionId: string) =>
    ipcRenderer.invoke("extensions:config-get-schema", extensionId),
  setConfigValue: (
    extensionId: string,
    key: string,
    value: string | number | boolean,
  ) =>
    ipcRenderer.invoke("extensions:config-set-value", extensionId, key, value),

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
