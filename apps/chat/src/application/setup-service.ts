import type { ElectronAPI, OperationResult } from "../../electron/electron-api";
import type {
  ModelProviderId,
  ModelProviderInfo,
} from "../../electron/electron-api";

export type SetupGateway = Pick<
  ElectronAPI,
  | "openExternal"
  | "setApiKey"
  | "validateApiKey"
  | "getModelProviders"
  | "selectModelProvider"
  | "clearApiKey"
>;

export class SetupService {
  constructor(private readonly api: SetupGateway) {}

  listProviders(): Promise<ModelProviderInfo[]> {
    return this.api.getModelProviders();
  }

  async configureApiKey(
    provider: ModelProviderId,
    key: string,
  ): Promise<OperationResult> {
    const credential = { provider, key };
    const validation = await this.api.validateApiKey(credential);
    if (!validation.valid) return { success: false, error: validation.error };
    return this.api.setApiKey(credential);
  }

  clearKey(provider: ModelProviderId): Promise<OperationResult> {
    return this.api.clearApiKey(provider);
  }

  selectProvider(provider: ModelProviderId): Promise<OperationResult> {
    return this.api.selectModelProvider(provider);
  }

  openApiKeyPage(provider: ModelProviderInfo): Promise<OperationResult> {
    return this.api.openExternal(provider.apiKeyUrl);
  }
}
