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

const wrapperStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  maxWidth: "320px",
  maxHeight: "380px",
};

export function RagdollCharacter(props: RagdollCharacterProps) {
  return <CharacterInstance key={props.variant} {...props} />;
}

function CharacterInstance({
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
  useEffect(() => {
    controller.setTheme(theme.id);
  }, [controller, theme.id]);

  useEffect(() => {
    onControllerReady(controller);
  }, [onControllerReady, controller]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    wrapper.appendChild(canvas);

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
      if (deltaTime < 1 / 60) return;
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
      canvas.remove();
    };
  }, [controller]);

  useEffect(() => () => controller.destroy(), [controller]);

  return <div ref={wrapperRef} style={wrapperStyle} />;
}
