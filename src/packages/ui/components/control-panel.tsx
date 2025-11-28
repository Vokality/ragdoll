import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { CharacterController } from '../../character/controllers/character-controller';
import type { FacialMood } from '../../character/types';

interface ControlPanelProps {
  controller: CharacterController | null;
}

const moods: FacialMood[] = ['neutral', 'smile', 'frown', 'laugh', 'angry', 'sad'];
const tones = ['default', 'whisper', 'shout'] as const;
const yawLimitDeg = 35;
const pitchLimitDeg = 20;

export function ControlPanel({ controller }: ControlPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [currentMood, setCurrentMood] = useState<FacialMood>('neutral');
  const [activeAction, setActiveAction] = useState<'wink' | 'talk' | null>(null);
  const [speechText, setSpeechText] = useState('');
  const [bubbleTone, setBubbleTone] = useState<(typeof tones)[number]>('default');
  const [yawDeg, setYawDeg] = useState(0);
  const [pitchDeg, setPitchDeg] = useState(0);

  const headPoseInfo = useMemo(() => ({
    yawLabel: `${yawDeg.toFixed(0)}°`,
    pitchLabel: `${pitchDeg.toFixed(0)}°`,
  }), [yawDeg, pitchDeg]);

  const handleMood = (mood: FacialMood) => {
    if (!controller) return;
    controller.setMood(mood, 0.35);
    setCurrentMood(mood);
  };

  const handleWink = () => {
    if (!controller) return;
    controller.triggerAction('wink', 0.7);
    setActiveAction('wink');
    setTimeout(() => setActiveAction((current) => (current === 'wink' ? null : current)), 800);
  };

  const handleTalkToggle = () => {
    if (!controller) return;
    if (activeAction === 'talk') {
      controller.clearAction();
      setActiveAction(null);
      return;
    }
    controller.triggerAction('talk');
    setActiveAction('talk');
  };

  const handleSpeechChange = (text: string) => {
    setSpeechText(text);
    const trimmed = text.trim();
    controller?.setSpeechBubble({ text: trimmed ? text : null, tone: bubbleTone });
    if (trimmed && activeAction !== 'talk') {
      setActiveAction('talk');
    }
    if (!trimmed && activeAction === 'talk') {
      setActiveAction(null);
    }
  };

  const handleToneChange = (tone: (typeof tones)[number]) => {
    setBubbleTone(tone);
    controller?.setSpeechBubble({ text: speechText.trim() ? speechText : null, tone });
  };

  const updateHeadPose = (axis: 'yaw' | 'pitch', valueDeg: number) => {
    if (!controller) return;
    if (axis === 'yaw') {
      setYawDeg(valueDeg);
    } else {
      setPitchDeg(valueDeg);
    }

    const radians = THREE.MathUtils.degToRad(valueDeg);
    controller.setHeadPose({ [axis]: radians }, 0.3);
  };

  return (
    <div style={{
      ...styles.container,
      width: isCollapsed ? 'auto' : '320px',
      padding: isCollapsed ? '0' : '18px',
    }}>
      <button
        style={styles.toggleButton}
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Open Controls' : 'Close Controls'}
      >
        {isCollapsed ? '◀ Face Controls' : '▶'}
      </button>

      {!isCollapsed && (
        <div style={styles.panel}>
          <h2 style={styles.title}>Facial Playground</h2>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Mood</h3>
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
                  {mood}
                </button>
              ))}
            </div>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Actions</h3>
            <div style={styles.buttonGroup}>
              <button style={styles.button} onClick={handleWink}>
                😉 Wink
              </button>
              <button
                style={{
                  ...styles.button,
                  backgroundColor: activeAction === 'talk' ? '#FF9800' : '#4CAF50',
                }}
                onClick={handleTalkToggle}
              >
                💬 {activeAction === 'talk' ? 'Stop Talk' : 'Talk'}
              </button>
              <button style={styles.subtleButton} onClick={() => { controller?.clearAction(); setActiveAction(null); }}>
                ⛔ Clear
              </button>
            </div>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Speech Bubble</h3>
            <textarea
              value={speechText}
              onChange={(event) => handleSpeechChange(event.target.value)}
              placeholder="Tell the world something..."
              style={styles.textarea}
              rows={3}
            />
            <div style={styles.buttonGroup}>
              {tones.map((tone) => (
                <button
                  key={tone}
                  style={{
                    ...styles.expressionButton,
                    ...(bubbleTone === tone ? styles.activeExpression : {}),
                  }}
                  onClick={() => handleToneChange(tone)}
                >
                  {tone}
                </button>
              ))}
              <button style={styles.subtleButton} onClick={() => handleSpeechChange('')}>
                Clear Bubble
              </button>
            </div>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Head Pose</h3>
            <label style={styles.sliderLabel}>
              Yaw {headPoseInfo.yawLabel}
              <input
                type="range"
                min={-yawLimitDeg}
                max={yawLimitDeg}
                value={yawDeg}
                onChange={(event) => updateHeadPose('yaw', Number(event.target.value))}
                style={styles.slider}
              />
            </label>
            <label style={styles.sliderLabel}>
              Pitch {headPoseInfo.pitchLabel}
              <input
                type="range"
                min={-pitchLimitDeg}
                max={pitchLimitDeg}
                value={pitchDeg}
                onChange={(event) => updateHeadPose('pitch', Number(event.target.value))}
                style={styles.slider}
              />
            </label>
          </section>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed' as const,
    top: 0,
    right: 0,
    width: '320px',
    height: '100vh',
    backgroundColor: 'rgba(7, 7, 12, 0.84)',
    color: '#fff',
    padding: '18px',
    boxSizing: 'border-box' as const,
    overflowY: 'auto' as const,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    zIndex: 1000,
  },
  toggleButton: {
    position: 'absolute' as const,
    top: '10px',
    left: '-130px',
    padding: '10px 14px',
    backgroundColor: 'rgba(7, 7, 12, 0.84)',
    color: '#fff',
    border: 'none',
    borderRadius: '4px 0 0 4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    whiteSpace: 'nowrap' as const,
  },
  panel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '18px',
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '20px',
    fontWeight: 'bold',
    borderBottom: '2px solid #fff',
    paddingBottom: '8px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '600',
    color: '#d7d7d7',
  },
  expressionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
  },
  expressionButton: {
    padding: '8px 12px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    textTransform: 'capitalize' as const,
    transition: 'background-color 0.2s',
  },
  activeExpression: {
    backgroundColor: '#FF9800',
    fontWeight: 'bold',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  button: {
    padding: '10px 15px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    flex: 1,
  },
  subtleButton: {
    padding: '10px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    color: '#fff',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    flex: 0,
  },
  textarea: {
    width: '100%',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '8px',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#fff',
  },
  sliderLabel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    fontSize: '13px',
  },
  slider: {
    width: '100%',
  },
};
