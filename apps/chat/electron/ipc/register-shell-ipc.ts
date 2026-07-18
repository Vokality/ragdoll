import { z } from "zod";
import type { ExternalNavigationService } from "../services/external-navigation-service.js";
import type { IpcRegistrar } from "./registrar.js";

export function registerShellIpc(
  ipc: IpcRegistrar,
  navigation: ExternalNavigationService,
): void {
  ipc.handle("shell:open-external", (_event, url: unknown) =>
    navigation.open(z.string().url().parse(url)),
  );
}
