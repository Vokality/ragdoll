import { useState, useRef, useEffect, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { SlotBar, type ExtensionUISlot } from "@vokality/ragdoll-extensions";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  slots?: ExtensionUISlot[];
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Type your message...",
  slots = [],
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setMessage("");
      // Refocus the textarea after sending
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <style>{`
        .chat-textarea:focus {
          outline: none !important;
          box-shadow: none !important;
        }
        .chat-textarea::placeholder {
          color: var(--text-dim);
        }
      `}</style>

      {/* Extension slot bar */}
      {slots.length > 0 && (
        <div style={styles.slotBarRow}>
          <SlotBar slots={slots} />
        </div>
      )}

      <div style={styles.inputContainer}>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          style={styles.textarea}
        />
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          style={{
            ...styles.sendButton,
            opacity: message.trim() && !disabled ? 1 : 0.5,
          }}
        >
          <SendIcon />
        </button>
      </div>
      <p style={styles.hint}>
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "16px 20px 20px",
    background: "var(--bg-secondary)",
    borderTop: "1px solid var(--border)",
  },
  slotBarRow: {
    display: "flex",
    justifyContent: "flex-start",
    paddingBottom: "8px",
  },
  inputContainer: {
    display: "flex",
    alignItems: "flex-end",
    gap: "12px",
    background: "var(--bg-primary)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--border)",
    padding: "4px 4px 4px 16px",
    transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
  },
  textarea: {
    flex: 1,
    resize: "none",
    border: "none",
    background: "transparent",
    padding: "12px 0",
    fontSize: "14px",
    lineHeight: "1.5",
    color: "var(--text-primary)",
    outline: "none",
    minHeight: "44px",
    maxHeight: "120px",
  },
  sendButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: "var(--radius-md)",
    background: "var(--accent)",
    color: "var(--bg-primary)",
    cursor: "pointer",
    transition: "opacity var(--transition-fast), transform var(--transition-fast)",
    flexShrink: 0,
  },
  hint: {
    fontSize: "11px",
    color: "var(--text-dim)",
    margin: "0",
    textAlign: "center",
  },
};
