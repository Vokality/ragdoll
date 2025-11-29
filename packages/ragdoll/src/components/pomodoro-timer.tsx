import React, { useEffect, useState } from "react";
import { PomodoroController } from "../controllers/pomodoro-controller";
import type { PomodoroStateData } from "../types";
import type { RagdollTheme } from "../themes/types";

interface PomodoroTimerProps {
  controller: PomodoroController;
  theme?: RagdollTheme;
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Pomodoro timer component displayed underneath the avatar
 */
export function PomodoroTimer({ controller, theme }: PomodoroTimerProps) {
  const [state, setState] = useState<PomodoroStateData>(controller.getState());

  useEffect(() => {
    const unsubscribe = controller.onUpdate((newState) => {
      setState(newState);
    });

    // Set initial state
    setState(controller.getState());

    return unsubscribe;
  }, [controller]);

  // Don't render if idle
  if (state.state === "idle") {
    return null;
  }

  const totalDuration = (state.isBreak ? state.breakDuration : state.sessionDuration) * 60;
  const progress = totalDuration > 0 ? state.elapsedTime / totalDuration : 0;
  const progressPercent = Math.min(100, progress * 100);

  const modeLabel = state.isBreak ? "BREAK" : "FOCUS";
  
  // Use theme colors: iris for focus, lips for break (complementary accent)
  const focusColor = theme?.colors.eyes.iris ?? "#f59e0b";
  const breakColor = theme?.colors.lips.lower ?? "#4ade80";
  const textColor = theme?.colors.hair.light ?? "#f1f5f9";
  const mutedColor = theme?.colors.skin.dark ?? "#94a3b8";
  const trackColor = theme?.colors.shadow.color ?? "rgba(148, 163, 184, 0.2)";
  
  const modeColor = state.isBreak ? breakColor : focusColor;

  return (
    <div style={styles.container}>
      <div style={{ ...styles.modeBadge, color: mutedColor }}>
        <span style={{ ...styles.modeDot, backgroundColor: modeColor }} />
        {modeLabel}
      </div>
      <div style={{ ...styles.timerDisplay, color: textColor }}>
        {formatTime(state.remainingTime)}
      </div>
      <div style={{ ...styles.progressContainer, backgroundColor: trackColor }}>
        <div
          style={{
            ...styles.progressBar,
            width: `${progressPercent}%`,
            backgroundColor: modeColor,
          }}
        />
      </div>
      {state.state === "paused" && (
        <div style={{ ...styles.pausedLabel, color: mutedColor }}>PAUSED</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    marginTop: "16px",
    minWidth: "200px",
  },
  modeBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  modeDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    display: "inline-block",
  },
  timerDisplay: {
    fontSize: "32px",
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: "2px",
    lineHeight: 1,
  },
  progressContainer: {
    width: "100%",
    height: "4px",
    borderRadius: "2px",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    transition: "width 0.3s ease",
    borderRadius: "2px",
  },
  pausedLabel: {
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginTop: "-4px",
  },
};

