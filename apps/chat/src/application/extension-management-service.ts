import type {
  ElectronAPI,
  ExtensionConfigStatus,
  ExtensionInfo,
  InstalledExtension,
  InstallResult,
  OAuthEvent,
  OAuthState,
  OperationResult,
  UpdateCheckResult,
} from "../../electron/electron-api";
import type { ConfigSchema } from "@vokality/ragdoll-extensions";

export interface ExtensionOverview {
  available: ExtensionInfo[];
  disabled: string[];
  installed: InstalledExtension[];
}

export type ExtensionManagementGateway = Pick<
  ElectronAPI,
  | "checkExtensionUpdates"
  | "disconnectOAuth"
  | "getConfigSchema"
  | "getConfigStatus"
  | "getDisabledExtensions"
  | "getDiscoveredExtensions"
  | "getOAuthState"
  | "getUserInstalledExtensions"
  | "installExtensionFromGitHub"
  | "onOAuthError"
  | "onOAuthSuccess"
  | "setConfigValue"
  | "setDisabledExtensions"
  | "startOAuthFlow"
  | "uninstallExtension"
  | "updateExtension"
>;

export class ExtensionManagementService {
  constructor(private readonly api: ExtensionManagementGateway) {}

  async loadOverview(): Promise<ExtensionOverview> {
    const [available, disabled, installed] = await Promise.all([
      this.api.getDiscoveredExtensions(),
      this.api.getDisabledExtensions(),
      this.api.getUserInstalledExtensions(),
    ]);
    return { available, disabled, installed };
  }

  install(repoUrl: string): Promise<InstallResult> {
    return this.api.installExtensionFromGitHub(repoUrl);
  }

  uninstall(extensionId: string): Promise<OperationResult> {
    return this.api.uninstallExtension(extensionId);
  }

  checkUpdates(): Promise<UpdateCheckResult[]> {
    return this.api.checkExtensionUpdates();
  }

  update(extensionId: string): Promise<InstallResult> {
    return this.api.updateExtension(extensionId);
  }

  async setDisabled(extensionIds: string[]): Promise<void> {
    const result = await this.api.setDisabledExtensions(extensionIds);
    if (!result.success) throw new Error(result.error);
  }

  async loadConfiguration(extensionId: string): Promise<{
    schema: ConfigSchema | null;
    status: ExtensionConfigStatus;
  }> {
    const [schema, status] = await Promise.all([
      this.api.getConfigSchema(extensionId),
      this.api.getConfigStatus(extensionId),
    ]);
    if (!status) {
      throw new Error(`Configuration is unavailable for ${extensionId}`);
    }
    return { schema, status };
  }

  getOAuthState(extensionId: string): Promise<OAuthState | null> {
    return this.api.getOAuthState(extensionId);
  }

  onOAuthSuccess(callback: (event: OAuthEvent) => void): () => void {
    return this.api.onOAuthSuccess(callback);
  }

  onOAuthError(callback: (event: OAuthEvent) => void): () => void {
    return this.api.onOAuthError(callback);
  }

  setConfigValue(
    extensionId: string,
    key: string,
    value: string | number | boolean,
  ): Promise<OperationResult> {
    return this.api.setConfigValue(extensionId, key, value);
  }

  startOAuth(extensionId: string): Promise<OperationResult> {
    return this.api.startOAuthFlow(extensionId);
  }

  disconnectOAuth(extensionId: string): Promise<OperationResult> {
    return this.api.disconnectOAuth(extensionId);
  }
}
