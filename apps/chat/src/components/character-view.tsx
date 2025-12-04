import { useState, useCallback, useEffect, type CSSProperties } from "react";
import {
  RagdollCharacter,
  CharacterController,
  getTheme,
  getDefaultTheme,
} from "@vokality/ragdoll";
import type { RagdollTheme } from "@vokality/ragdoll";
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
}

export function CharacterView({
  messages,
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

      {/* Conversation bubbles - below the character */}
      <ConversationBubbles
        messages={messages}
        isStreaming={isStreaming}
      />
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
};
