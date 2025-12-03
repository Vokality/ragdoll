import { useState, useEffect, useRef, type CSSProperties } from "react";
import type { RagdollTheme } from "@vokality/ragdoll";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConversationBubblesProps {
  messages: Message[];
  isStreaming?: boolean;
  theme?: RagdollTheme;
}

export function ConversationBubbles({
  messages,
  isStreaming,
  theme,
}: ConversationBubblesProps) {
  const [slideUpTrigger, setSlideUpTrigger] = useState(0);
  const prevMessagesRef = useRef<Message[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect new messages and trigger animations
  useEffect(() => {
    const prevLength = prevMessagesRef.current.length;
    const currentLength = messages.length;

    if (currentLength > prevLength) {
      // New message(s) added - trigger slide up animation for all messages
      setSlideUpTrigger(prev => prev + 1);
      prevMessagesRef.current = messages;
    } else if (currentLength < prevLength) {
      // Messages were removed (e.g., conversation cleared)
      prevMessagesRef.current = messages;
    } else {
      // Same length - might be streaming update to last message
      prevMessagesRef.current = messages;
    }
  }, [messages]);

  if (messages.length === 0) return null;

  // Helper to get bubble colors based on role
  const getBubbleColors = (role: "user" | "assistant") => {
    if (role === "assistant") {
      return {
        textColor: theme?.colors.hair.light ?? "#f1f5f9",
        borderColor: theme?.colors.shadow.color ?? "rgba(148, 163, 184, 0.2)",
        backgroundColor: theme?.colors.shadow.transparent ?? "rgba(0, 0, 0, 0.15)",
      };
    } else {
      return {
        textColor: "#1e293b",
        borderColor: theme?.colors.hair.light ?? "#f1f5f9",
        backgroundColor: theme?.colors.hair.transparent ?? "rgba(241, 245, 249, 0.9)",
      };
    }
  };

  return (
    <>
      <style>{`
        @keyframes bubbleSlideIn {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes bubbleSlideInLast {
          from {
            opacity: 0;
            transform: translateY(30px) scale(1);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes bubbleSlideInOlder {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 0.85;
            transform: translateY(0) scale(0.92);
          }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      <div ref={containerRef} style={styles.container}>
        {messages.map((message, index) => {
          const colors = getBubbleColors(message.role);
          const isLastMessage = index === messages.length - 1;
          const isOlderMessage = index < messages.length - 1;

          // Animation - all messages animate when slideUpTrigger changes
          const animation = slideUpTrigger > 0
            ? (isLastMessage
                ? "bubbleSlideInLast 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
                : "bubbleSlideInOlder 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards")
            : "none";

          return (
            <div
              key={`${message.role}-${index}-${slideUpTrigger}`}
              style={{
                ...styles.bubble,
                borderColor: colors.borderColor,
                backgroundColor: colors.backgroundColor,
                animation: animation,
                opacity: isOlderMessage ? 0.85 : 1,
                transform: isOlderMessage ? "scale(0.92)" : "scale(1)",
              }}
            >
              <div style={{ ...styles.content, color: colors.textColor }}>
                {message.content}
                {isStreaming && isLastMessage && message.role === "assistant" && (
                  <span style={styles.cursor}>▌</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    maxWidth: "400px",
    marginTop: "8px",
    minHeight: "auto",
  },
  bubble: {
    maxWidth: "320px",
    minWidth: "120px",
    padding: "14px 18px 12px",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    lineHeight: "1.5",
    letterSpacing: "0.3px",
    border: "1px solid",
    borderRadius: "var(--radius-md)",
    pointerEvents: "none",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  content: {
    wordBreak: "break-word",
  },
  cursor: {
    animation: "cursorBlink 1s infinite",
    marginLeft: "1px",
    opacity: 0.8,
  },
};
