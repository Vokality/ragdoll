import type { CSSProperties } from "react";

interface SpeechBubbleProps {
  text: string | null;
  tone?: "default" | "whisper" | "shout";
}

const toneStyles: Record<
  NonNullable<SpeechBubbleProps["tone"]>,
  CSSProperties
> = {
  default: {
    backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
    color: "var(--vscode-terminal-ansiGreen, #4ec9b0)",
    borderColor: "var(--vscode-terminal-ansiGreen, #4ec9b0)",
  },
  whisper: {
    backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
    color: "var(--vscode-descriptionForeground, #858585)",
    borderColor: "var(--vscode-descriptionForeground, #858585)",
    opacity: 0.9,
  },
  shout: {
    backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
    color: "var(--vscode-terminal-ansiYellow, #dcdcaa)",
    borderColor: "var(--vscode-terminal-ansiYellow, #dcdcaa)",
  },
};

const toneLabels: Record<NonNullable<SpeechBubbleProps["tone"]>, string> = {
  default: "MSG",
  whisper: "WHISPER",
  shout: "SHOUT",
};

export function SpeechBubble({ text, tone = "default" }: SpeechBubbleProps) {
  if (!text) return null;

  return (
    <div
      style={{
        ...styles.container,
        ...toneStyles[tone],
      }}
    >
      <div style={styles.header}>[{toneLabels[tone]}]</div>
      <div style={styles.content}>
        {">"} {text}
        <span style={styles.cursor}>_</span>
      </div>
    </div>
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
  },
  header: {
    fontSize: "11px",
    marginBottom: "4px",
    letterSpacing: "0.5px",
    opacity: 0.8,
  },
  content: {
    lineHeight: 1.4,
  },
  cursor: {
    animation: "blink 1s infinite",
    marginLeft: "2px",
  },
};







