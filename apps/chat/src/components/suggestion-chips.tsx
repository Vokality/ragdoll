import type { CSSProperties } from "react";

interface SuggestionChipsProps {
  onPick: (prompt: string) => void;
}

const SUGGESTIONS: ReadonlyArray<{ label: string; prompt: string }> = [
  { label: "What can you do?", prompt: "What can you do?" },
  {
    label: "Start a focus timer",
    prompt: "Start a 25 minute focus timer for me.",
  },
  { label: "Play tic-tac-toe", prompt: "Let's play a game of tic-tac-toe." },
];

/** First-run hints that teach what Lumen (and its extensions) can do. */
export function SuggestionChips({ onPick }: SuggestionChipsProps) {
  return (
    <div style={styles.container} className="animate-fadeIn">
      <p style={styles.caption}>Say hello, or try one of these</p>
      <div style={styles.chips}>
        {SUGGESTIONS.map((suggestion, index) => (
          <button
            key={suggestion.label}
            type="button"
            className="chip"
            style={{ animationDelay: `${index * 70}ms` }}
            onClick={() => onPick(suggestion.prompt)}
          >
            {suggestion.label}
          </button>
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
  },
  caption: {
    fontSize: "12px",
    color: "var(--text-muted)",
    margin: 0,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "8px",
  },
};
