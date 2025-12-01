import { useState, useCallback, useEffect, type CSSProperties } from "react";
import {
  RagdollCharacter,
  CharacterController,
  PomodoroTimer,
  TaskDrawer,
  getTheme,
  getDefaultTheme,
} from "@vokality/ragdoll";
import type { RagdollTheme } from "@vokality/ragdoll";
import { SpeechBubble } from "./speech-bubble";

interface CharacterViewProps {
  speechText: string | null;
  isStreaming?: boolean;
  themeId?: string;
  variantId?: string;
  onControllerReady?: (controller: CharacterController) => void;
}

export function CharacterView({
  speechText,
  isStreaming,
  themeId = "default",
  variantId = "human",
  onControllerReady,
}: CharacterViewProps) {
  const [controller, setController] = useState<CharacterController | null>(null);
  const [theme, setTheme] = useState<RagdollTheme>(() => getTheme(themeId) ?? getDefaultTheme());

  // Update theme when themeId changes
  useEffect(() => {
    const newTheme = getTheme(themeId) ?? getDefaultTheme();
    setTheme(newTheme);
    if (controller) {
      controller.setTheme(themeId);
    }
  }, [themeId, controller]);

  const handleControllerReady = useCallback(
    (ctrl: CharacterController) => {
      setController(ctrl);
      onControllerReady?.(ctrl);
    },
    [onControllerReady]
  );

  return (
    <div style={styles.container}>
      {/* Character */}
      <div style={styles.characterWrapper}>
        <RagdollCharacter
          key={`${themeId}-${variantId}`}
          onControllerReady={handleControllerReady}
          theme={theme}
          variant={variantId}
        />
      </div>

      {/* Speech bubble - below the character */}
      <SpeechBubble text={speechText} isStreaming={isStreaming} theme={theme} />

      {/* Pomodoro timer */}
      {controller && (
        <div style={styles.pomodoroWrapper}>
          <PomodoroTimer controller={controller.getPomodoroController()} theme={theme} />
        </div>
      )}

      {/* Task drawer */}
      {controller && (
        <div style={styles.taskWrapper}>
          <TaskDrawer controller={controller.getTaskController()} theme={theme} />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
    position: "relative",
    padding: "20px 20px 20px",
    overflow: "auto",
  },
  characterWrapper: {
    width: "300px",
    height: "300px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pomodoroWrapper: {
    marginTop: "8px",
    width: "100%",
    maxWidth: "260px",
  },
  taskWrapper: {
    marginTop: "12px",
    width: "100%",
    maxWidth: "280px",
  },
};

