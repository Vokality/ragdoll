import { z } from "zod";
import type { ExternalNavigationService } from "../services/external-navigation-service.js";
import { IPC_CHANNELS } from "../electron-api.js";
import type { IpcRegistrar } from "./registrar.js";

export function registerShellIpc(
  ipc: IpcRegistrar,
  navigation: ExternalNavigationService,
): void {
  ipc.handle(IPC_CHANNELS.shell.openExternal, (_event, url: unknown) =>
    navigation.open(z.string().url().parse(url)),
  );
}
