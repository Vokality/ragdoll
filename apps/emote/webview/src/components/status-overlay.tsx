import type { CSSProperties } from "react";

type OverlayVariant = "initial" | "waiting";

interface StatusOverlayProps {
  variant: OverlayVariant;
}

const messages: Record<
  OverlayVariant,
  { title: string; body: string; tips: string[] }
> = {
  initial: {
    title: "Getting Emote ready",
    body: "The companion loads beside your editor as soon as the extension spins up.",
    tips: [
      'Run "Emote: Show Character" from the Command Palette.',
      'Use "Emote: Copy MCP Configuration" to hook up your assistant.',
    ],
  },
  waiting: {
    title: "Listening for your assistant",
    body: "Once an AI sends its first command, the overlay fades away automatically.",
    tips: [
      'Confirm your MCP client lists "emote" in its servers.',
      'Ask your assistant to run "setMood smile" to test the link.',
    ],
  },
};

export function StatusOverlay({ variant }: StatusOverlayProps) {
  const copy = messages[variant];

  return (
    <div style={styles.wrapper}>
      <div style={styles.content}>
        <p style={styles.title}>{copy.title}</p>
        <p style={styles.body}>{copy.body}</p>
        <ul style={styles.tipList}>
          {copy.tips.map((tip) => (
            <li key={tip} style={styles.tipItem}>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    position: "absolute",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  content: {
    maxWidth: "320px",
    padding: "16px 20px",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderRadius: "8px",
    border: "1px solid rgba(78, 201, 176, 0.4)",
    fontFamily: "var(--vscode-editor-font-family, 'Inter', sans-serif)",
    color: "var(--vscode-editor-foreground, #f8fafc)",
    boxShadow: "0 8px 20px rgba(0, 0, 0, 0.45)",
  },
  title: {
    fontSize: "14px",
    fontWeight: 600,
    marginBottom: "8px",
  },
  body: {
    fontSize: "12px",
    lineHeight: 1.5,
    marginBottom: "10px",
    opacity: 0.9,
  },
  tipList: {
    paddingLeft: "16px",
    margin: 0,
  },
  tipItem: {
    fontSize: "12px",
    marginBottom: "4px",
  },
};
