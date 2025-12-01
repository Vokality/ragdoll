import { useCallback, useState } from "react";
import {
  RagdollCharacter,
  CharacterController,
  PomodoroTimer,
} from "@vokality/ragdoll";
import type { RagdollTheme } from "@vokality/ragdoll";

interface SceneProps {
  onControllerReady: (controller: CharacterController) => void;
  theme?: RagdollTheme;
  variantId?: string;
}

export function Scene({ onControllerReady, theme, variantId }: SceneProps) {
  const [controller, setController] = useState<CharacterController | null>(
    null,
  );

  const handleControllerReady = useCallback(
    (ctrl: CharacterController) => {
      setController(ctrl);
      onControllerReady(ctrl);
    },
    [onControllerReady],
  );

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        backgroundColor: "#0b0c12",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <RagdollCharacter
        onControllerReady={handleControllerReady}
        theme={theme}
        variant={variantId}
      />
      {controller && (
        <PomodoroTimer
          controller={controller.getPomodoroController()}
          theme={theme}
        />
      )}
    </div>
  );
}
