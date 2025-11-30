import { useMemo, useState, useEffect } from "react";
import { CharacterController } from "@vokality/ragdoll";
import type {
  FacialMood,
  PomodoroDuration,
  PomodoroStateData,
} from "@vokality/ragdoll";

interface ControlPanelProps {
  controller: CharacterController | null;
}

const moods: FacialMood[] = [
  "neutral",
  "smile",
  "frown",
  "laugh",
  "angry",
  "sad",
];
const tones = ["default", "whisper", "shout"] as const;
const yawLimitDeg = 35;
const pitchLimitDeg = 20;

export function ControlPanel({ controller }: ControlPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [currentMood, setCurrentMood] = useState<FacialMood>("neutral");
  const [activeAction, setActiveAction] = useState<
    "wink" | "talk" | "shake" | null
  >(null);
  const [speechText, setSpeechText] = useState("");
  const [bubbleTone, setBubbleTone] =
    useState<(typeof tones)[number]>("default");
  const [yawDeg, setYawDeg] = useState(0);
  const [pitchDeg, setPitchDeg] = useState(0);
  const [sessionDuration, setSessionDuration] = useState<PomodoroDuration>(30);
  const [breakDuration, setBreakDuration] = useState<PomodoroDuration>(5);
  const [pomodoroState, setPomodoroState] = useState<PomodoroStateData | null>(
    null,
  );

  const headPoseInfo = useMemo(
    () => ({
      yawLabel: `${yawDeg.toFixed(0)}°`,
      pitchLabel: `${pitchDeg.toFixed(0)}°`,
    }),
    [yawDeg, pitchDeg],
  );

  const handleMood = (mood: FacialMood) => {
    if (!controller) return;
    controller.setMood(mood, 0.35);
    setCurrentMood(mood);
  };

  const handleWink = () => {
    if (!controller) return;
    controller.triggerAction("wink", 0.7);
    setActiveAction("wink");
    setTimeout(
      () => setActiveAction((current) => (current === "wink" ? null : current)),
      800,
    );
  };

  const handleTalkToggle = () => {
    if (!controller) return;
    if (activeAction === "talk") {
      controller.clearAction();
      setActiveAction(null);
      return;
    }
    controller.triggerAction("talk");
    setActiveAction("talk");
  };

  const handleShake = () => {
    if (!controller) return;
    controller.triggerAction("shake", 0.6);
    setActiveAction("shake");
    setTimeout(
      () =>
        setActiveAction((current) => (current === "shake" ? null : current)),
      700,
    );
  };

  const handleSpeechChange = (text: string) => {
    setSpeechText(text);
    const trimmed = text.trim();
    controller?.setSpeechBubble({
      text: trimmed ? text : null,
      tone: bubbleTone,
    });
    if (trimmed && activeAction !== "talk") {
      setActiveAction("talk");
    }
    if (!trimmed && activeAction === "talk") {
      setActiveAction(null);
    }
  };

  const handleToneChange = (tone: (typeof tones)[number]) => {
    setBubbleTone(tone);
    controller?.setSpeechBubble({
      text: speechText.trim() ? speechText : null,
      tone,
    });
  };

  const updateHeadPose = (axis: "yaw" | "pitch", valueDeg: number) => {
    if (!controller) return;
    if (axis === "yaw") {
      setYawDeg(valueDeg);
    } else {
      setPitchDeg(valueDeg);
    }

    const radians = (valueDeg * Math.PI) / 180;
    controller.setHeadPose({ [axis]: radians }, 0.3);
  };

  // Subscribe to pomodoro updates
  useEffect(() => {
    if (!controller) return;

    const pomodoroController = controller.getPomodoroController();
    setPomodoroState(pomodoroController.getState());

    const unsubscribe = pomodoroController.onUpdate((state) => {
      setPomodoroState(state);
    });

    return unsubscribe;
  }, [controller]);

  const handleStartPomodoro = () => {
    if (!controller) return;
    controller.startPomodoro(sessionDuration, breakDuration);
  };

  const handlePausePomodoro = () => {
    if (!controller) return;
    controller.pausePomodoro();
  };

  const handleResetPomodoro = () => {
    if (!controller) return;
    controller.resetPomodoro();
  };

  const sessionDurations: PomodoroDuration[] = [15, 30, 60, 120];
  const breakDurations: PomodoroDuration[] = [5, 15, 30, 60];

  return (
    <>
      {/* Toggle button - always visible, separate from panel */}
      <button
        style={{
          ...styles.toggleButton,
          right: isCollapsed ? "12px" : "352px",
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Open Controls" : "Close Controls"}
      >
        {isCollapsed ? "[ CONTROLS ]" : "[X]"}
      </button>

      <div
        style={{
          ...styles.container,
          transform: isCollapsed ? "translateX(100%)" : "translateX(0)",
        }}
      >
        {/* Scanline overlay for CRT effect */}
        <div style={styles.scanlineOverlay} />

        <div style={styles.panel}>
          <h2 style={styles.title}>
            {">"} FACE_CTRL.exe
            <span style={styles.cursor}>_</span>
          </h2>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>{">"} MOOD</h3>
            <div style={styles.expressionGrid}>
              {moods.map((mood) => (
                <button
                  key={mood}
                  style={{
                    ...styles.expressionButton,
                    ...(currentMood === mood ? styles.activeExpression : {}),
                  }}
                  onClick={() => handleMood(mood)}
                >
                  [{currentMood === mood ? "X" : " "}] {mood.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>{">"} ACTIONS</h3>
            <div style={styles.buttonGroup}>
              <button
                style={{
                  ...styles.actionButton,
                  ...(activeAction === "wink" ? styles.actionButtonActive : {}),
                }}
                onClick={handleWink}
              >
                WINK
              </button>
              <button
                style={{
                  ...styles.actionButton,
                  ...(activeAction === "talk"
                    ? styles.actionButtonTalking
                    : {}),
                }}
                onClick={handleTalkToggle}
              >
                {activeAction === "talk" ? "STOP" : "TALK"}
              </button>
              <button
                style={{
                  ...styles.actionButton,
                  ...(activeAction === "shake"
                    ? styles.actionButtonActive
                    : {}),
                }}
                onClick={handleShake}
              >
                SHAKE
              </button>
              <button
                style={styles.clearButton}
                onClick={() => {
                  controller?.clearAction();
                  setActiveAction(null);
                }}
              >
                CLR
              </button>
            </div>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>{">"} SPEECH_BUBBLE</h3>
            <textarea
              value={speechText}
              onChange={(event) => handleSpeechChange(event.target.value)}
              placeholder="ENTER MESSAGE..."
              style={styles.textarea}
              rows={3}
            />
            <div style={styles.buttonGroup}>
              {tones.map((tone) => (
                <button
                  key={tone}
                  style={{
                    ...styles.toneButton,
                    ...(bubbleTone === tone ? styles.toneButtonActive : {}),
                  }}
                  onClick={() => handleToneChange(tone)}
                >
                  [{bubbleTone === tone ? "*" : " "}]{tone.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              style={styles.clearButton}
              onClick={() => handleSpeechChange("")}
            >
              CLEAR_MSG
            </button>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>{">"} HEAD_POSE</h3>
            <div style={styles.sliderContainer}>
              <label style={styles.sliderLabel}>
                <span style={styles.sliderLabelText}>
                  YAW: {headPoseInfo.yawLabel.padStart(4, " ")}
                </span>
                <div style={styles.sliderTrack}>
                  <input
                    type="range"
                    min={-yawLimitDeg}
                    max={yawLimitDeg}
                    value={yawDeg}
                    onChange={(event) =>
                      updateHeadPose("yaw", Number(event.target.value))
                    }
                    style={styles.slider}
                  />
                </div>
              </label>
              <label style={styles.sliderLabel}>
                <span style={styles.sliderLabelText}>
                  PITCH: {headPoseInfo.pitchLabel.padStart(4, " ")}
                </span>
                <div style={styles.sliderTrack}>
                  <input
                    type="range"
                    min={-pitchLimitDeg}
                    max={pitchLimitDeg}
                    value={pitchDeg}
                    onChange={(event) =>
                      updateHeadPose("pitch", Number(event.target.value))
                    }
                    style={styles.slider}
                  />
                </div>
              </label>
            </div>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>{">"} POMODORO</h3>
            <div style={styles.sliderContainer}>
              <label style={styles.sliderLabel}>
                <span style={styles.sliderLabelText}>SESSION:</span>
                <div style={styles.buttonGroup}>
                  {sessionDurations.map((dur) => (
                    <button
                      key={dur}
                      style={{
                        ...styles.toneButton,
                        ...(sessionDuration === dur
                          ? styles.toneButtonActive
                          : {}),
                      }}
                      onClick={() => setSessionDuration(dur)}
                      disabled={
                        pomodoroState?.state === "running" ||
                        pomodoroState?.state === "paused"
                      }
                    >
                      {dur === 60 ? "1h" : dur === 120 ? "2h" : `${dur}m`}
                    </button>
                  ))}
                </div>
              </label>
              <label style={styles.sliderLabel}>
                <span style={styles.sliderLabelText}>BREAK:</span>
                <div style={styles.buttonGroup}>
                  {breakDurations.map((dur) => (
                    <button
                      key={dur}
                      style={{
                        ...styles.toneButton,
                        ...(breakDuration === dur
                          ? styles.toneButtonActive
                          : {}),
                      }}
                      onClick={() => setBreakDuration(dur)}
                      disabled={
                        pomodoroState?.state === "running" ||
                        pomodoroState?.state === "paused"
                      }
                    >
                      {dur}m
                    </button>
                  ))}
                </div>
              </label>
            </div>
            <div style={styles.buttonGroup}>
              {pomodoroState?.state === "running" ? (
                <button
                  style={styles.actionButton}
                  onClick={handlePausePomodoro}
                >
                  PAUSE
                </button>
              ) : (
                <button
                  style={styles.actionButton}
                  onClick={handleStartPomodoro}
                >
                  START
                </button>
              )}
              <button
                style={styles.clearButton}
                onClick={handleResetPomodoro}
                disabled={pomodoroState?.state === "idle"}
              >
                RESET
              </button>
            </div>
          </section>

          <div style={styles.footer}>════════════════════════════════</div>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    position: "fixed" as const,
    top: 0,
    right: 0,
    width: "340px",
    height: "100vh",
    backgroundColor: "var(--retro-bg-translucent, rgba(10, 10, 10, 0.92))",
    color: "var(--retro-green, #33ff33)",
    padding: "16px",
    boxSizing: "border-box" as const,
    overflowY: "auto" as const,
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    fontSize: "18px",
    zIndex: 1000,
    borderLeft: "2px solid var(--retro-green, #33ff33)",
    boxShadow:
      "inset 0 0 60px rgba(51, 255, 51, 0.03), -4px 0 20px rgba(51, 255, 51, 0.1)",
    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  scanlineOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none" as const,
    background:
      "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.1) 0px, rgba(0, 0, 0, 0.1) 1px, transparent 1px, transparent 3px)",
    zIndex: 1,
  },
  toggleButton: {
    position: "fixed" as const,
    top: "12px",
    padding: "10px 16px",
    backgroundColor: "var(--retro-bg, #0a0a0a)",
    color: "var(--retro-green, #33ff33)",
    border: "2px solid var(--retro-green, #33ff33)",
    borderRadius: "0",
    cursor: "pointer",
    fontSize: "16px",
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    whiteSpace: "nowrap" as const,
    textShadow: "0 0 8px rgba(51, 255, 51, 0.6)",
    boxShadow: "0 0 10px rgba(51, 255, 51, 0.3)",
    transition: "right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    zIndex: 1001,
  },
  panel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
    position: "relative" as const,
    zIndex: 2,
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: "22px",
    fontWeight: "normal",
    borderBottom: "2px solid var(--retro-green, #33ff33)",
    paddingBottom: "10px",
    textShadow: "0 0 10px rgba(51, 255, 51, 0.8)",
    letterSpacing: "1px",
  },
  cursor: {
    animation: "blink 1s infinite",
    marginLeft: "2px",
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "normal",
    color: "var(--retro-green-dim, #1a8c1a)",
    letterSpacing: "1px",
  },
  expressionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "6px",
  },
  expressionButton: {
    padding: "8px 12px",
    backgroundColor: "transparent",
    color: "var(--retro-green, #33ff33)",
    border: "2px solid var(--retro-green-dim, #1a8c1a)",
    borderRadius: "0",
    cursor: "pointer",
    fontSize: "15px",
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    textAlign: "left" as const,
  },
  activeExpression: {
    backgroundColor: "var(--retro-green, #33ff33)",
    color: "var(--retro-bg, #0a0a0a)",
    borderColor: "var(--retro-green, #33ff33)",
    textShadow: "none",
    boxShadow: "0 0 15px rgba(51, 255, 51, 0.5)",
    fontWeight: "bold" as const,
  },
  buttonGroup: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap" as const,
  },
  actionButton: {
    padding: "10px 16px",
    backgroundColor: "transparent",
    color: "var(--retro-green, #33ff33)",
    border: "2px solid var(--retro-green, #33ff33)",
    borderRadius: "0",
    cursor: "pointer",
    fontSize: "16px",
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    fontWeight: "normal",
    flex: 1,
    textShadow: "0 0 8px rgba(51, 255, 51, 0.6)",
    boxShadow: "0 0 10px rgba(51, 255, 51, 0.2)",
  },
  actionButtonActive: {
    backgroundColor: "var(--retro-green, #33ff33)",
    color: "var(--retro-bg, #0a0a0a)",
    textShadow: "none",
    boxShadow: "0 0 20px rgba(51, 255, 51, 0.6)",
  },
  actionButtonTalking: {
    backgroundColor: "var(--retro-amber, #ffb000)",
    color: "var(--retro-bg, #0a0a0a)",
    borderColor: "var(--retro-amber, #ffb000)",
    textShadow: "none",
    boxShadow: "0 0 20px rgba(255, 176, 0, 0.6)",
    animation: "pulse-glow-amber 1s infinite",
  },
  clearButton: {
    padding: "10px 14px",
    backgroundColor: "transparent",
    color: "var(--retro-red, #ff3333)",
    border: "2px solid var(--retro-red, #ff3333)",
    borderRadius: "0",
    cursor: "pointer",
    fontSize: "16px",
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    textShadow: "0 0 6px rgba(255, 51, 51, 0.4)",
  },
  toneButton: {
    padding: "8px 12px",
    backgroundColor: "transparent",
    color: "var(--retro-green, #33ff33)",
    border: "2px solid var(--retro-green-dim, #1a8c1a)",
    borderRadius: "0",
    cursor: "pointer",
    fontSize: "15px",
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    flex: 1,
  },
  toneButtonActive: {
    borderColor: "var(--retro-green, #33ff33)",
    backgroundColor: "rgba(51, 255, 51, 0.15)",
    boxShadow: "0 0 10px rgba(51, 255, 51, 0.3)",
    fontWeight: "bold" as const,
  },
  textarea: {
    width: "100%",
    borderRadius: "0",
    border: "2px solid var(--retro-green-dim, #1a8c1a)",
    padding: "10px",
    fontSize: "16px",
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    backgroundColor: "rgba(51, 255, 51, 0.05)",
    color: "var(--retro-green, #33ff33)",
    resize: "none" as const,
    boxSizing: "border-box" as const,
  },
  sliderContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  sliderLabel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  sliderLabelText: {
    fontSize: "15px",
    letterSpacing: "1px",
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    color: "var(--retro-green, #33ff33)",
  },
  sliderTrack: {
    position: "relative" as const,
    height: "28px",
    backgroundColor: "rgba(51, 255, 51, 0.1)",
    border: "2px solid var(--retro-green-dim, #1a8c1a)",
  },
  slider: {
    width: "100%",
    height: "100%",
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    background: "transparent",
    cursor: "pointer",
    margin: 0,
  },
  footer: {
    textAlign: "center" as const,
    color: "var(--retro-green-dim, #1a8c1a)",
    fontSize: "14px",
    marginTop: "10px",
  },
};
