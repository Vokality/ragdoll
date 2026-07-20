import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ExtensionInfo,
  InstalledExtension,
  UpdateCheckResult,
} from "../../electron/electron-api";
import type { ExtensionManagementService } from "../application/extension-management-service";

export interface SettingsNotice {
  tone: "info" | "error";
  text: string;
}

export function useExtensionSettings(
  service: ExtensionManagementService,
  isOpen: boolean,
) {
  const [available, setAvailable] = useState<ExtensionInfo[]>([]);
  const [builtIn, setBuiltIn] = useState<ExtensionInfo[]>([]);
  const [configurable, setConfigurable] = useState<ExtensionInfo[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [installed, setInstalled] = useState<InstalledExtension[]>([]);
  const [updates, setUpdates] = useState<UpdateCheckResult[]>([]);
  const [installUrl, setInstallUrl] = useState("");
  const [notice, setNotice] = useState<SettingsNotice | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    try {
      const overview = await service.loadOverview();
      if (generation !== refreshGeneration.current) return;
      setAvailable(overview.available);
      setBuiltIn(overview.builtIn);
      setConfigurable(overview.configurable);
      setDisabled(overview.disabled);
      setInstalled(overview.installed);
    } catch (error) {
      if (generation !== refreshGeneration.current) return;
      setNotice({ tone: "error", text: getErrorMessage(error) });
    }
  }, [service]);

  useEffect(() => {
    if (isOpen) void refresh();
    return () => {
      refreshGeneration.current += 1;
    };
  }, [isOpen, refresh]);

  const install = useCallback(async () => {
    const url = installUrl.trim();
    if (!url) return;
    setIsInstalling(true);
    setNotice(null);
    try {
      const result = await service.install(url);
      if (!result.success) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      setInstallUrl("");
      if (result.requiresConfiguration && result.message) {
        setNotice({ tone: "info", text: result.message });
      }
      await refresh();
    } catch (error) {
      setNotice({ tone: "error", text: getErrorMessage(error) });
    } finally {
      setIsInstalling(false);
    }
  }, [installUrl, refresh, service]);

  const uninstall = useCallback(
    async (extensionId: string) => {
      setUninstallingId(extensionId);
      setNotice(null);
      try {
        const result = await service.uninstall(extensionId);
        if (!result.success) {
          setNotice({ tone: "error", text: result.error });
          return;
        }
        await refresh();
      } catch (error) {
        setNotice({ tone: "error", text: getErrorMessage(error) });
      } finally {
        setUninstallingId(null);
      }
    },
    [refresh, service],
  );

  const checkUpdates = useCallback(async () => {
    setIsCheckingUpdates(true);
    setNotice(null);
    try {
      setUpdates(await service.checkUpdates());
    } catch (error) {
      setNotice({ tone: "error", text: getErrorMessage(error) });
    } finally {
      setIsCheckingUpdates(false);
    }
  }, [service]);

  const update = useCallback(
    async (extensionId: string) => {
      setUpdatingId(extensionId);
      setNotice(null);
      try {
        const result = await service.update(extensionId);
        if (!result.success) {
          setNotice({ tone: "error", text: result.error });
          return;
        }
        setUpdates((current) =>
          current.filter((entry) => entry.extensionId !== extensionId),
        );
        if (result.requiresConfiguration && result.message) {
          setNotice({ tone: "info", text: result.message });
        }
        await refresh();
      } catch (error) {
        setNotice({ tone: "error", text: getErrorMessage(error) });
      } finally {
        setUpdatingId(null);
      }
    },
    [refresh, service],
  );

  const toggle = useCallback(
    async (extensionId: string) => {
      const next = disabled.includes(extensionId)
        ? disabled.filter((id) => id !== extensionId)
        : [...disabled, extensionId];
      try {
        await service.setDisabled(next);
        setDisabled(next);
      } catch (error) {
        setNotice({ tone: "error", text: getErrorMessage(error) });
      }
    },
    [disabled, service],
  );

  return {
    available,
    builtIn,
    configurable,
    disabled,
    installed,
    updates,
    installUrl,
    notice,
    isInstalling,
    isCheckingUpdates,
    updatingId,
    uninstallingId,
    setInstallUrl: (value: string) => {
      setInstallUrl(value);
      setNotice(null);
    },
    clearNotice: () => setNotice(null),
    refresh,
    install,
    uninstall,
    checkUpdates,
    update,
    toggle,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
