import { describe, expect, it } from "bun:test";
import type {
  ExtensionConfigStatus,
  OAuthState,
  OperationResult,
} from "../../electron/electron-api";
import {
  ExtensionManagementService,
  type ExtensionManagementGateway,
} from "./extension-management-service";

describe("ExtensionManagementService", () => {
  it("derives built-in and configurable extension groups outside React", async () => {
    const service = new ExtensionManagementService(
      createGateway({
        getDiscoveredExtensions: async () => [
          {
            packageName: "@vokality/built-in",
            id: "built-in",
            name: "Built in",
            description: "Built in",
            canDisable: true,
            hasConfigSchema: true,
            hasOAuth: false,
          },
          {
            packageName: "@example/installed",
            id: "installed",
            name: "Installed",
            description: "Installed",
            canDisable: true,
            hasConfigSchema: false,
            hasOAuth: false,
          },
        ],
        getUserInstalledExtensions: async () => [
          {
            id: "installed",
            name: "Installed",
            version: "1.0.0",
            description: "Installed",
            path: "/extensions/installed",
            repoUrl: "https://github.com/example/installed",
            installedAt: "2026-07-19T00:00:00.000Z",
          },
        ],
      }),
    );

    const overview = await service.loadOverview();

    expect(overview.builtIn.map(({ id }) => id)).toEqual(["built-in"]);
    expect(overview.configurable.map(({ id }) => id)).toEqual(["built-in"]);
  });

  it("reloads configuration and OAuth state after saving configuration", async () => {
    const calls: string[] = [];
    const configurationStatus: ExtensionConfigStatus = {
      isConfigured: true,
      missingFields: [],
      values: { clientId: "new-client-id" },
    };
    const oauthState: OAuthState = {
      status: "disconnected",
      isAuthenticated: false,
    };
    const service = new ExtensionManagementService(
      createGateway({
        setConfigValues: async () => {
          calls.push("save");
          return { success: true };
        },
        getConfigSchema: async () => ({
          clientId: {
            type: "string",
            label: "Client ID",
            required: true,
          },
        }),
        getConfigStatus: async () => {
          calls.push("configuration");
          return configurationStatus;
        },
        getOAuthState: async () => {
          calls.push("oauth");
          return oauthState;
        },
      }),
    );

    const result = await service.saveConfiguration("spotify", {
      clientId: "new-client-id",
    });

    expect(calls[0]).toBe("save");
    expect(new Set(calls.slice(1))).toEqual(
      new Set(["configuration", "oauth"]),
    );
    expect(result).toEqual({
      configuration: {
        schema: {
          clientId: {
            type: "string",
            label: "Client ID",
            required: true,
          },
        },
        status: configurationStatus,
        values: { clientId: "new-client-id" },
      },
      oauth: oauthState,
    });
  });
});

function createGateway(
  overrides: Partial<ExtensionManagementGateway>,
): ExtensionManagementGateway {
  const success = async (): Promise<OperationResult> => ({ success: true });

  return {
    checkExtensionUpdates: async () => [],
    disconnectOAuth: success,
    getConfigSchema: async () => null,
    getConfigStatus: async () => null,
    getDisabledExtensions: async () => [],
    getDiscoveredExtensions: async () => [],
    getOAuthState: async () => null,
    getUserInstalledExtensions: async () => [],
    installExtensionFromGitHub: async () => ({
      success: false,
      error: "not implemented",
    }),
    onOAuthConnected: () => () => undefined,
    onOAuthFailed: () => () => undefined,
    setConfigValues: success,
    setDisabledExtensions: success,
    startOAuthFlow: success,
    uninstallExtension: success,
    updateExtension: async () => ({
      success: false,
      error: "not implemented",
    }),
    ...overrides,
  };
}
