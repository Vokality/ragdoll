import { useState, useEffect, useCallback, type CSSProperties } from "react";
import {
  RagdollCharacter,
  CharacterController,
  getDefaultTheme,
} from "@vokality/ragdoll";

interface CoreExtensionStatus {
  id: string;
  name: string;
  status: "pending" | "installing" | "installed" | "failed" | "updating";
  version?: string;
  error?: string;
}

interface CoreSetupStatus {
  isComplete: boolean;
  isFirstRun: boolean;
  extensions: CoreExtensionStatus[];
  progress: number;
  currentOperation: string;
}

interface SetupExtensionsScreenProps {
  onComplete: () => void;
}

export function SetupExtensionsScreen({ onComplete }: SetupExtensionsScreenProps) {
  const [controller, setController] = useState<CharacterController | null>(null);
  const [status, setStatus] = useState<CoreSetupStatus>({
    isComplete: false,
    isFirstRun: true,
    extensions: [],
    progress: 0,
    currentOperation: "Preparing...",
  });
  const [hasStarted, setHasStarted] = useState(false);
  const [hasError, setHasError] = useState(false);

  const theme = getDefaultTheme();

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    setController(ctrl);
    ctrl.setMood("thinking", 0.3);
  }, []);

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = window.electronAPI.onCoreSetupProgress((newStatus) => {
      setStatus(newStatus);

      // Update character mood based on progress
      if (controller) {
        const hasFailures = newStatus.extensions.some((e) => e.status === "failed");
        if (hasFailures) {
          controller.setMood("sad", 0.3);
          setHasError(true);
        } else if (newStatus.isComplete) {
          controller.setMood("laugh", 0.5);
          controller.triggerAction("wink", 0.5);
        } else {
          controller.setMood("thinking", 0.3);
        }
      }
    });

    return unsubscribe;
  }, [controller]);

  // Start setup automatically when component mounts
  useEffect(() => {
    if (!hasStarted) {
      setHasStarted(true);
      runSetup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted]);

  const runSetup = async () => {
    try {
      const result = await window.electronAPI.runCoreSetup();
      setStatus(result);

      if (result.isComplete) {
        // Wait for animation, then proceed
        setTimeout(() => {
          onComplete();
        }, 1000);
      } else {
        setHasError(true);
      }
    } catch (error) {
      console.error("Setup failed:", error);
      setHasError(true);
      if (controller) {
        controller.setMood("sad", 0.4);
      }
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setStatus({
      ...status,
      extensions: status.extensions.map((e) =>
        e.status === "failed" ? { ...e, status: "pending", error: undefined } : e
      ),
      progress: 0,
      currentOperation: "Retrying...",
    });
    runSetup();
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
        <h1 style={styles.title}>Setting Up Lumen</h1>
        <p style={styles.subtitle}>{status.currentOperation}</p>

        {/* Progress bar */}
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${status.progress}%`,
              }}
            />
          </div>
          <span style={styles.progressText}>{status.progress}%</span>
        </div>

        {/* Extension list */}
        <div style={styles.extensionList}>
          {status.extensions.map((ext) => (
            <div key={ext.id} style={styles.extensionItem}>
              <StatusIcon status={ext.status} />
              <span style={styles.extensionName}>{ext.name}</span>
              {ext.version && (
                <span style={styles.extensionVersion}>v{ext.version}</span>
              )}
              {ext.error && (
                <span style={styles.extensionError}>{ext.error}</span>
              )}
            </div>
          ))}
        </div>

        {/* Retry button if there were errors */}
        {hasError && !status.isComplete && (
          <button onClick={handleRetry} style={styles.retryButton}>
            Retry Setup
          </button>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: CoreExtensionStatus["status"] }) {
  switch (status) {
    case "pending":
      return (
        <div style={styles.statusIcon}>
          <CircleIcon />
        </div>
      );
    case "installing":
    case "updating":
      return (
        <div style={{ ...styles.statusIcon, ...styles.statusSpinner }}>
          <SpinnerIcon />
        </div>
      );
    case "installed":
      return (
        <div style={{ ...styles.statusIcon, ...styles.statusSuccess }}>
          <CheckIcon />
        </div>
      );
    case "failed":
      return (
        <div style={{ ...styles.statusIcon, ...styles.statusError }}>
          <XIcon />
        </div>
      );
    default:
      return null;
  }
}

function CircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
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
    width: "240px",
    height: "280px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
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
  progressContainer: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "24px",
  },
  progressBar: {
    flex: 1,
    height: "8px",
    background: "var(--bg-glass)",
    borderRadius: "4px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "var(--accent)",
    borderRadius: "4px",
    transition: "width 0.3s ease-out",
  },
  progressText: {
    fontSize: "13px",
    fontWeight: "500",
    color: "var(--text-muted)",
    minWidth: "40px",
    textAlign: "right",
  },
  extensionList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  extensionItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    background: "var(--bg-glass)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)",
  },
  statusIcon: {
    width: "20px",
    height: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-dim)",
  },
  statusSpinner: {
    color: "var(--accent)",
    animation: "spin 1s linear infinite",
  },
  statusSuccess: {
    color: "var(--success, #22c55e)",
  },
  statusError: {
    color: "var(--error, #ef4444)",
  },
  extensionName: {
    flex: 1,
    fontSize: "14px",
    fontWeight: "500",
    color: "var(--text-primary)",
  },
  extensionVersion: {
    fontSize: "12px",
    color: "var(--text-dim)",
  },
  extensionError: {
    fontSize: "12px",
    color: "var(--error, #ef4444)",
  },
  retryButton: {
    width: "100%",
    marginTop: "24px",
    padding: "14px 24px",
    fontSize: "15px",
    fontWeight: "500",
    color: "var(--text-primary)",
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    transition: "opacity var(--transition-fast)",
  },
};
