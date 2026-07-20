import { z } from "zod";
import type { ApiKeyService } from "../services/api-key-service.js";
import { IPC_CHANNELS } from "../electron-api.js";
import type { IpcRegistrar } from "./registrar.js";

const apiKeySchema = z.string().min(20);

export function registerAuthIpc(
  ipc: IpcRegistrar,
  apiKeys: ApiKeyService,
): void {
  ipc.handle(IPC_CHANNELS.auth.hasKey, () => apiKeys.hasKey());
  ipc.handle(IPC_CHANNELS.auth.setKey, (_event, key: string) =>
    apiKeys.setKey(apiKeySchema.parse(key)),
  );
  ipc.handle(IPC_CHANNELS.auth.validateKey, (_event, key: string) =>
    apiKeys.validateKey(apiKeySchema.parse(key)),
  );
  ipc.handle(IPC_CHANNELS.auth.clearKey, () => apiKeys.clearKey());
}
