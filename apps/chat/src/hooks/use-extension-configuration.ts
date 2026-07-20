import { useCallback, useEffect, useRef, useState } from "react";
import type { ConfigSchema } from "@vokality/ragdoll-extensions";
import type {
  ExtensionConfigStatus,
  OAuthState,
} from "../../electron/electron-api";
import type {
  ExtensionConfigValue,
  ExtensionManagementService,
} from "../application/extension-management-service";

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
  const [values, setValues] = useState<Record<string, ExtensionConfigValue>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadVersion = useRef(0);

  const loadOAuth = useCallback(async () => {
    setOauth(await service.getOAuthState(extensionId));
  }, [extensionId, service]);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setError(null);
    try {
      const [configuration, nextOAuth] = await Promise.all([
        hasConfig ? service.loadConfiguration(extensionId) : null,
        hasOAuth ? service.getOAuthState(extensionId) : null,
      ]);
      if (version !== loadVersion.current) return;
      setSchema(configuration?.schema ?? null);
      setStatus(configuration?.status ?? null);
      setValues(configuration?.values ?? {});
      setOauth(nextOAuth);
    } catch (loadError) {
      if (version !== loadVersion.current) return;
      setError(getErrorMessage(loadError));
    }
  }, [extensionId, hasConfig, hasOAuth, service]);

  useEffect(() => {
    if (isOpen) void load();
    return () => {
      loadVersion.current += 1;
    };
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen || !hasOAuth) return;
    const unsubscribeConnected = service.onOAuthConnected((event) => {
      if (event.extensionId === extensionId) void loadOAuth();
    });
    const unsubscribeFailed = service.onOAuthFailed((event) => {
      if (event.extensionId !== extensionId) return;
      setError(event.error);
      void loadOAuth();
    });
    return () => {
      unsubscribeConnected();
      unsubscribeFailed();
    };
  }, [extensionId, hasOAuth, isOpen, loadOAuth, service]);

  const changeValue = useCallback(
    (key: string, value: ExtensionConfigValue) => {
      setValues((current) => ({ ...current, [key]: value }));
      setError(null);
    },
    [],
  );

  const save = useCallback(async () => {
    if (!schema) return;
    setSaving(true);
    setError(null);
    try {
      const { configuration, oauth: nextOAuth } =
        await service.saveConfiguration(extensionId, values);
      setSchema(configuration.schema);
      setStatus(configuration.status);
      setValues(configuration.values);
      setOauth(nextOAuth);
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
      await service.startOAuth(extensionId);
    } catch (connectError) {
      setError(getErrorMessage(connectError));
      await loadOAuth();
    }
  }, [extensionId, loadOAuth, service]);

  const disconnect = useCallback(async () => {
    try {
      await service.disconnectOAuth(extensionId);
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
