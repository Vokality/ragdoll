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

type ExtensionOperation = "update" | "uninstall";

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
  const installPending = useRef(false);
  const installUrlVersion = useRef(0);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const operations = useRef(new Map<string, ExtensionOperation>());
  const [pendingOperations, setPendingOperations] = useState<
    ReadonlyMap<string, ExtensionOperation>
  >(() => new Map());
  const refreshGeneration = useRef(0);

  const beginOperation = useCallback(
    (id: string, operation: ExtensionOperation) => {
      if (operations.current.has(id)) return false;
      operations.current.set(id, operation);
      setPendingOperations(new Map(operations.current));
      return true;
    },
    [],
  );

  const finishOperation = useCallback((id: string) => {
    operations.current.delete(id);
    setPendingOperations(new Map(operations.current));
  }, []);

  const applyOverview = useCallback(
    (
      generation: number,
      overview: Awaited<ReturnType<ExtensionManagementService["loadOverview"]>>,
    ) => {
      if (generation !== refreshGeneration.current) return;
      setAvailable(overview.available);
      setBuiltIn(overview.builtIn);
      setConfigurable(overview.configurable);
      setDisabled(overview.disabled);
      setInstalled(overview.installed);
    },
    [],
  );

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    try {
      const overview = await service.loadOverview();
      applyOverview(generation, overview);
    } catch (error) {
      if (generation !== refreshGeneration.current) return;
      setNotice({ tone: "error", text: getErrorMessage(error) });
    }
  }, [applyOverview, service]);

  useEffect(() => {
    if (!isOpen) return;

    const generation = ++refreshGeneration.current;

    void (async () => {
      try {
        const overview = await service.loadOverview();
        applyOverview(generation, overview);
      } catch (error) {
        if (generation !== refreshGeneration.current) return;
        setNotice({ tone: "error", text: getErrorMessage(error) });
      }
    })();

    return () => {
      refreshGeneration.current += 1;
    };
  }, [applyOverview, isOpen, service]);

  const install = useCallback(async () => {
    const url = installUrl.trim();
    if (!url || installPending.current) return;
    installPending.current = true;
    const submittedVersion = installUrlVersion.current;
    setIsInstalling(true);
    setNotice(null);
    try {
      const result = await service.install(url);
      if (!result.success) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      if (installUrlVersion.current === submittedVersion) setInstallUrl("");
      if (result.requiresConfiguration && result.message) {
        setNotice({ tone: "info", text: result.message });
      }
      await refresh();
    } catch (error) {
      setNotice({ tone: "error", text: getErrorMessage(error) });
    } finally {
      installPending.current = false;
      setIsInstalling(false);
    }
  }, [installUrl, refresh, service]);

  const uninstall = useCallback(
    async (extensionId: string) => {
      if (!beginOperation(extensionId, "uninstall")) return;
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
        finishOperation(extensionId);
      }
    },
    [beginOperation, finishOperation, refresh, service],
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
      if (!beginOperation(extensionId, "update")) return;
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
        finishOperation(extensionId);
      }
    },
    [beginOperation, finishOperation, refresh, service],
  );

  const toggle = useCallback(
    async (extensionId: string) => {
      const generation = ++refreshGeneration.current;
      try {
        const next = await service.toggle(extensionId);
        if (generation === refreshGeneration.current) setDisabled(next);
      } catch (error) {
        if (generation !== refreshGeneration.current) return;
        setNotice({ tone: "error", text: getErrorMessage(error) });
        await refresh();
      }
    },
    [refresh, service],
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
    pendingOperations,
    setInstallUrl: (value: string) => {
      installUrlVersion.current += 1;
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
