import { useState, useCallback, useEffect, useRef } from "react";
import {
  RagdollCharacter,
  CharacterController,
  getTheme,
  getDefaultTheme,
} from "@vokality/ragdoll";
import type { RagdollTheme, SpeechBubbleState } from "@vokality/ragdoll";
import { SpeechBubble } from "./components/speech-bubble";
import type { ExtensionMessage, VSCodeAPI } from "./types";

// Get VS Code API (only available in webview context)
let vscode: VSCodeAPI | null = null;
try {
  vscode = acquireVsCodeApi();
} catch {
  // Running outside VS Code (for development)
  console.log("Running outside VS Code context");
}

export function App() {
  const [controller, setController] = useState<CharacterController | null>(null);
  const [theme, setTheme] = useState<RagdollTheme>(() => getDefaultTheme());
  const [bubbleState, setBubbleState] = useState<SpeechBubbleState>({
    text: null,
    tone: "default",
  });
  
  const controllerRef = useRef<CharacterController | null>(null);

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    setController(ctrl);
    controllerRef.current = ctrl;
    // Notify extension that webview is ready
    vscode?.postMessage({ type: "ready" });
  }, []);

  // Handle messages from VS Code extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;
      const ctrl = controllerRef.current;

      if (!ctrl) {
        console.warn("Controller not ready, ignoring message:", message.type);
        return;
      }

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
          break;

        case "setTheme": {
          const newTheme = getTheme(message.themeId);
          setTheme(newTheme);
          ctrl.setTheme(message.themeId);
          break;
        }

        default:
          console.warn("Unknown message type:", message);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Update theme on controller when it changes
  useEffect(() => {
    if (controller && theme) {
      controller.setTheme(theme.id);
    }
  }, [controller, theme]);

  return (
    <div style={styles.container}>
      <div style={styles.characterContainer}>
        <RagdollCharacter
          key={theme.id}
          onControllerReady={handleControllerReady}
          theme={theme}
        />
      </div>
      <SpeechBubble text={bubbleState.text} tone={bubbleState.tone} />
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
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




