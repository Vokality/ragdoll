import { z } from "zod";
import type { ApiKeyService } from "../services/api-key-service.js";
import type { IpcRegistrar } from "./registrar.js";

const apiKeySchema = z.string().min(20);

export function registerAuthIpc(
  ipc: IpcRegistrar,
  apiKeys: ApiKeyService,
): void {
  ipc.handle("auth:has-key", () => apiKeys.hasKey());
  ipc.handle("auth:set-key", (_event, key: string) =>
    apiKeys.setKey(apiKeySchema.parse(key)),
  );
  ipc.handle("auth:validate-key", (_event, key: string) =>
    apiKeys.validateKey(apiKeySchema.parse(key)),
  );
  ipc.handle("auth:clear-key", () => apiKeys.clearKey());
}
