import { useEffect, useState } from 'react';
import { CharacterController } from '../../character/controllers/character-controller';
import type { SpeechBubbleState } from '../../character/types';

const EMPTY_BUBBLE: SpeechBubbleState = { text: null, tone: 'default' };

export function useBubbleState(controller: CharacterController | null) {
  const [bubble, setBubble] = useState<SpeechBubbleState>(EMPTY_BUBBLE);

  useEffect(() => {
    if (!controller) {
      setBubble(EMPTY_BUBBLE);
      return;
    }

    let timer: number | null = null;
    let mounted = true;

    const tick = () => {
      if (!mounted) return;
      setBubble(controller.getSpeechBubble());
      timer = window.setTimeout(tick, 100);
    };

    tick();

    return () => {
      mounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [controller]);

  return bubble;
}
