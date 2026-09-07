import { registerConnectionIpc } from "./register-connection-ipc.js";
import type { ConnectionService } from "../services/connection-service.js";
import type { ExtensionCardService } from "../services/extension-card-service.js";
import { registerCardIpc } from "./register-card-ipc.js";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import type { StorageRepository } from "../infrastructure/storage-repository.js";
import type { ApiKeyService } from "../services/api-key-service.js";
import type { ChatApplicationService } from "../services/chat-application-service.js";
import type { ExtensionManager } from "../services/extension-manager.js";
import type { ExtensionOperationsService } from "../services/extension-operations-service.js";
import type { ExternalNavigationService } from "../services/external-navigation-service.js";
import { IpcRegistrar } from "./registrar.js";
import { registerAuthIpc } from "./register-auth-ipc.js";
import { registerChatIpc } from "./register-chat-ipc.js";
import { registerExtensionIpc } from "./register-extension-ipc.js";
import { registerSettingsIpc } from "./register-settings-ipc.js";
import { registerShellIpc } from "./register-shell-ipc.js";

export interface IpcServices {
  connections: ConnectionService;
  apiKeys: ApiKeyService;
  chat: ChatApplicationService;
  extensions: ExtensionManager;
  cards: ExtensionCardService;
  extensionOperations: ExtensionOperationsService;
  navigation: ExternalNavigationService;
  storage: StorageRepository;
}

export function registerIpc(
  ipcMain: IpcMain,
  services: IpcServices,
  authorize: (event: IpcMainInvokeEvent) => boolean,
): () => Promise<void> {
  const registrar = new IpcRegistrar(ipcMain, authorize);
  try {
    registerConnectionIpc(registrar, services.connections);
    registerAuthIpc(registrar, services.apiKeys);
    registerChatIpc(registrar, services.chat);
    registerExtensionIpc(
      registrar,
      services.extensions,
      services.extensionOperations,
    );
    registerCardIpc(registrar, services.cards);
    registerSettingsIpc(registrar, services.storage);
    registerShellIpc(registrar, services.navigation);
  } catch (error) {
    void registrar.dispose();
    throw error;
  }
  return () => registrar.dispose();
}
