import { useState, useCallback, useEffect, type CSSProperties } from "react";
import type { CharacterController } from "@vokality/ragdoll";
import { SlotBar } from "@vokality/ragdoll-extensions/ui";
import { CharacterView } from "../components/character-view";
import { ChatInput } from "../components/chat-input";
import { SettingsModal } from "../components/settings-modal";
import { SuggestionChips } from "../components/suggestion-chips";
import { useChatApplication } from "../hooks/use-chat-application";
import { useExtensionSlots } from "../hooks/use-extension-slots";
import type { ChatService } from "../application/chat-service";
import type { CharacterCommandService } from "../application/character-command-service";
import type { ExtensionSlotService } from "../application/extension-slot-service";
import type { ExtensionManagementService } from "../application/extension-management-service";
import type {
  CharacterThemeId,
  CharacterVariantId,
} from "../../electron/electron-api";

interface ChatScreenProps {
  onLogout: () => void;
  chatService: ChatService;
  characterCommands: CharacterCommandService;
  extensionSlots: ExtensionSlotService;
  extensions: ExtensionManagementService;
  reportError: (error: unknown) => void;
}

export function ChatScreen({
  onLogout,
  chatService,
  characterCommands,
  extensionSlots: extensionSlotService,
  extensions,
  reportError,
}: ChatScreenProps) {
  const [controller, setController] = useState<CharacterController | null>(
    null,
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const {
    settings,
    visibleMessages,
    isStreaming,
    isLoading,
    error,
    actions: {
      sendMessage: sendChatMessage,
      stopStreaming,
      changeTheme,
      changeVariant,
      clearConversation,
      clearApiKey,
    },
    subscribeToFunctionCalls,
  } = useChatApplication(chatService);

  // Get extension slots from extensions
  const extensionSlots = useExtensionSlots(extensionSlotService);

  useEffect(() => {
    if (!controller) return;
    return subscribeToFunctionCalls((name, args) => {
      characterCommands.execute(controller, name, args);
    });
  }, [characterCommands, controller, subscribeToFunctionCalls]);

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    setController(ctrl);
    ctrl.setMood("smile", 0.5);
  }, []);

  const handleSendMessage = useCallback(
    async (message: string): Promise<boolean> => {
      if (isLoading) return false;

      setDismissedError(null);

      if (controller) {
        controller.setMood("thinking", 0.3);
      }

      const result = await sendChatMessage(message);

      if (!result.success && controller) {
        controller.setMood("sad", 0.3);
      }
      return result.success;
    },
    [controller, isLoading, sendChatMessage],
  );

  // Cmd/Ctrl+, opens settings — the platform convention for preferences.
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        setIsSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const handleThemeChange = useCallback(
    async (theme: CharacterThemeId) => {
      await changeTheme(theme);
    },
    [changeTheme],
  );

  const handleVariantChange = useCallback(
    async (variant: CharacterVariantId) => {
      await changeVariant(variant);
    },
    [changeVariant],
  );

  const handleClearConversation = useCallback(async () => {
    if (!(await clearConversation())) return;
    setIsSettingsOpen(false);
    if (controller) {
      controller.setMood("smile", 0.3);
    }
  }, [clearConversation, controller]);

  const handleChangeApiKey = useCallback(async () => {
    if (await clearApiKey()) onLogout();
  }, [clearApiKey, onLogout]);

  const visibleError = error && error !== dismissedError ? error : null;

  return (
    <div style={styles.container}>
      <div className="app-atmosphere" />
      <div style={styles.dragRegion} className="drag-region" />

      <header style={styles.header}>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="icon-btn spin-hover no-drag"
          aria-label="Open settings"
          title="Settings"
        >
          <SettingsIcon />
        </button>

        <div
          className={`status-pill${isLoading ? " busy" : ""}`}
          role="status"
        >
          <span className={`status-dot${isLoading ? " busy" : ""}`} />
          <span className="label">{isLoading ? "Thinking…" : "Ready"}</span>
        </div>
      </header>

      {visibleError && (
        <div className="banner-error" role="alert">
          <AlertIcon />
          <span style={styles.errorText}>{visibleError}</span>
          <button
            type="button"
            className="dismiss"
            onClick={() => setDismissedError(visibleError)}
            aria-label="Dismiss error"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {extensionSlots.length > 0 && (
        <div style={styles.extensionDock}>
          <SlotBar slots={extensionSlots} />
        </div>
      )}

      <CharacterView
        messages={visibleMessages}
        isStreaming={isStreaming}
        themeId={settings.theme}
        variantId={settings.variant}
        onControllerReady={handleControllerReady}
        onEventSubscriberError={reportError}
      />

      {visibleMessages.length === 0 && !isLoading && (
        <SuggestionChips onPick={(prompt) => void handleSendMessage(prompt)} />
      )}

      <ChatInput
        onSend={handleSendMessage}
        onStop={() => void stopStreaming()}
        isBusy={isLoading}
        placeholder="Message Lumen…"
      />

      <SettingsModal
        service={extensions}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTheme={settings.theme}
        currentVariant={settings.variant}
        onThemeChange={handleThemeChange}
        onVariantChange={handleVariantChange}
        onClearConversation={handleClearConversation}
        onChangeApiKey={handleChangeApiKey}
      />
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    background: "var(--bg-primary)",
    position: "relative",
  },
  dragRegion: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "32px",
    zIndex: 10,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border-light)",
    paddingTop: "40px", // Account for drag region on macOS
    position: "relative",
    zIndex: 1,
  },
  errorText: {
    flex: 1,
    minWidth: 0,
  },
  // No z-index here: the SlotBar's bottom sheet is position:fixed and must
  // stack in the root context so it covers the composer and character.
  extensionDock: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "12px 20px 0",
  },
};
