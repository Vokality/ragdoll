import { Icon } from "./ui/icons";
import { IconButton } from "./ui/button";
import { Textarea } from "./ui/input";
import {
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { composerFocusShortcutLabel } from "../platform";

interface ChatInputProps {
  /** Sends the message; resolves false when the send failed. */
  onSend: (message: string) => Promise<boolean>;
  /** Interrupts the in-flight response. */
  onStop: () => void;
  isBusy: boolean;
  placeholder: string;
}

export function ChatInput({
  onSend,
  onStop,
  isBusy,
  placeholder,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Cmd/Ctrl+K focuses the composer from anywhere
  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || isBusy) return;

    setMessage("");
    textareaRef.current?.focus();

    const sent = await onSend(trimmed);
    if (!sent) {
      // Give the failed message back instead of losing it, unless the
      // user already started typing something else.
      setMessage((current) => (current === "" ? trimmed : current));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="chat-input-form"
      style={styles.form}
    >
      <div className="chat-input-bar">
        <Textarea
          ref={textareaRef}
          className="chat-textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          aria-label="Message"
        />
        {isBusy ? (
          <IconButton
            variant="plain"
            type="button"
            className="send-btn stop"
            onClick={() => {
              textareaRef.current?.focus();
              onStop();
            }}
            aria-label="Stop generating"
            title="Stop generating"
          >
            <Icon name="stop" size={16} />
          </IconButton>
        ) : (
          <IconButton
            variant="plain"
            type="submit"
            className="send-btn"
            disabled={!message.trim()}
            aria-label="Send message"
          >
            <Icon name="send" size={20} />
          </IconButton>
        )}
      </div>
      <p className="input-hint">
        Enter to send · Shift+Enter for new line ·{" "}
        {composerFocusShortcutLabel()} to focus
      </p>
    </form>
  );
}

const styles: Record<string, CSSProperties> = {
  form: {
    width: "100%",
    maxWidth: "var(--chat-shell-width)",
    alignSelf: "center",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "10px 20px 10px",
    position: "relative",
    zIndex: 1,
  },
};
