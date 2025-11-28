import type { CSSProperties } from 'react';

interface SpeechBubbleProps {
  text: string | null;
  tone?: 'default' | 'whisper' | 'shout';
}

const toneStyles: Record<NonNullable<SpeechBubbleProps['tone']>, CSSProperties> = {
  default: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    color: '#111',
  },
  whisper: {
    backgroundColor: 'rgba(173, 216, 230, 0.9)',
    color: '#0b3c49',
  },
  shout: {
    backgroundColor: 'rgba(255, 152, 0, 0.95)',
    color: '#2b1300',
    boxShadow: '0 0 18px rgba(255, 152, 0, 0.45)',
  },
};

export function SpeechBubble({ text, tone = 'default' }: SpeechBubbleProps) {
  if (!text) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '65px',
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '420px',
      padding: '14px 18px',
      borderRadius: '18px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '1.1rem',
      letterSpacing: '0.4px',
      textAlign: 'center' as const,
      border: '3px solid rgba(0, 0, 0, 0.15)',
      zIndex: 999,
      transition: 'opacity 0.2s ease',
      pointerEvents: 'none' as const,
      ...toneStyles[tone],
    }}>
      {text}
    </div>
  );
}
