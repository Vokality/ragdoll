import { useCallback, useEffect, useState } from "react";
import type { ConfigSchema } from "@vokality/ragdoll-extensions";
import type {
  ExtensionConfigStatus,
  OAuthState,
} from "../../electron/electron-api";
import type { ExtensionManagementService } from "../application/extension-management-service";

type ConfigValue = string | number | boolean | undefined;

export interface ExtensionConfigurationOptions {
  extensionId: string;
  hasConfig: boolean;
  hasOAuth: boolean;
  isOpen: boolean;
  onConfigured?: () => void;
}

export function useExtensionConfiguration(
  service: ExtensionManagementService,
  options: ExtensionConfigurationOptions,
) {
  const { extensionId, hasConfig, hasOAuth, isOpen, onConfigured } = options;
  const [status, setStatus] = useState<ExtensionConfigStatus | null>(null);
  const [schema, setSchema] = useState<ConfigSchema | null>(null);
  const [oauth, setOauth] = useState<OAuthState | null>(null);
  const [values, setValues] = useState<Record<string, ConfigValue>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOAuth = useCallback(async () => {
    setOauth(await service.getOAuthState(extensionId));
  }, [extensionId, service]);

  const load = useCallback(async () => {
    try {
      const [configuration] = await Promise.all([
        hasConfig ? service.loadConfiguration(extensionId) : null,
        hasOAuth ? loadOAuth() : undefined,
      ]);
      if (!configuration) return;

      setSchema(configuration.schema);
      setStatus(configuration.status);
      const loadedValues: Record<string, ConfigValue> = {};
      for (const [key, value] of Object.entries(configuration.status.values)) {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          loadedValues[key] = value;
        }
      }
      setValues(loadedValues);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }, [extensionId, hasConfig, hasOAuth, loadOAuth, service]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen || !hasOAuth) return;
    const unsubscribeSuccess = service.onOAuthSuccess((event) => {
      if (event.extensionId === extensionId) void loadOAuth();
    });
    const unsubscribeError = service.onOAuthError((event) => {
      if (event.extensionId !== extensionId) return;
      setError(event.error ?? "OAuth authentication failed");
      void loadOAuth();
    });
    return () => {
      unsubscribeSuccess();
      unsubscribeError();
    };
  }, [extensionId, hasOAuth, isOpen, loadOAuth, service]);

  const changeValue = useCallback((key: string, value: ConfigValue) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError(null);
  }, []);

  const save = useCallback(async () => {
    if (!schema) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        Object.entries(values).map(async ([key, value]) => {
          if (value === "" || value === undefined) return;
          const result = await service.setConfigValue(extensionId, key, value);
          if (!result.success) throw new Error(result.error);
        }),
      );
      const configuration = await service.loadConfiguration(extensionId);
      setStatus(configuration.status);
      if (configuration.status.isConfigured) onConfigured?.();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }, [extensionId, onConfigured, schema, service, values]);

  const connect = useCallback(async () => {
    setError(null);
    setOauth((current) =>
      current ? { ...current, status: "connecting" } : current,
    );
    try {
      const result = await service.startOAuth(extensionId);
      if (!result.success) throw new Error(result.error);
    } catch (connectError) {
      setError(getErrorMessage(connectError));
      await loadOAuth();
    }
  }, [extensionId, loadOAuth, service]);

  const disconnect = useCallback(async () => {
    try {
      const result = await service.disconnectOAuth(extensionId);
      if (!result.success) throw new Error(result.error);
      await loadOAuth();
    } catch (disconnectError) {
      setError(getErrorMessage(disconnectError));
    }
  }, [extensionId, loadOAuth, service]);

  return {
    status,
    schema,
    oauth,
    values,
    saving,
    error,
    changeValue,
    save,
    connect,
    disconnect,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
