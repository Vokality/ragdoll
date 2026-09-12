import { Button } from "./ui/button";
import type { CSSProperties } from "react";

interface SuggestionChipsProps {
  onPick: (prompt: string) => void;
  slots: readonly string[];
}

/** Everyday invitations; actions still run through the agent after a user picks one. */
export function SuggestionChips({ onPick, slots }: SuggestionChipsProps) {
  const suggestions = [
    ...(slots.includes("tasks.main")
      ? [
          {
            label: "Plan my day",
            prompt:
              "Help me plan my day. Show my tasks and help me pick a priority.",
          },
        ]
      : []),
    ...(slots.includes("pomodoro.main")
      ? [
          {
            label: "Help me focus",
            prompt: "Start a 25 minute focus timer for me.",
          },
        ]
      : []),
    {
      label: "Think it through",
      prompt:
        "I'd like to think something through with you. Ask me what's on my mind.",
    },
  ];
  return (
    <div style={styles.container} className="suggestion-chips animate-fadeIn">
      <p style={styles.caption}>What would help today?</p>
      <div className="suggestion-options" style={styles.chips}>
        {suggestions.map((suggestion, index) => (
          <Button
            variant="plain"
            key={suggestion.label}
            type="button"
            className="chip"
            style={{ animationDelay: `${index * 70}ms` }}
            onClick={() => onPick(suggestion.prompt)}
          >
            {suggestion.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    padding: "0 20px 8px",
    position: "relative",
    zIndex: 1,
    flexShrink: 0,
    width: "100%",
    maxWidth: "var(--chat-shell-width)",
    alignSelf: "center",
  },
  caption: {
    fontSize: "12px",
    color: "var(--text-muted)",
    margin: 0,
  },
  chips: {
    display: "flex",
    gap: "8px",
  },
};
