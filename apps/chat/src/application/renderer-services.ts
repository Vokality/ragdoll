import { ExperienceService } from "./experience-service";
import { ConnectionManagementService } from "./connection-management-service";
import {
  DEFAULT_CHARACTER_SETTINGS,
  type ElectronAPI,
} from "../../electron/electron-api";
import { AppService } from "./app-service";
import { CharacterCommandService } from "./character-command-service";
import { ChatService } from "./chat-service";
import { ExtensionSlotService } from "./extension-slot-service";
import { ExtensionManagementService } from "./extension-management-service";
import { SetupService } from "./setup-service";
import { createElectronChatGateway } from "../infrastructure/electron-chat-gateway";

export interface RendererServices {
  experience: ExperienceService;
  app: AppService;
  setup: SetupService;
  chat: ChatService;
  characterCommands: CharacterCommandService;
  extensionSlots: ExtensionSlotService;
  extensions: ExtensionManagementService;
  connections: ConnectionManagementService;
  reportError(error: unknown): void;
}

export function createRendererServices(api: ElectronAPI): RendererServices {
  const reportError = (error: unknown) => {
    console.error("Renderer service failed", error);
  };
  return {
    experience: new ExperienceService(api),
    app: new AppService(api),
    setup: new SetupService(api),
    chat: new ChatService(
      createElectronChatGateway(api),
      DEFAULT_CHARACTER_SETTINGS,
    ),
    characterCommands: new CharacterCommandService(),
    extensionSlots: new ExtensionSlotService(api, reportError),
    extensions: new ExtensionManagementService(api),
    connections: new ConnectionManagementService(api),
    reportError,
  };
}
