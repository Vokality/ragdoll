import { useCallback, type CSSProperties } from "react";
import {
  RagdollCharacter,
  CharacterController,
  getTheme,
} from "@vokality/ragdoll";
import { ConversationBubbles } from "./conversation-bubbles";
import type {
  CharacterThemeId,
  CharacterVariantId,
} from "../../electron/electron-api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CharacterViewProps {
  messages: Message[];
  isStreaming: boolean;
  themeId: CharacterThemeId;
  variantId: CharacterVariantId;
  onControllerReady: (controller: CharacterController) => void;
  onEventSubscriberError: (error: unknown) => void;
}

export function CharacterView({
  messages,
  isStreaming,
  themeId,
  variantId,
  onControllerReady,
  onEventSubscriberError,
}: CharacterViewProps) {
  const theme = getTheme(themeId);

  const handleControllerReady = useCallback(
    (ctrl: CharacterController) => {
      onControllerReady(ctrl);
    },
    [onControllerReady],
  );

  return (
    <div style={styles.container}>
      {/* Ambient glow that breathes behind the character */}
      <div className="ambient-glow" style={styles.glow} />

      {/* Character */}
      <div style={styles.characterWrapper}>
        <RagdollCharacter
          key={`${themeId}-${variantId}`}
          onControllerReady={handleControllerReady}
          onEventSubscriberError={onEventSubscriberError}
          theme={theme}
          variant={variantId}
        />
      </div>

      {/* Conversation bubbles - below the character */}
      <ConversationBubbles messages={messages} isStreaming={isStreaming} />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  // The character stays pinned; ConversationBubbles scrolls in the
  // remaining space.
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
    minHeight: 0,
    position: "relative",
    padding: "20px 20px 0",
    overflow: "hidden",
  },
  glow: {
    top: "170px",
    width: "420px",
    height: "420px",
  },
  characterWrapper: {
    width: "300px",
    height: "300px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    position: "relative",
    zIndex: 1,
  },
};
