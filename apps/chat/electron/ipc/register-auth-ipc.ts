import {
  modelProviderIdSchema,
  providerKeySchema,
} from "../domain/model-provider.js";
import type { ApiKeyService } from "../services/api-key-service.js";
import { IPC_CHANNELS } from "../electron-api.js";
import type { IpcRegistrar } from "./registrar.js";

export function registerAuthIpc(
  ipc: IpcRegistrar,
  apiKeys: ApiKeyService,
): void {
  ipc.handle(IPC_CHANNELS.auth.providers, () => apiKeys.listProviders());
  ipc.handle(IPC_CHANNELS.auth.selectProvider, (_event, provider: unknown) =>
    apiKeys.selectProvider(modelProviderIdSchema.parse(provider)),
  );
  ipc.handle(IPC_CHANNELS.auth.hasKey, () => apiKeys.hasKey());
  ipc.handle(IPC_CHANNELS.auth.setKey, (_event, key: unknown) =>
    apiKeys.setKey(providerKeySchema.parse(key)),
  );
  ipc.handle(IPC_CHANNELS.auth.validateKey, (_event, key: unknown) =>
    apiKeys.validateKey(providerKeySchema.parse(key)),
  );
  ipc.handle(IPC_CHANNELS.auth.clearKey, (_event, provider: unknown) =>
    apiKeys.clearKey(modelProviderIdSchema.optional().parse(provider)),
  );
}
