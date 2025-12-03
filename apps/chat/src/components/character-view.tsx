import { useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import {
  RagdollCharacter,
  CharacterController,
  PomodoroTimer,
  getTheme,
  getDefaultTheme,
} from "@vokality/ragdoll";
import type { RagdollTheme, TaskState } from "@vokality/ragdoll";
import { ConversationBubbles } from "./conversation-bubbles";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CharacterViewProps {
  messages: Message[];
  isStreaming?: boolean;
  themeId?: string;
  variantId?: string;
  onControllerReady?: (controller: CharacterController) => void;
  initialTaskState?: TaskState | null;
}

export function CharacterView({
  messages,
  isStreaming,
  themeId = "default",
  variantId = "human",
  onControllerReady,
  initialTaskState = null,
}: CharacterViewProps) {
  const [controller, setController] = useState<CharacterController | null>(null);
  const [theme, setTheme] = useState<RagdollTheme>(() => getTheme(themeId) ?? getDefaultTheme());
  const hasHydratedTasks = useRef(false);

  // Update theme when themeId changes
  useEffect(() => {
    const newTheme = getTheme(themeId) ?? getDefaultTheme();
    setTheme(newTheme);
    if (controller) {
      controller.setTheme(themeId);
    }
  }, [themeId, controller]);

  useEffect(() => {
    if (!controller || !initialTaskState || hasHydratedTasks.current) {
      return;
    }
    controller.loadTaskState(initialTaskState);
    hasHydratedTasks.current = true;
  }, [controller, initialTaskState]);

  useEffect(() => {
    if (!controller) {
      return;
    }
    const taskController = controller.getTaskController();
    const handleUpdate = (state: TaskState) => {
      window.electronAPI.saveTaskState(state).catch((error) => {
        console.error("Failed to persist tasks", error);
      });
    };
    const unsubscribe = taskController.onUpdate(handleUpdate);
    return unsubscribe;
  }, [controller]);

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

      {/* Conversation bubbles - below the character */}
      <ConversationBubbles
        messages={messages}
        isStreaming={isStreaming}
      />

      {/* Pomodoro timer */}
      {controller && (
        <div style={styles.pomodoroWrapper}>
          <PomodoroTimer controller={controller.getPomodoroController()} />
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
};
