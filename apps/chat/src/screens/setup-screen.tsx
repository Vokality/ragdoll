import { Icon } from "../components/ui/icons";
import { Field } from "../components/ui/field";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/input";
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type CSSProperties,
} from "react";
import {
  RagdollCharacter,
  CharacterController,
  getDefaultTheme,
} from "@vokality/ragdoll";
import type { ModelProviderInfo } from "../../electron/electron-api";
import { useTimedConfirm } from "../hooks/use-timed-confirm";
import { ApiKeyInput } from "../components/api-key-input";
import type { SetupService } from "../application/setup-service";
import { isApplePlatform } from "../platform";

interface SetupScreenProps {
  onComplete: () => void;
  service: SetupService;
  reportError: (error: unknown) => void;
}

export function SetupScreen({
  onComplete,
  service,
  reportError,
}: SetupScreenProps) {
  const controller = useRef<CharacterController | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [providers, setProviders] = useState<ModelProviderInfo[]>([]);
  const [provider, setProvider] = useState<ModelProviderInfo | null>(null);
  useEffect(() => {
    let active = true;
    void service
      .listProviders()
      .then((items) => {
        if (!active) return;
        setProviders(items);
        setProvider(items.find((item) => item.selected) ?? items[0] ?? null);
      })
      .catch((error: unknown) => {
        if (active)
          setError(
            error instanceof Error ? error.message : "Could not load providers",
          );
      });
    return () => {
      active = false;
    };
  }, [service]);

  const removeConfirm = useTimedConfirm();
  const theme = getDefaultTheme();

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    controller.current = ctrl;
    ctrl.setMood("smile", 0.5);
  }, []);

  const handleSubmit = async (key: string) => {
    if (!provider) return;
    setIsLoading(true);
    setError(null);

    controller.current?.setMood("thinking", 0.3);

    try {
      const result = await service.configureApiKey(provider.id, key);

      if (!result.success) {
        setError(result.error);
        controller.current?.setMood("sad", 0.3);
        return;
      }

      controller.current?.setMood("laugh", 0.3);
      controller.current?.triggerAction("wink", 0.5);
      onComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : "API key setup failed");
      controller.current?.setMood("sad", 0.3);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!provider) return;
    if (!removeConfirm.isArmed) {
      removeConfirm.arm();
      return;
    }
    removeConfirm.disarm();
    setIsLoading(true);
    setError(null);
    try {
      const result = await service.clearKey(provider.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const items = await service.listProviders();
      setProviders(items);
      setProvider(items.find((item) => item.id === provider.id) ?? null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not remove key");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSaved = async () => {
    if (!provider) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await service.selectProvider(provider.id);
      if (result.success) onComplete();
      else setError(result.error);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not select provider",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPlatform = async () => {
    if (!provider) return;
    try {
      const result = await service.openApiKeyPage(provider);
      if (!result.success) setError(result.error);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not open the API key page",
      );
    }
  };

  return (
    <div style={styles.container}>
      {/* Drag region for window */}
      <div style={styles.dragRegion} className="drag-region" />

      {/* Ambient background effects */}
      <div className="app-atmosphere" />
      <div className="ambient-glow" />

      {/* Character */}
      <div style={styles.characterContainer} className="enter-1">
        <RagdollCharacter
          onControllerReady={handleControllerReady}
          onEventSubscriberError={reportError}
          theme={theme}
          variant="human"
        />
      </div>

      {/* Setup card */}
      <div style={styles.card} className="card enter-2">
        <h1 style={styles.title}>Meet Lumen</h1>
        <p style={styles.subtitle}>
          Your expressive assistant. Choose a provider to get started.
        </p>

        <Field
          label="Provider"
          style={{ display: "grid", gap: 8, marginBottom: 16 }}
        >
          {(control) => (
            <Select
              {...control}
              aria-label="Provider"
              value={provider?.id ?? ""}
              disabled={isLoading || !provider}
              onChange={(event) => {
                const selected = providers.find(
                  (item) => item.id === event.target.value,
                );
                if (selected) {
                  setProvider(selected);
                  setError(null);
                  removeConfirm.disarm();
                }
              }}
            >
              {providers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.model}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {provider?.configured && (
          <Button
            variant="primary"
            style={{ width: "100%", marginBottom: 16 }}
            disabled={isLoading}
            onClick={handleSelectSaved}
          >
            Use saved {provider.name} key
          </Button>
        )}
        {provider ? (
          <ApiKeyInput
            key={provider.id}
            providerName={provider.name}
            keyPlaceholder={provider.keyPlaceholder}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            error={error}
          />
        ) : (
          <p role={error ? "alert" : "status"}>
            {error ?? "Loading providers…"}
          </p>
        )}
        {provider?.configured && (
          <Button
            variant={removeConfirm.isArmed ? "danger" : "ghost"}
            style={{ width: "100%", marginTop: 12 }}
            disabled={isLoading}
            onClick={handleRemoveKey}
          >
            {removeConfirm.isArmed
              ? `Remove ${provider.name} key?`
              : `Remove saved ${provider.name} key`}
          </Button>
        )}
        {providers.some((item) => item.selected && item.configured) && (
          <Button
            variant="ghost"
            style={{ width: "100%", marginTop: 12 }}
            disabled={isLoading}
            onClick={onComplete}
          >
            Back to chat
          </Button>
        )}
      </div>

      {/* Help link */}
      <Button
        variant="ghost"
        onClick={handleOpenPlatform}
        style={styles.helpLink}
        className="no-drag enter-3"
      >
        <Icon name="key" size={16} />
        Get a {provider?.name ?? "provider"} API key
        <Icon name="external" size={12} />
      </Button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "safe center",
    height: "100%",
    width: "100%",
    padding: isApplePlatform() ? "36px 20px 20px" : "20px",
    background: "var(--bg-primary)",
    position: "relative",
    overflowY: "auto",
    overflowX: "hidden",
  },
  dragRegion: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "32px",
  },
  characterContainer: {
    width: "240px",
    height: "clamp(140px, 26vh, 220px)",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "12px",
    position: "relative",
    zIndex: 1,
  },
  card: {
    width: "100%",
    maxWidth: "360px",
    padding: "22px",
    flexShrink: 0,
    position: "relative",
    zIndex: 1,
  },
  title: {
    fontSize: "22px",
    fontWeight: "600",
    letterSpacing: "-0.02em",
    color: "var(--text-primary)",
    margin: "0 0 8px 0",
    textAlign: "center",
  },
  subtitle: {
    fontSize: "14px",
    color: "var(--text-muted)",
    margin: "0 0 18px 0",
    textAlign: "center",
  },
  helpLink: {
    marginTop: "16px",
    fontSize: "13px",
    position: "relative",
    zIndex: 1,
  },
};
