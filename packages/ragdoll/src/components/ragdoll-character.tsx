import React, { useEffect, useRef, useState } from "react";
import { CharacterController } from "../controllers/character-controller";
import type { RagdollTheme } from "../themes/types";
import { computeRenderData } from "./render-data";
import { CharacterScene } from "../renderers/three/character-scene";

interface RagdollCharacterProps {
  onControllerReady: (controller: CharacterController) => void;
  onEventSubscriberError: (error: unknown) => void;
  theme: RagdollTheme;
  variant: string;
}

const canvasStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
};

const wrapperStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  maxWidth: "320px",
  maxHeight: "380px",
};

export function RagdollCharacter({
  onControllerReady,
  onEventSubscriberError,
  theme,
  variant,
}: RagdollCharacterProps) {
  const [controller] = useState(
    () =>
      new CharacterController({
        themeId: theme.id,
        variantId: variant,
        onEventSubscriberError,
      }),
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [appliedTheme, setAppliedTheme] = useState(theme);

  if (appliedTheme !== theme) {
    controller.setTheme(theme.id);
    setAppliedTheme(theme);
  }

  useEffect(() => {
    onControllerReady(controller);
  }, [onControllerReady, controller]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const scene = new CharacterScene(canvas);

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      scene.setSize(rect.width, rect.height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    resize();

    let isMounted = true;
    let lastTime = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (!isMounted) return;
      frame = requestAnimationFrame(tick);
      const deltaTime = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      controller.update(deltaTime);
      scene.setData(computeRenderData(controller));
    };
    frame = requestAnimationFrame(tick);

    return () => {
      isMounted = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.dispose();
    };
  }, [controller]);

  useEffect(() => () => controller.destroy(), [controller]);

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
}
