import { z } from "zod";
import { IPC_CHANNELS, type OperationResult } from "../electron-api.js";
import type { ExtensionCardService } from "../services/extension-card-service.js";
import type { IpcRegistrar } from "./registrar.js";

const selectionSchema = z.string().min(1).nullable();

export function registerCardIpc(
  ipc: IpcRegistrar,
  cards: ExtensionCardService,
): void {
  ipc.handle(IPC_CHANNELS.cards.getActive, () => cards.getActive());
  ipc.handle(
    IPC_CHANNELS.cards.select,
    (_event, input: unknown): OperationResult => {
      try {
        cards.select(selectionSchema.parse(input));
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );
}
