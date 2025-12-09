import { useState, useEffect } from "react";
import { SetupScreen } from "./screens/setup-screen";
import { SetupExtensionsScreen } from "./screens/setup-extensions-screen";
import { ChatScreen } from "./screens/chat-screen";
import { LoadingScreen } from "./components/loading-screen";

type AppState = "loading" | "setup-extensions" | "setup-api-key" | "ready";

export function App() {
  const [appState, setAppState] = useState<AppState>("loading");

  useEffect(() => {
    async function checkInitialState() {
      // First check if core extensions need to be installed
      const needsCoreSetup = await window.electronAPI.needsCoreSetup();
      
      if (needsCoreSetup) {
        setAppState("setup-extensions");
        return;
      }

      // Then check if API key exists
      const hasKey = await window.electronAPI.hasApiKey();
      
      if (!hasKey) {
        setAppState("setup-api-key");
        return;
      }

      // All setup complete
      setAppState("ready");
    }

    checkInitialState();
  }, []);

  // Show loading while checking initial state
  if (appState === "loading") {
    return <LoadingScreen />;
  }

  // Show extension setup screen if core extensions need to be installed
  if (appState === "setup-extensions") {
    return (
      <SetupExtensionsScreen
        onComplete={async () => {
          // After extensions setup, check for API key
          const hasKey = await window.electronAPI.hasApiKey();
          setAppState(hasKey ? "ready" : "setup-api-key");
        }}
      />
    );
  }

  // Show API key setup screen if no API key
  if (appState === "setup-api-key") {
    return <SetupScreen onComplete={() => setAppState("ready")} />;
  }

  // Show chat screen if everything is set up
  return (
    <ChatScreen
      onLogout={() => setAppState("setup-api-key")}
    />
  );
}

