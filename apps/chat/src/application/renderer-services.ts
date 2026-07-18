import type { ElectronAPI } from "../../electron/electron-api";
import { AppService } from "./app-service";
import { CharacterCommandService } from "./character-command-service";
import { ChatService } from "./chat-service";
import { ExtensionSlotService } from "./extension-slot-service";
import { ExtensionManagementService } from "./extension-management-service";
import { SetupService } from "./setup-service";
import { createElectronChatGateway } from "../infrastructure/electron-chat-gateway";

export interface RendererServices {
  app: AppService;
  setup: SetupService;
  chat: ChatService;
  characterCommands: CharacterCommandService;
  extensionSlots: ExtensionSlotService;
  extensions: ExtensionManagementService;
}

export function createRendererServices(api: ElectronAPI): RendererServices {
  return {
    app: new AppService(api),
    setup: new SetupService(api),
    chat: new ChatService(createElectronChatGateway(api)),
    characterCommands: new CharacterCommandService(),
    extensionSlots: new ExtensionSlotService(api),
    extensions: new ExtensionManagementService(api),
  };
}
