import { useEffect, useState } from "react";
import { LoadingScreen } from "./components/loading-screen";
import type { AppState } from "./application/app-service";
import type { RendererServices } from "./application/renderer-services";
import { ChatScreen } from "./screens/chat-screen";
import { SetupScreen } from "./screens/setup-screen";

export interface AppProps {
  services: RendererServices;
}

export function App({ services }: AppProps) {
  const [appState, setAppState] = useState<AppState>("loading");
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void services.app
      .resolveInitialState()
      .then((state) => {
        if (active) setAppState(state);
      })
      .catch((error: unknown) => {
        if (active) {
          setStartupError(
            error instanceof Error
              ? error.message
              : "Application startup failed",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [services.app]);

  if (startupError) {
    return (
      <main className="application-error" role="alert">
        <h1>Lumen could not start</h1>
        <p>{startupError}</p>
      </main>
    );
  }

  if (appState === "loading") return <LoadingScreen />;

  if (appState === "setup-api-key") {
    return (
      <SetupScreen
        service={services.setup}
        onComplete={() => setAppState("ready")}
      />
    );
  }

  return (
    <ChatScreen
      chatService={services.chat}
      characterCommands={services.characterCommands}
      extensionSlots={services.extensionSlots}
      extensions={services.extensions}
      onLogout={() => setAppState("setup-api-key")}
    />
  );
}
