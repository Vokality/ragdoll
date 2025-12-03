import { useState, useEffect, type CSSProperties } from "react";
import { chatUiTheme } from "../styles/chat-ui-theme";

interface SpeechBubbleProps {
  text: string | null;
  isStreaming?: boolean;
}

export function SpeechBubble({ text, isStreaming }: SpeechBubbleProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (text) {
      setVisible(true);
    } else {
      // Delay hiding for fade out animation
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [text]);

  if (!visible && !text) return null;

  const { speech } = chatUiTheme;
  const textColor = speech.text;
  const border = speech.border;
  const background = speech.background;

  return (
    <>
      <style>{`
        @keyframes bubbleFadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bubbleFadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-10px); }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      <div
        style={{
          ...styles.container,
          borderColor: border,
          backgroundColor: background,
          animation: text
            ? "bubbleFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
            : "bubbleFadeOut 0.3s ease forwards",
        }}
      >
        <div style={{ ...styles.content, color: textColor }}>
          {text || ""}
          {isStreaming && (
            <span style={styles.cursor}>▌</span>
          )}
        </div>
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    position: "relative",
    maxWidth: "320px",
    minWidth: "120px",
    padding: "14px 18px 12px",
    marginTop: "8px",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    lineHeight: "1.5",
    letterSpacing: "0.3px",
    border: "1px solid",
    borderRadius: "var(--radius-md)",
    zIndex: 100,
    pointerEvents: "none",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
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
