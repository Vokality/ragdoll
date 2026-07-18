import type { ElectronAPI } from "../../electron/electron-api";

export type AppGateway = Pick<ElectronAPI, "hasApiKey">;

export type AppState = "loading" | "setup-api-key" | "ready";

export class AppService {
  constructor(private readonly api: AppGateway) {}

  async resolveInitialState(): Promise<AppState> {
    return (await this.api.hasApiKey()) ? "ready" : "setup-api-key";
  }
}
