import {
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";

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

  // Re-focus once a pending response finishes
  useEffect(() => {
    if (!isBusy) textareaRef.current?.focus();
  }, [isBusy]);

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
    if (e.key === "Enter" && !e.shiftKey) {
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
        <textarea
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
          <button
            type="button"
            className="send-btn stop"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            type="submit"
            className="send-btn"
            disabled={!message.trim()}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        )}
      </div>
      <p className="input-hint">
        Enter to send · Shift+Enter for new line · ⌘K to focus
      </p>
    </form>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1" y="1" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "16px 20px 14px",
    position: "relative",
    zIndex: 1,
  },
};
