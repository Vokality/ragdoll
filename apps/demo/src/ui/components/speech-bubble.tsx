import type { CSSProperties } from "react";
import type { RagdollTheme } from "@vokality/ragdoll";

interface SpeechBubbleProps {
  text: string | null;
  tone?: "default" | "whisper" | "shout";
  theme?: RagdollTheme;
}

const toneLabels: Record<NonNullable<SpeechBubbleProps["tone"]>, string> = {
  default: "CHAT",
  whisper: "WHISPER",
  shout: "ALERT",
};

export function SpeechBubble({
  text,
  tone = "default",
  theme,
}: SpeechBubbleProps) {
  if (!text) return null;

  // Theme-aware colors
  const textColor = theme?.colors.hair.light ?? "#f1f5f9";
  const muted = theme?.colors.skin.dark ?? "#94a3b8";
  const accent = theme?.colors.eyes.iris ?? "#5a9bc4";
  const alertColor = theme?.colors.lips.lower ?? "#e07882";
  const border = theme?.colors.shadow.color ?? "rgba(148, 163, 184, 0.2)";
  const background = theme?.colors.shadow.transparent ?? "rgba(0, 0, 0, 0.15)";

  const modeColor =
    tone === "shout" ? alertColor : tone === "whisper" ? muted : accent;
  const isShout = tone === "shout";
  const isWhisper = tone === "whisper";

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px 0 ${modeColor}15; }
          50% { box-shadow: 0 0 28px 2px ${modeColor}25; }
        }
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
          animation: isShout
            ? "slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), glow 2s ease-in-out infinite"
            : "slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div style={styles.header}>
          <div
            style={{
              ...styles.badge,
              color: modeColor,
              borderColor: `${modeColor}40`,
              backgroundColor: `${modeColor}0f`,
            }}
          >
            <span style={{ ...styles.badgeDot, backgroundColor: modeColor }} />
            {toneLabels[tone]}
          </div>
        </div>
        <div style={{ ...styles.content, color: textColor }}>
          {text}
          <span style={styles.cursor}>_</span>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    position: "fixed",
    top: "32px",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: "540px",
    minWidth: "280px",
    padding: "16px 18px",
    border: "1px solid",
    borderRadius: "14px",
    zIndex: 999,
    pointerEvents: "none",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: "10px",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.8px",
    borderRadius: "999px",
    border: "1px solid",
    textTransform: "uppercase",
  },
  badgeDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
  },
  content: {
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: 1.5,
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  cursor: {
    animation: "blink 1s infinite",
    marginLeft: "2px",
  },
};
