import { useState, useCallback, useEffect, useRef } from "react";
import {
  RagdollCharacter,
  CharacterController,
  getTheme,
  getDefaultTheme,
  getDefaultVariant,
} from "@vokality/ragdoll";
import type { RagdollTheme } from "@vokality/ragdoll";
import { SpeechBubble } from "./components/speech-bubble";
import { StatusOverlay } from "./components/status-overlay";
import {
  VALID_ACTIONS,
  VALID_MOODS,
  VALID_THEMES,
  VALID_TONES,
  VALID_VARIANTS,
} from "../../src/types";
import type { BubbleTone, ExtensionMessage, VSCodeAPI } from "./types";

type SpeechBubbleState = { text: string | null; tone: BubbleTone };

const vscode: VSCodeAPI = acquireVsCodeApi();

type PersistedState = {
  themeId: string;
  variantId: string;
  bubble: SpeechBubbleState;
};

const EMPTY_BUBBLE: SpeechBubbleState = { text: null, tone: "default" };

function readPersistedState(): PersistedState | undefined {
  const value = vscode.getState();
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object") {
    throw new Error("Invalid persisted Emote webview state");
  }

  const state = value as Record<string, unknown>;
  if (
    !isAllowed(state.themeId, VALID_THEMES) ||
    !isAllowed(state.variantId, VALID_VARIANTS) ||
    !isSpeechBubbleState(state.bubble)
  ) {
    throw new Error("Invalid persisted Emote webview state");
  }

  return {
    themeId: state.themeId,
    variantId: state.variantId,
    bubble: state.bubble,
  };
}

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  switch (payload.type) {
    case "setMood":
      return (
        isAllowed(payload.mood, VALID_MOODS) &&
        isOptionalFiniteNumber(payload.duration)
      );
    case "triggerAction":
      return (
        isAllowed(payload.action, VALID_ACTIONS) &&
        isOptionalFiniteNumber(payload.duration)
      );
    case "clearAction":
      return true;
    case "setHeadPose":
      return (
        isOptionalFiniteNumber(payload.yaw) &&
        isOptionalFiniteNumber(payload.pitch) &&
        isOptionalFiniteNumber(payload.duration)
      );
    case "setSpeechBubble":
      return (
        (typeof payload.text === "string" || payload.text === null) &&
        isAllowed(payload.tone, VALID_TONES)
      );
    case "setTheme":
      return isAllowed(payload.themeId, VALID_THEMES);
    case "setVariant":
      return isAllowed(payload.variantId, VALID_VARIANTS);
    default:
      return false;
  }
}

function isAllowed<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function isOptionalFiniteNumber(value: unknown): boolean {
  return (
    value === undefined || (typeof value === "number" && Number.isFinite(value))
  );
}

function isSpeechBubbleState(value: unknown): value is SpeechBubbleState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const bubble = value as Record<string, unknown>;
  return (
    (typeof bubble.text === "string" || bubble.text === null) &&
    isAllowed(bubble.tone, VALID_TONES)
  );
}

export function App() {
  const [persistedState] = useState(readPersistedState);
  const [controller, setController] = useState<CharacterController | null>(
    null,
  );
  const [theme, setTheme] = useState<RagdollTheme>(() =>
    persistedState ? getTheme(persistedState.themeId) : getDefaultTheme(),
  );
  const [variant, setVariant] = useState<string>(
    () => persistedState?.variantId ?? getDefaultVariant().id,
  );
  const [bubbleState, setBubbleState] = useState<SpeechBubbleState>(
    () => persistedState?.bubble ?? EMPTY_BUBBLE,
  );
  const [hasReceivedMessage, setHasReceivedMessage] = useState<boolean>(
    Boolean(persistedState),
  );

  const controllerRef = useRef<CharacterController | null>(null);

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    setController(ctrl);
    controllerRef.current = ctrl;
    vscode.postMessage({ type: "ready" });
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
            tone: message.tone,
          });
          break;
        case "setTheme": {
          const newTheme = getTheme(message.themeId);
          setTheme(newTheme);
          ctrl.setTheme(newTheme.id);
          break;
        }
        case "setVariant":
          setVariant(message.variantId);
          break;
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
    vscode.setState({
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
          onEventSubscriberError={(error) => {
            console.error("Ragdoll event subscriber failed", error);
          }}
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
