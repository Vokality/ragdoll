import { useState, useCallback, type CSSProperties } from "react";
import {
  RagdollCharacter,
  CharacterController,
  getDefaultTheme,
} from "@vokality/ragdoll";
import { ApiKeyInput } from "../components/api-key-input";

interface SetupScreenProps {
  onComplete: () => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [controller, setController] = useState<CharacterController | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = getDefaultTheme();

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    setController(ctrl);
    // Set a welcoming mood
    ctrl.setMood("smile", 0.5);
  }, []);

  const handleSubmit = async (key: string) => {
    setIsLoading(true);
    setError(null);

    // Show thinking expression
    if (controller) {
      controller.setMood("thinking", 0.3);
    }

    try {
      // Validate the key with OpenAI
      const validation = await window.electronAPI.validateApiKey(key);

      if (!validation.valid) {
        setError(validation.error ?? "Invalid API key");
        if (controller) {
          controller.setMood("sad", 0.3);
        }
        setIsLoading(false);
        return;
      }

      // Store the key
      const result = await window.electronAPI.setApiKey(key);

      if (!result.success) {
        setError(result.error ?? "Failed to save API key");
        if (controller) {
          controller.setMood("sad", 0.3);
        }
        setIsLoading(false);
        return;
      }

      // Success!
      if (controller) {
        controller.setMood("laugh", 0.3);
        controller.triggerAction("wink", 0.5);
      }

      // Wait a moment for the animation, then proceed
      setTimeout(() => {
        onComplete();
      }, 800);
    } catch {
      setError("An unexpected error occurred");
      if (controller) {
        controller.setMood("sad", 0.3);
      }
      setIsLoading(false);
    }
  };

  const handleOpenPlatform = () => {
    // This will be handled by the main process to open external link
    window.open("https://platform.openai.com/api-keys", "_blank");
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
    background: "radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)",
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
    transition: "color var(--transition-fast), border-color var(--transition-fast)",
    position: "relative",
    zIndex: 1,
  },
};
