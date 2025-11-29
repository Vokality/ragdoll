import { useEffect, useState, useRef } from "react";
import { CharacterController } from "@vokality/ragdoll";
import type { SpeechBubbleState } from "@vokality/ragdoll";

const EMPTY_BUBBLE: SpeechBubbleState = { text: null, tone: "default" };

export function useBubbleState(controller: CharacterController | null) {
  const [bubble, setBubble] = useState<SpeechBubbleState>(EMPTY_BUBBLE);
  const controllerRef = useRef<CharacterController | null>(null);

  // Keep ref in sync via effect (not during render)
  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);

  useEffect(() => {
    let timer: number | null = null;
    let mounted = true;

    const tick = () => {
      if (!mounted) return;
      const ctrl = controllerRef.current;
      setBubble(ctrl ? ctrl.getSpeechBubble() : EMPTY_BUBBLE);
      timer = window.setTimeout(tick, 100);
    };

    // Start polling asynchronously to avoid synchronous setState in effect
    timer = window.setTimeout(tick, 0);

    return () => {
      mounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []); // Run once on mount

  return bubble;
}
