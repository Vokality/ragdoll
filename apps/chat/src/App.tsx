import { useState, useEffect } from "react";
import { SetupScreen } from "./screens/setup-screen";
import { ChatScreen } from "./screens/chat-screen";
import { LoadingScreen } from "./components/loading-screen";

export function App() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if API key exists on mount
    window.electronAPI.hasApiKey().then(setHasKey);
  }, []);

  // Show loading while checking for API key
  if (hasKey === null) {
    return <LoadingScreen />;
  }

  // Show setup screen if no API key
  if (!hasKey) {
    return <SetupScreen onComplete={() => setHasKey(true)} />;
  }

  // Show chat screen if API key exists
  return <ChatScreen onLogout={() => setHasKey(false)} />;
}

