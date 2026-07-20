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
