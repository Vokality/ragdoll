import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  RagdollCharacter,
  CharacterController,
  getTheme,
  getDefaultTheme,
} from "@vokality/ragdoll";
import type { RagdollTheme } from "@vokality/ragdoll";
import { SpeechBubble } from "./components/speech-bubble";
import { StatusOverlay } from "./components/status-overlay";
import type { ExtensionMessage, VSCodeAPI } from "./types";

// TODO: Pomodoro and Tasks are now in @vokality/ragdoll-extensions
// They need to be managed via the extension host, not the CharacterController

type SpeechBubbleState = { text: string | null; tone: "default" | "whisper" | "shout" };

// Get VS Code API (only available in webview context)
let vscode: VSCodeAPI | null = null;
try {
  vscode = acquireVsCodeApi();
} catch {
  // Running outside VS Code (for development)
  console.log("Running outside VS Code context");
}

type PersistedState = {
  themeId: string;
  variantId: string;
  bubble: SpeechBubbleState;
};

const FALLBACK_BUBBLE: SpeechBubbleState = { text: null, tone: "default" };

function getThemeSafe(themeId?: string): RagdollTheme {
  try {
    if (themeId) {
      const resolved = getTheme(themeId);
      if (resolved) {
        return resolved;
      }
    }
  } catch {
    // Ignore and fall back.
  }
  return getDefaultTheme();
}

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  switch (payload.type) {
    case "setMood":
      return typeof payload.mood === "string";
    case "triggerAction":
      return typeof payload.action === "string";
    case "clearAction":
      return true;
    case "setHeadPose":
      return true;
    case "setSpeechBubble":
      return "text" in payload || "tone" in payload;
    case "setTheme":
      return typeof payload.themeId === "string";
    case "setVariant":
      return typeof payload.variantId === "string";
    // Task and Pomodoro messages are forwarded but not handled in UI yet
    case "startPomodoro":
    case "pausePomodoro":
    case "resetPomodoro":
    case "addTask":
    case "updateTaskStatus":
    case "setActiveTask":
    case "removeTask":
    case "completeActiveTask":
    case "clearCompletedTasks":
    case "clearAllTasks":
    case "expandTasks":
    case "collapseTasks":
    case "toggleTasks":
    case "listTasks":
    case "getPomodoroState":
      return true;
    default:
      return false;
  }
}

export function App() {
  const persistedState = useMemo(
    () => (vscode?.getState() as PersistedState | undefined) ?? undefined,
    [],
  );
  const [controller, setController] = useState<CharacterController | null>(
    null,
  );
  const [theme, setTheme] = useState<RagdollTheme>(() =>
    getThemeSafe(persistedState?.themeId),
  );
  const [variant, setVariant] = useState<string>(
    () => persistedState?.variantId ?? "human",
  );
  const [bubbleState, setBubbleState] = useState<SpeechBubbleState>(
    () => persistedState?.bubble ?? FALLBACK_BUBBLE,
  );
  const [hasReceivedMessage, setHasReceivedMessage] = useState<boolean>(
    Boolean(persistedState),
  );

  const controllerRef = useRef<CharacterController | null>(null);

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    setController(ctrl);
    controllerRef.current = ctrl;
    vscode?.postMessage({ type: "ready" });
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isExtensionMessage(event.data)) {
        console.warn("Ignoring message with unknown shape", event.data);
        return;
      }

      const message = event.data;
      const ctrl = controllerRef.current;

      if (!ctrl) {
        console.warn("Controller not ready, ignoring message:", message.type);
        return;
      }

      setHasReceivedMessage(true);
      switch (message.type) {
        case "setMood":
          ctrl.setMood(message.mood, message.duration);
          break;
        case "triggerAction":
          ctrl.triggerAction(message.action, message.duration);
          break;
        case "clearAction":
          ctrl.clearAction();
          break;
        case "setHeadPose":
          ctrl.setHeadPose(
            { yaw: message.yaw, pitch: message.pitch },
            message.duration,
          );
          break;
        case "setSpeechBubble":
          setBubbleState({
            text: message.text,
            tone: (message.tone ?? "default") as "default" | "whisper" | "shout",
          });
          break;
        case "setTheme": {
          const newTheme = getThemeSafe(message.themeId);
          setTheme(newTheme);
          ctrl.setTheme(newTheme.id);
          break;
        }
        case "setVariant":
          setVariant(message.variantId);
          break;
        // TODO: Handle task and pomodoro messages via extension system
        case "startPomodoro":
        case "pausePomodoro":
        case "resetPomodoro":
        case "addTask":
        case "updateTaskStatus":
        case "setActiveTask":
        case "removeTask":
        case "completeActiveTask":
        case "clearCompletedTasks":
        case "clearAllTasks":
        case "expandTasks":
        case "collapseTasks":
        case "toggleTasks":
        case "listTasks":
        case "getPomodoroState":
          console.log("Task/Pomodoro message received (not implemented yet):", message.type);
          break;
        default:
          console.warn("Unknown message type:", message);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (controller) {
      controller.setTheme(theme.id);
    }
  }, [controller, theme]);

  useEffect(() => {
    vscode?.setState({
      themeId: theme.id,
      variantId: variant,
      bubble: bubbleState,
    });
  }, [theme, variant, bubbleState]);

  const showOverlay = !hasReceivedMessage;
  const overlayVariant = controller ? "waiting" : "initial";

  return (
    <div style={styles.container}>
      {showOverlay && <StatusOverlay variant={overlayVariant} />}
      <div style={styles.characterContainer}>
        <RagdollCharacter
          key={`${theme.id}-${variant}`}
          onControllerReady={handleControllerReady}
          theme={theme}
          variant={variant}
        />
      </div>
      <SpeechBubble
        text={bubbleState.text}
        tone={bubbleState.tone}
        theme={theme}
      />
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--vscode-editor-background, #0f172a)",
    position: "relative" as const,
  },
  characterContainer: {
    width: "320px",
    height: "380px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
