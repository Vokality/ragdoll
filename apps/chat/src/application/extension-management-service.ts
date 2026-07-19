import type {
  ElectronAPI,
  ExtensionConfigStatus,
  ExtensionInfo,
  InstalledExtension,
  InstallResult,
  OAuthConnectedEvent,
  OAuthFailedEvent,
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

export interface ExtensionConfiguration {
  schema: ConfigSchema | null;
  status: ExtensionConfigStatus;
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
  | "onOAuthConnected"
  | "onOAuthFailed"
  | "setConfigValues"
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

  async loadConfiguration(
    extensionId: string,
  ): Promise<ExtensionConfiguration> {
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

  onOAuthConnected(callback: (event: OAuthConnectedEvent) => void): () => void {
    return this.api.onOAuthConnected(callback);
  }

  onOAuthFailed(callback: (event: OAuthFailedEvent) => void): () => void {
    return this.api.onOAuthFailed(callback);
  }

  async saveConfiguration(
    extensionId: string,
    values: Record<string, string | number | boolean>,
  ): Promise<{
    configuration: ExtensionConfiguration;
    oauth: OAuthState | null;
  }> {
    const result = await this.api.setConfigValues(extensionId, values);
    if (!result.success) throw new Error(result.error);

    const [configuration, oauth] = await Promise.all([
      this.loadConfiguration(extensionId),
      this.getOAuthState(extensionId),
    ]);
    return { configuration, oauth };
  }

  startOAuth(extensionId: string): Promise<OperationResult> {
    return this.api.startOAuthFlow(extensionId);
  }

  disconnectOAuth(extensionId: string): Promise<OperationResult> {
    return this.api.disconnectOAuth(extensionId);
  }
}
