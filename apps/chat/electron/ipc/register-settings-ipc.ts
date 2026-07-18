import { z } from "zod";
import type { StorageRepository } from "../infrastructure/storage-repository.js";
import type { IpcRegistrar } from "./registrar.js";
import { CHARACTER_THEME_IDS, CHARACTER_VARIANT_IDS } from "../electron-api.js";

const settingsUpdateSchema = z
  .object({
    theme: z.enum(CHARACTER_THEME_IDS).optional(),
    variant: z.enum(CHARACTER_VARIANT_IDS).optional(),
  })
  .strict();

export function registerSettingsIpc(
  ipc: IpcRegistrar,
  storage: StorageRepository,
): void {
  ipc.handle("settings:get", async () => (await storage.read()).settings ?? {});
  ipc.handle("settings:set", async (_event, update: unknown) => {
    const settings = settingsUpdateSchema.parse(update);
    await storage.update((draft) => {
      draft.settings = { ...draft.settings, ...settings };
    });
    return { success: true as const };
  });
}
