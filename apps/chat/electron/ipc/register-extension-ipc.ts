import { z } from "zod";
import { IPC_CHANNELS, type OperationResult } from "../electron-api.js";
import type { ExtensionManager } from "../services/extension-manager.js";
import type { ExtensionOperationsService } from "../services/extension-operations-service.js";
import type { IpcRegistrar } from "./registrar.js";

const idSchema = z.string().min(1);
const idsSchema = z.array(idSchema);
const configValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const configValuesSchema = z.record(z.string(), configValueSchema);
const slotActionSchema = z.enum([
  "panel-action",
  "section-action",
  "item-click",
  "item-toggle",
  "cell-click",
]);

async function operation(
  callback: () => Promise<void>,
): Promise<OperationResult> {
  try {
    await callback();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function registerExtensionIpc(
  ipc: IpcRegistrar,
  manager: ExtensionManager,
  operations: ExtensionOperationsService,
): void {
  ipc.handle(IPC_CHANNELS.extensions.getDiscovered, () =>
    manager.getDiscoveredExtensions(),
  );
  ipc.handle(IPC_CHANNELS.extensions.getDisabled, () =>
    operations.getDisabled(),
  );
  ipc.handle(
    IPC_CHANNELS.extensions.setDisabled,
    (_event, extensionIds: unknown) =>
      operations.setDisabled(idsSchema.parse(extensionIds)),
  );

  ipc.handle(IPC_CHANNELS.extensions.getSlots, () => manager.getAllSlots());
  ipc.handle(IPC_CHANNELS.extensions.getSlotState, (_event, slotId: unknown) =>
    manager.getSlotState(idSchema.parse(slotId)),
  );
  ipc.handle(
    IPC_CHANNELS.extensions.executeSlotAction,
    (_event, slotId: unknown, actionType: unknown, actionId: unknown) =>
      manager.executeSlotAction(
        idSchema.parse(slotId),
        slotActionSchema.parse(actionType),
        idSchema.parse(actionId),
      ),
  );

  ipc.handle(
    IPC_CHANNELS.extensions.oauthGetState,
    (_event, extensionId: unknown) =>
      manager.getOAuthState(idSchema.parse(extensionId)) ?? null,
  );
  ipc.handle(
    IPC_CHANNELS.extensions.oauthStartFlow,
    (_event, extensionId: unknown) =>
      operation(async () => {
        await manager.startOAuthFlow(idSchema.parse(extensionId));
      }),
  );
  ipc.handle(
    IPC_CHANNELS.extensions.oauthDisconnect,
    (_event, extensionId: unknown) =>
      operation(() => manager.disconnectOAuth(idSchema.parse(extensionId))),
  );

  ipc.handle(
    IPC_CHANNELS.extensions.configGetStatus,
    (_event, extensionId: unknown) =>
      manager.getConfigStatus(idSchema.parse(extensionId)) ?? null,
  );
  ipc.handle(
    IPC_CHANNELS.extensions.configGetSchema,
    (_event, extensionId: unknown) =>
      manager.getConfigSchema(idSchema.parse(extensionId)),
  );
  ipc.handle(
    IPC_CHANNELS.extensions.configSetValues,
    (_event, extensionId: unknown, values: unknown) =>
      operation(() =>
        manager.setConfigValues(
          idSchema.parse(extensionId),
          configValuesSchema.parse(values),
        ),
      ),
  );

  ipc.handle(
    IPC_CHANNELS.extensions.installFromGitHub,
    (_event, repoUrl: unknown) =>
      operations.install(z.string().url().parse(repoUrl)),
  );
  ipc.handle(
    IPC_CHANNELS.extensions.uninstall,
    (_event, extensionId: unknown) =>
      operations.uninstall(idSchema.parse(extensionId)),
  );
  ipc.handle(IPC_CHANNELS.extensions.getUserInstalled, () =>
    operations.getInstalled(),
  );
  ipc.handle(IPC_CHANNELS.extensions.checkUpdates, () =>
    operations.checkUpdates(),
  );
  ipc.handle(IPC_CHANNELS.extensions.update, (_event, extensionId: unknown) =>
    operations.update(idSchema.parse(extensionId)),
  );
}
