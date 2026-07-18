import type { IpcMain } from "electron";
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
  apiKeys: ApiKeyService;
  chat: ChatApplicationService;
  extensions: ExtensionManager;
  extensionOperations: ExtensionOperationsService;
  navigation: ExternalNavigationService;
  storage: StorageRepository;
}

export function registerIpc(
  ipcMain: IpcMain,
  services: IpcServices,
): () => void {
  const registrar = new IpcRegistrar(ipcMain);
  registerAuthIpc(registrar, services.apiKeys);
  registerChatIpc(registrar, services.chat);
  registerExtensionIpc(
    registrar,
    services.extensions,
    services.extensionOperations,
  );
  registerSettingsIpc(registrar, services.storage);
  registerShellIpc(registrar, services.navigation);
  return () => registrar.dispose();
}
