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
  const [owner, setOwner] = useState({ extensionId, isOpen, service });
  if (
    owner.extensionId !== extensionId ||
    owner.isOpen !== isOpen ||
    owner.service !== service
  ) {
    setOwner({ extensionId, isOpen, service });
    setSchema(null);
    setStatus(null);
    setValues({});
    setOauth(null);
    setSaving(false);
    setError(null);
  }
  const loadVersion = useRef(0);
  const oauthVersion = useRef(0);
  const savingRef = useRef(false);
  const fieldVersions = useRef(new Map<string, number>());

  const loadOAuth = useCallback(async () => {
    const version = loadVersion.current;
    const request = ++oauthVersion.current;
    try {
      const next = await service.getOAuthState(extensionId);
      if (version === loadVersion.current && request === oauthVersion.current)
        setOauth(next);
    } catch (error) {
      if (version === loadVersion.current && request === oauthVersion.current)
        setError(getErrorMessage(error));
    }
  }, [extensionId, service]);

  useEffect(() => {
    if (!isOpen) return;

    const version = ++loadVersion.current;
    const oauthRequest = ++oauthVersion.current;
    savingRef.current = false;
    fieldVersions.current.clear();

    void (async () => {
      try {
        const [configuration, nextOAuth] = await Promise.all([
          hasConfig ? service.loadConfiguration(extensionId) : null,
          hasOAuth ? service.getOAuthState(extensionId) : null,
        ]);
        if (version !== loadVersion.current) return;
        setError(null);
        setSchema(configuration?.schema ?? null);
        setStatus(configuration?.status ?? null);
        setValues(configuration?.values ?? {});
        if (oauthRequest === oauthVersion.current) setOauth(nextOAuth);
      } catch (loadError) {
        if (version !== loadVersion.current) return;
        setError(getErrorMessage(loadError));
      }
    })();

    return () => {
      loadVersion.current += 1;
    };
  }, [extensionId, hasConfig, hasOAuth, isOpen, service]);

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
      fieldVersions.current.set(key, (fieldVersions.current.get(key) ?? 0) + 1);
      setValues((current) => ({ ...current, [key]: value }));
      setError(null);
    },
    [],
  );

  const save = useCallback(async () => {
    if (!schema || savingRef.current) return;
    const version = loadVersion.current;
    const savedFieldVersions = new Map(fieldVersions.current);
    const oauthRequest = oauthVersion.current;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const { configuration, oauth: nextOAuth } =
        await service.saveConfiguration(extensionId, values);
      if (version !== loadVersion.current) return;
      setSchema(configuration.schema);
      setStatus(configuration.status);
      const editedKeys = new Set(
        [...fieldVersions.current]
          .filter(([key, revision]) => revision !== savedFieldVersions.get(key))
          .map(([key]) => key),
      );
      setValues((current) => {
        const next = { ...configuration.values };
        for (const [key, value] of Object.entries(current)) {
          if (editedKeys.has(key)) next[key] = value;
        }
        return next;
      });
      if (oauthRequest === oauthVersion.current) setOauth(nextOAuth);
      if (configuration.status.isConfigured) onConfigured?.();
    } catch (saveError) {
      if (version === loadVersion.current) setError(getErrorMessage(saveError));
    } finally {
      if (version === loadVersion.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }, [extensionId, onConfigured, schema, service, values]);

  const connect = useCallback(async () => {
    const version = loadVersion.current;
    oauthVersion.current += 1;
    setError(null);
    setOauth((current) =>
      current ? { ...current, status: "connecting" } : current,
    );
    try {
      await service.startOAuth(extensionId);
    } catch (connectError) {
      if (version !== loadVersion.current) return;
      setError(getErrorMessage(connectError));
      await loadOAuth();
    }
  }, [extensionId, loadOAuth, service]);

  const disconnect = useCallback(async () => {
    const version = loadVersion.current;
    try {
      await service.disconnectOAuth(extensionId);
      if (version === loadVersion.current) await loadOAuth();
    } catch (disconnectError) {
      if (version === loadVersion.current)
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
