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
  builtIn: ExtensionInfo[];
  configurable: ExtensionInfo[];
  disabled: string[];
  installed: InstalledExtension[];
}

export interface ExtensionConfiguration {
  schema: ConfigSchema;
  status: ExtensionConfigStatus;
  values: Record<string, ExtensionConfigValue>;
}

export type ExtensionConfigValue = string | number | boolean | undefined;

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
  private toggleQueue: Promise<void> = Promise.resolve();
  constructor(private readonly api: ExtensionManagementGateway) {}

  async loadOverview(): Promise<ExtensionOverview> {
    await this.toggleQueue;
    const [available, disabled, installed] = await Promise.all([
      this.api.getDiscoveredExtensions(),
      this.api.getDisabledExtensions(),
      this.api.getUserInstalledExtensions(),
    ]);
    const installedIds = new Set(installed.map(({ id }) => id));
    const builtIn = available.filter(({ id }) => !installedIds.has(id));
    const configurable = builtIn.filter(
      ({ hasConfigSchema, hasOAuth }) => hasConfigSchema || hasOAuth,
    );
    return { available, builtIn, configurable, disabled, installed };
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

  toggle(extensionId: string): Promise<string[]> {
    const operation = this.toggleQueue.then(async () => {
      const disabled = await this.api.getDisabledExtensions();
      const next = disabled.includes(extensionId)
        ? disabled.filter((id) => id !== extensionId)
        : [...disabled, extensionId];
      const result = await this.api.setDisabledExtensions(next);
      if (!result.success) throw new Error(result.error);
      return next;
    });
    this.toggleQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async loadConfiguration(
    extensionId: string,
  ): Promise<ExtensionConfiguration> {
    const [schema, status] = await Promise.all([
      this.api.getConfigSchema(extensionId),
      this.api.getConfigStatus(extensionId),
    ]);
    if (!schema || !status) {
      throw new Error(`Configuration is unavailable for ${extensionId}`);
    }
    return {
      schema,
      status,
      values: this.getEditableValues(schema, status),
    };
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
    values: Record<string, ExtensionConfigValue>,
  ): Promise<{
    configuration: ExtensionConfiguration;
    oauth: OAuthState | null;
  }> {
    const result = await this.api.setConfigValues(
      extensionId,
      this.getPersistedValues(values),
    );
    if (!result.success) throw new Error(result.error);

    const [configuration, oauth] = await Promise.all([
      this.loadConfiguration(extensionId),
      this.getOAuthState(extensionId),
    ]);
    return { configuration, oauth };
  }

  async startOAuth(extensionId: string): Promise<void> {
    const result = await this.api.startOAuthFlow(extensionId);
    if (!result.success) throw new Error(result.error);
  }

  async disconnectOAuth(extensionId: string): Promise<void> {
    const result = await this.api.disconnectOAuth(extensionId);
    if (!result.success) throw new Error(result.error);
  }

  private getEditableValues(
    schema: ConfigSchema,
    status: ExtensionConfigStatus,
  ): Record<string, ExtensionConfigValue> {
    const values: Record<string, ExtensionConfigValue> = {};
    for (const [key, value] of Object.entries(status.values)) {
      const field = schema[key];
      if (field && "secret" in field && field.secret) continue;
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        values[key] = value;
      }
    }
    return values;
  }

  private getPersistedValues(
    values: Record<string, ExtensionConfigValue>,
  ): Record<string, string | number | boolean> {
    const persisted: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value !== "" && value !== undefined) persisted[key] = value;
    }
    return persisted;
  }
}
