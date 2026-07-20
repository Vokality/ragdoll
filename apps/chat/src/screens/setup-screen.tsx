import { useState, useCallback, useRef, type CSSProperties } from "react";
import {
  RagdollCharacter,
  CharacterController,
  getDefaultTheme,
} from "@vokality/ragdoll";
import { ApiKeyInput } from "../components/api-key-input";
import type { SetupService } from "../application/setup-service";

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

  const theme = getDefaultTheme();

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    controller.current = ctrl;
    ctrl.setMood("smile", 0.5);
  }, []);

  const handleSubmit = async (key: string) => {
    setIsLoading(true);
    setError(null);

    controller.current?.setMood("thinking", 0.3);

    try {
      const result = await service.configureApiKey(key);

      if (!result.success) {
        setError(result.error);
        controller.current?.setMood("sad", 0.3);
        setIsLoading(false);
        return;
      }

      controller.current?.setMood("laugh", 0.3);
      controller.current?.triggerAction("wink", 0.5);
      onComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : "API key setup failed");
      controller.current?.setMood("sad", 0.3);
      setIsLoading(false);
    }
  };

  const handleOpenPlatform = async () => {
    try {
      const result = await service.openApiKeyPage();
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

      {/* Ambient background effect */}
      <div style={styles.ambientGlow} />

      {/* Character */}
      <div style={styles.characterContainer}>
        <RagdollCharacter
          onControllerReady={handleControllerReady}
          onEventSubscriberError={reportError}
          theme={theme}
          variant="human"
        />
      </div>

      {/* Setup card */}
      <div style={styles.card} className="card animate-slideUp">
        <h1 style={styles.title}>Meet Lumen</h1>
        <p style={styles.subtitle}>
          Your expressive assistant. Enter your OpenAI API key to get started.
        </p>

        <ApiKeyInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          error={error}
        />
      </div>

      {/* Help link */}
      <button
        onClick={handleOpenPlatform}
        style={styles.helpLink}
        className="no-drag"
      >
        <KeyIcon />
        Get an API key from platform.openai.com
        <ExternalIcon />
      </button>
    </div>
  );
}

function KeyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
    padding: "24px",
    background: "var(--bg-primary)",
    position: "relative",
    overflow: "hidden",
  },
  dragRegion: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "32px",
  },
  ambientGlow: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "600px",
    height: "600px",
    background:
      "radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)",
    pointerEvents: "none",
    opacity: 0.5,
  },
  characterContainer: {
    width: "280px",
    height: "320px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "24px",
    position: "relative",
    zIndex: 1,
  },
  card: {
    width: "100%",
    maxWidth: "360px",
    padding: "32px",
    position: "relative",
    zIndex: 1,
  },
  title: {
    fontSize: "22px",
    fontWeight: "600",
    color: "var(--text-primary)",
    margin: "0 0 8px 0",
    textAlign: "center",
  },
  subtitle: {
    fontSize: "14px",
    color: "var(--text-muted)",
    margin: "0 0 24px 0",
    textAlign: "center",
  },
  helpLink: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "24px",
    padding: "12px 16px",
    color: "var(--text-dim)",
    fontSize: "13px",
    background: "var(--bg-glass)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    transition:
      "color var(--transition-fast), border-color var(--transition-fast)",
    position: "relative",
    zIndex: 1,
  },
};
