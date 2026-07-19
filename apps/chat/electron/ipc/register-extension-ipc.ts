import { z } from "zod";
import type { OperationResult } from "../electron-api.js";
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
  ipc.handle("extensions:get-discovered", () =>
    manager.getDiscoveredExtensions(),
  );
  ipc.handle("extensions:get-disabled", () => operations.getDisabled());
  ipc.handle("extensions:set-disabled", (_event, extensionIds: unknown) =>
    operations.setDisabled(idsSchema.parse(extensionIds)),
  );

  ipc.handle("extensions:get-slots", () => manager.getAllSlots());
  ipc.handle("extensions:get-slot-state", (_event, slotId: unknown) =>
    manager.getSlotState(idSchema.parse(slotId)),
  );
  ipc.handle(
    "extensions:execute-slot-action",
    (_event, slotId: unknown, actionType: unknown, actionId: unknown) =>
      manager.executeSlotAction(
        idSchema.parse(slotId),
        slotActionSchema.parse(actionType),
        idSchema.parse(actionId),
      ),
  );

  ipc.handle(
    "extensions:oauth-get-state",
    (_event, extensionId: unknown) =>
      manager.getOAuthState(idSchema.parse(extensionId)) ?? null,
  );
  ipc.handle("extensions:oauth-start-flow", (_event, extensionId: unknown) =>
    operation(async () => {
      await manager.startOAuthFlow(idSchema.parse(extensionId));
    }),
  );
  ipc.handle("extensions:oauth-disconnect", (_event, extensionId: unknown) =>
    operation(() => manager.disconnectOAuth(idSchema.parse(extensionId))),
  );

  ipc.handle(
    "extensions:config-get-status",
    (_event, extensionId: unknown) =>
      manager.getConfigStatus(idSchema.parse(extensionId)) ?? null,
  );
  ipc.handle("extensions:config-get-schema", (_event, extensionId: unknown) =>
    manager.getConfigSchema(idSchema.parse(extensionId)),
  );
  ipc.handle(
    "extensions:config-set-values",
    (_event, extensionId: unknown, values: unknown) =>
      operation(() =>
        manager.setConfigValues(
          idSchema.parse(extensionId),
          configValuesSchema.parse(values),
        ),
      ),
  );

  ipc.handle("extensions:install-from-github", (_event, repoUrl: unknown) =>
    operations.install(z.string().url().parse(repoUrl)),
  );
  ipc.handle("extensions:uninstall", (_event, extensionId: unknown) =>
    operations.uninstall(idSchema.parse(extensionId)),
  );
  ipc.handle("extensions:get-user-installed", () => operations.getInstalled());
  ipc.handle("extensions:check-updates", () => operations.checkUpdates());
  ipc.handle("extensions:update", (_event, extensionId: unknown) =>
    operations.update(idSchema.parse(extensionId)),
  );
}
