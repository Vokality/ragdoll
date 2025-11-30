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

export function SpeechBubble({ text, tone = "default", theme }: SpeechBubbleProps) {
  if (!text) return null;

  const accent =
    tone === "shout"
      ? theme?.colors.lips.lower ?? "#e07882"
      : theme?.colors.eyes.iris ?? "#5a9bc4";
  const muted = theme?.colors.skin.dark ?? "#94a3b8";
  const surface = theme?.colors.shadow.transparent ?? "rgba(15, 23, 42, 0.4)";
  const border = `${accent}55`;
  const glow = `${accent}30`;

  const toneStyles: Record<NonNullable<SpeechBubbleProps["tone"]>, CSSProperties> = {
    default: {
      color: accent,
      borderColor: border,
      boxShadow: `0 12px 30px rgba(0,0,0,0.35), 0 0 24px ${glow}`,
      background: `linear-gradient(140deg, ${surface} 0%, ${accent}10 100%)`,
    },
    whisper: {
      color: muted,
      borderColor: `${muted}55`,
      boxShadow: `0 12px 30px rgba(0,0,0,0.35), 0 0 16px ${muted}30`,
      background: `linear-gradient(140deg, ${surface} 0%, ${muted}10 100%)`,
      opacity: 0.9,
    },
    shout: {
      color: accent,
      borderColor: border,
      boxShadow: `0 12px 30px rgba(0,0,0,0.45), 0 0 28px ${glow}`,
      background: `linear-gradient(140deg, ${surface} 0%, ${accent}12 100%)`,
      animation: "pulse-glow-amber 1.2s ease-in-out infinite",
    },
  };

  return (
    <div
      style={{
        ...styles.container,
        ...toneStyles[tone],
      }}
    >
      <div style={styles.accentBar} />
      <div style={styles.headerRow}>
        <div
          style={{
            ...styles.badge,
            color: toneStyles[tone].color,
            borderColor: toneStyles[tone].borderColor,
            backgroundColor: `${toneStyles[tone].color}0f`,
          }}
        >
          <span style={styles.badgeDot} />
          {toneLabels[tone]}
        </div>
        <span style={{ color: muted, letterSpacing: "0.6px" }}>LIVE LINK</span>
      </div>
      <div style={styles.contentRow}>
        <span style={{ ...styles.chevron, color: toneStyles[tone].color }}>
          {">"}
        </span>
        <span style={{ ...styles.content, color: toneStyles[tone].color }}>
          {text}
          <span style={styles.cursor}>_</span>
        </span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed" as const,
    top: "32px",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: "540px",
    minWidth: "260px",
    padding: "14px 18px 16px",
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    fontSize: "20px",
    letterSpacing: "0.4px",
    border: "1px solid",
    borderRadius: "12px",
    zIndex: 999,
    pointerEvents: "none" as const,
    animation: "fade-in 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    backdropFilter: "blur(10px)",
  },
  accentBar: {
    position: "absolute" as const,
    inset: "0 0 auto 0",
    height: "4px",
    borderTopLeftRadius: "12px",
    borderTopRightRadius: "12px",
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)",
    opacity: 0.8,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 8px",
    fontSize: "12px",
    letterSpacing: "1px",
    borderRadius: "999px",
    border: "1px solid",
    textTransform: "uppercase" as const,
  },
  badgeDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "currentColor",
  },
  contentRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  chevron: {
    fontSize: "22px",
    transform: "translateY(-2px)",
  },
  content: {
    lineHeight: 1.35,
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  },
  cursor: {
    animation: "blink 1s infinite",
    marginLeft: "2px",
  },
} satisfies Record<string, CSSProperties>;
