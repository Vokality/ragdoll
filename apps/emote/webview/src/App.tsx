import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  RagdollCharacter,
  CharacterController,
  PomodoroTimer,
  TaskDrawer,
  getTheme,
  getDefaultTheme,
} from "@vokality/ragdoll";
import type { RagdollTheme, SpeechBubbleState } from "@vokality/ragdoll";
import { SpeechBubble } from "./components/speech-bubble";
import { StatusOverlay } from "./components/status-overlay";
import type { ExtensionMessage, VSCodeAPI } from "./types";

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
    case "startPomodoro":
    case "pausePomodoro":
    case "resetPomodoro":
      return true;
    case "addTask":
      return typeof payload.text === "string";
    case "updateTaskStatus":
      return typeof payload.taskId === "string" && typeof payload.status === "string";
    case "setActiveTask":
    case "removeTask":
      return typeof payload.taskId === "string";
    case "completeActiveTask":
    case "clearCompletedTasks":
    case "clearAllTasks":
    case "expandTasks":
    case "collapseTasks":
    case "toggleTasks":
      return true;
    default:
      return false;
  }
}

export function App() {
  const persistedState = useMemo(
    () => (vscode?.getState() as PersistedState | undefined) ?? undefined,
    []
  );
  const [controller, setController] = useState<CharacterController | null>(null);
  const [theme, setTheme] = useState<RagdollTheme>(() => getThemeSafe(persistedState?.themeId));
  const [bubbleState, setBubbleState] = useState<SpeechBubbleState>(
    () => persistedState?.bubble ?? FALLBACK_BUBBLE
  );
  const [hasReceivedMessage, setHasReceivedMessage] = useState<boolean>(Boolean(persistedState));

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
          ctrl.setHeadPose({ yaw: message.yaw, pitch: message.pitch }, message.duration);
          break;
        case "setSpeechBubble":
          setBubbleState({
            text: message.text,
            tone: message.tone ?? "default",
          });
          ctrl.setSpeechBubble({
            text: message.text,
            tone: message.tone ?? "default",
          });
          break;
        case "setTheme": {
          const newTheme = getThemeSafe(message.themeId);
          setTheme(newTheme);
          ctrl.setTheme(newTheme.id);
          break;
        }
        case "startPomodoro":
          ctrl.startPomodoro(message.sessionDuration, message.breakDuration);
          break;
        case "pausePomodoro":
          ctrl.pausePomodoro();
          break;
        case "resetPomodoro":
          ctrl.resetPomodoro();
          break;
        case "addTask":
          ctrl.addTask(message.text, message.status);
          break;
        case "updateTaskStatus":
          ctrl.updateTaskStatus(message.taskId, message.status, message.blockedReason);
          break;
        case "setActiveTask":
          ctrl.setActiveTask(message.taskId);
          break;
        case "removeTask":
          ctrl.removeTask(message.taskId);
          break;
        case "completeActiveTask":
          ctrl.completeActiveTask();
          break;
        case "clearCompletedTasks":
          ctrl.clearCompletedTasks();
          break;
        case "clearAllTasks":
          ctrl.clearAllTasks();
          break;
        case "expandTasks":
          ctrl.expandTasks();
          break;
        case "collapseTasks":
          ctrl.collapseTasks();
          break;
        case "toggleTasks":
          ctrl.toggleTasks();
          break;
        case "listTasks": {
          // Send current tasks back to extension
          const tasks = ctrl.getTasks();
          vscode?.postMessage({ type: "tasksUpdate", tasks });
          break;
        }
        case "getPomodoroState": {
          // Send current pomodoro state back to extension
          const pomodoroState = ctrl.getPomodoroState();
          vscode?.postMessage({
            type: "pomodoroStateUpdate",
            state: {
              state: pomodoroState.state,
              remainingTime: pomodoroState.remainingTime,
              isBreak: pomodoroState.isBreak,
              sessionDuration: pomodoroState.sessionDuration,
              breakDuration: pomodoroState.breakDuration,
              elapsedTime: pomodoroState.elapsedTime,
            },
          });
          break;
        }
        default:
          console.warn("Unknown message type:", message);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Send task updates whenever tasks change
  useEffect(() => {
    if (!controller) {
      return;
    }

    const taskController = controller.getTaskController();
    const unsubscribe = taskController.onUpdate((state) => {
      vscode?.postMessage({ type: "tasksUpdate", tasks: state.tasks });
    });

    // Send initial tasks
    const initialState = taskController.getState();
    vscode?.postMessage({ type: "tasksUpdate", tasks: initialState.tasks });

    return unsubscribe;
  }, [controller]);

  // Send pomodoro state updates whenever it changes
  useEffect(() => {
    if (!controller) {
      return;
    }

    const pomodoroController = controller.getPomodoroController();
    const unsubscribe = pomodoroController.onUpdate((state) => {
      vscode?.postMessage({
        type: "pomodoroStateUpdate",
        state: {
          state: state.state,
          remainingTime: state.remainingTime,
          isBreak: state.isBreak,
          sessionDuration: state.sessionDuration,
          breakDuration: state.breakDuration,
          elapsedTime: state.elapsedTime,
        },
      });
    });

    // Send initial state
    const initialState = pomodoroController.getState();
    vscode?.postMessage({
      type: "pomodoroStateUpdate",
      state: {
        state: initialState.state,
        remainingTime: initialState.remainingTime,
        isBreak: initialState.isBreak,
        sessionDuration: initialState.sessionDuration,
        breakDuration: initialState.breakDuration,
        elapsedTime: initialState.elapsedTime,
      },
    });

    return unsubscribe;
  }, [controller]);

  useEffect(() => {
    if (controller) {
      controller.setTheme(theme.id);
    }
  }, [controller, theme]);

  useEffect(() => {
    vscode?.setState({ themeId: theme.id, bubble: bubbleState });
  }, [theme, bubbleState]);

  const showOverlay = !hasReceivedMessage;
  const overlayVariant = controller ? "waiting" : "initial";

  return (
    <div style={styles.container}>
      {showOverlay && <StatusOverlay variant={overlayVariant} />}
      <div style={styles.characterContainer}>
        <RagdollCharacter
          key={theme.id}
          onControllerReady={handleControllerReady}
          theme={theme}
        />
      </div>
      {controller && (
        <PomodoroTimer controller={controller.getPomodoroController()} theme={theme} />
      )}
      {controller && (
        <TaskDrawer controller={controller.getTaskController()} theme={theme} />
      )}
      <SpeechBubble text={bubbleState.text} tone={bubbleState.tone} />
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




