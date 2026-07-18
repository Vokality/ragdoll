import type { ElectronAPI, OperationResult } from "../../electron/electron-api";

const OPENAI_API_KEYS_URL = "https://platform.openai.com/api-keys";

export type SetupGateway = Pick<
  ElectronAPI,
  "openExternal" | "setApiKey" | "validateApiKey"
>;

export class SetupService {
  constructor(private readonly api: SetupGateway) {}

  async configureApiKey(key: string): Promise<OperationResult> {
    const validation = await this.api.validateApiKey(key);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    return this.api.setApiKey(key);
  }

  openApiKeyPage(): Promise<OperationResult> {
    return this.api.openExternal(OPENAI_API_KEYS_URL);
  }
}
