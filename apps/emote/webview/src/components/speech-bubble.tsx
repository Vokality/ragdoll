import type { CSSProperties } from "react";
import type { RagdollTheme } from "@vokality/ragdoll";

interface SpeechBubbleProps {
  text: string | null;
  tone?: "default" | "whisper" | "shout";
  theme?: RagdollTheme;
}

export function SpeechBubble({
  text,
  tone = "default",
  theme,
}: SpeechBubbleProps) {
  if (!text) return null;

  // Theme-aware colors (matching TaskDrawer pattern)
  const textColor = theme?.colors.hair.light ?? "#f1f5f9";
  const border = theme?.colors.shadow.color ?? "rgba(148, 163, 184, 0.2)";
  const background = theme?.colors.shadow.transparent ?? "rgba(0, 0, 0, 0.15)";

  const isWhisper = tone === "whisper";

  return (
    <>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      <div
        style={{
          ...styles.container,
          borderColor: border,
          backgroundColor: background,
          opacity: isWhisper ? 0.85 : 1,
        }}
      >
        <div style={{ ...styles.content, color: textColor }}>
          {">"} {text}
          <span style={styles.cursor}>_</span>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    position: "absolute",
    top: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: "280px",
    minWidth: "120px",
    padding: "12px 16px 10px",
    fontFamily: "var(--vscode-editor-font-family, monospace)",
    fontSize: "13px",
    letterSpacing: "0.3px",
    border: "1px solid",
    borderRadius: "4px",
    zIndex: 999,
    pointerEvents: "none",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },
  content: {
    lineHeight: 1.4,
  },
  cursor: {
    animation: "blink 1s infinite",
    marginLeft: "2px",
  },
};
