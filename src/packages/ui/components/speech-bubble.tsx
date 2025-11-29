import type { CSSProperties } from 'react';

interface SpeechBubbleProps {
  text: string | null;
  tone?: 'default' | 'whisper' | 'shout';
}

const toneStyles: Record<NonNullable<SpeechBubbleProps['tone']>, CSSProperties> = {
  default: {
    backgroundColor: 'var(--retro-bg, #0a0a0a)',
    color: 'var(--retro-green, #33ff33)',
    borderColor: 'var(--retro-green, #33ff33)',
    textShadow: '0 0 8px rgba(51, 255, 51, 0.6)',
    boxShadow: '0 0 15px rgba(51, 255, 51, 0.3), inset 0 0 30px rgba(51, 255, 51, 0.05)',
  },
  whisper: {
    backgroundColor: 'var(--retro-bg, #0a0a0a)',
    color: 'var(--retro-green-dim, #1a8c1a)',
    borderColor: 'var(--retro-green-dim, #1a8c1a)',
    textShadow: '0 0 4px rgba(51, 255, 51, 0.3)',
    boxShadow: '0 0 8px rgba(51, 255, 51, 0.1)',
    opacity: 0.85,
  },
  shout: {
    backgroundColor: 'var(--retro-bg, #0a0a0a)',
    color: 'var(--retro-amber, #ffb000)',
    borderColor: 'var(--retro-amber, #ffb000)',
    textShadow: '0 0 12px rgba(255, 176, 0, 0.8)',
    boxShadow: '0 0 25px rgba(255, 176, 0, 0.4), inset 0 0 30px rgba(255, 176, 0, 0.05)',
    animation: 'pulse-glow-amber 0.8s infinite',
  },
};

const toneLabels: Record<NonNullable<SpeechBubbleProps['tone']>, string> = {
  default: 'MSG',
  whisper: 'WHISPER',
  shout: 'SHOUT',
};

export function SpeechBubble({ text, tone = 'default' }: SpeechBubbleProps) {
  if (!text) return null;

  return (
    <div style={{
      ...styles.container,
      ...toneStyles[tone],
    }}>
      {/* ASCII art corners */}
      <div style={styles.cornerTL}>╔</div>
      <div style={styles.cornerTR}>╗</div>
      <div style={styles.cornerBL}>╚</div>
      <div style={styles.cornerBR}>╝</div>
      
      {/* Header label */}
      <div style={{
        ...styles.header,
        color: tone === 'shout' ? 'var(--retro-amber, #ffb000)' : 
               tone === 'whisper' ? 'var(--retro-green-dim, #1a8c1a)' : 
               'var(--retro-green, #33ff33)',
      }}>
        [{toneLabels[tone]}]
      </div>
      
      {/* Message content */}
      <div style={styles.content}>
        {'>'} {text}
        <span style={styles.cursor}>_</span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed' as const,
    top: '70px',
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: '480px',
    minWidth: '200px',
    padding: '16px 20px 14px',
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    fontSize: '20px',
    letterSpacing: '0.5px',
    border: '2px solid',
    zIndex: 999,
    pointerEvents: 'none' as const,
    animation: 'fade-in 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  cornerTL: {
    position: 'absolute' as const,
    top: '-2px',
    left: '-2px',
    fontSize: '18px',
    lineHeight: 1,
  },
  cornerTR: {
    position: 'absolute' as const,
    top: '-2px',
    right: '-2px',
    fontSize: '18px',
    lineHeight: 1,
  },
  cornerBL: {
    position: 'absolute' as const,
    bottom: '-2px',
    left: '-2px',
    fontSize: '18px',
    lineHeight: 1,
  },
  cornerBR: {
    position: 'absolute' as const,
    bottom: '-2px',
    right: '-2px',
    fontSize: '18px',
    lineHeight: 1,
  },
  header: {
    fontSize: '16px',
    marginBottom: '6px',
    letterSpacing: '1px',
  },
  content: {
    lineHeight: 1.4,
  },
  cursor: {
    animation: 'blink 1s infinite',
    marginLeft: '2px',
  },
};
