import { useCallback } from "react";
import { RagdollCharacter, CharacterController } from "@vokality/ragdoll";
import type { RagdollTheme } from "@vokality/ragdoll";

interface SceneProps {
  onControllerReady: (controller: CharacterController) => void;
  theme?: RagdollTheme;
}

export function Scene({ onControllerReady, theme }: SceneProps) {
  const handleControllerReady = useCallback(
    (ctrl: CharacterController) => {
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
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <RagdollCharacter
        onControllerReady={handleControllerReady}
        theme={theme}
      />
    </div>
  );
}
