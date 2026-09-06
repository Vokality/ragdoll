import { useCallback, type CSSProperties } from "react";
import {
  RagdollCharacter,
  CharacterController,
  getTheme,
} from "@vokality/ragdoll";
import {
  InlineSlotPanel,
  type ExtensionUISlot,
} from "@vokality/ragdoll-extensions/ui";
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
  activeSlot: ExtensionUISlot | null;
  onClosePanel: () => void;
  messages: Message[];
  isStreaming: boolean;
  themeId: CharacterThemeId;
  variantId: CharacterVariantId;
  onControllerReady: (controller: CharacterController) => void;
  onEventSubscriberError: (error: unknown) => void;
}

export function CharacterView({
  activeSlot,
  onClosePanel,
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

      <div className="character-stage" data-panel-open={activeSlot !== null}>
        <div className="character-extension-card" aria-hidden={!activeSlot}>
          {activeSlot && (
            <InlineSlotPanel
              key={activeSlot.id}
              slot={activeSlot}
              onClose={onClosePanel}
            />
          )}
        </div>
        <div className="character-avatar-halo" aria-hidden="true" />
        <div className="character-portrait">
          <RagdollCharacter
            onControllerReady={handleControllerReady}
            onEventSubscriberError={onEventSubscriberError}
            theme={theme}
            variant={variantId}
          />
        </div>
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
    width: "100%",
    maxWidth: "var(--chat-shell-width)",
    alignSelf: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
    minHeight: 0,
    position: "relative",
    padding: "16px 20px 0",
    overflow: "hidden",
  },
  glow: {
    top: "170px",
    width: "420px",
    height: "420px",
  },
};
