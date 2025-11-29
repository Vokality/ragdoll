import { useState, useCallback, useEffect, useMemo } from 'react';
import { Scene } from './packages/ui/components/scene';
import { ControlPanel } from './packages/ui/components/control-panel';
import { SpeechBubble } from './packages/ui/components/speech-bubble';
import { ThemeSelector } from './packages/ui/components/theme-selector';
import { CharacterController } from './packages/character/controllers/character-controller';
import { useServerSync } from './packages/ui/hooks/use-server-sync';
import { useBubbleState } from './packages/ui/hooks/use-bubble-state';
import { getTheme, getDefaultTheme } from './packages/character/themes';
import './App.css';

// Get API URL from environment or use default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getOrCreateSessionId(): string {
  const stored = localStorage.getItem('ragdoll-session-id');
  if (stored) {
    return stored;
  }
  // Generate a simple session ID (not cryptographically secure, but good enough)
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem('ragdoll-session-id', sessionId);
  return sessionId;
}

function getOrCreateThemeId(): string {
  const stored = localStorage.getItem('ragdoll-theme-id');
  if (stored) {
    return stored;
  }
  return getDefaultTheme().id;
}

function App() {
  const [controller, setController] = useState<CharacterController | null>(null);
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const [themeId, setThemeId] = useState<string>(() => getOrCreateThemeId());
  
  // Derive theme from themeId - no need for separate state
  const theme = useMemo(() => getTheme(themeId), [themeId]);

  // Connect to the API server to receive MCP commands
  const { isConnected } = useServerSync(controller, {
    serverUrl: API_URL,
    autoConnect: true,
    sessionId,
  });

  // Sync theme to server when connected
  const syncThemeToServer = useCallback(async (themeIdToSync: string) => {
    try {
      const response = await fetch(`${API_URL}/api/session/theme?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: themeIdToSync }),
      });
      if (!response.ok) {
        console.warn('Failed to sync theme to server');
      }
    } catch (error) {
      console.warn('Error syncing theme to server:', error);
    }
  }, [sessionId]);

  // Load theme from server on connect
  useEffect(() => {
    if (!isConnected) return;

    const loadThemeFromServer = async () => {
      try {
        const response = await fetch(`${API_URL}/api/session/theme?sessionId=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.themeId && data.themeId !== themeId) {
            // Server has a different theme, use it
            setThemeId(data.themeId);
            localStorage.setItem('ragdoll-theme-id', data.themeId);
          } else {
            // Sync our theme to server
            syncThemeToServer(themeId);
          }
        }
      } catch (error) {
        console.warn('Error loading theme from server:', error);
        // Fallback: sync our theme to server
        syncThemeToServer(themeId);
      }
    };

    loadThemeFromServer();
  }, [isConnected, sessionId, themeId, syncThemeToServer]);

  // Handle side effects when themeId changes
  useEffect(() => {
    localStorage.setItem('ragdoll-theme-id', themeId);
    // Update controller theme if it exists
    if (controller) {
      controller.setTheme(themeId);
    }
    // Sync to server if connected
    if (isConnected) {
      syncThemeToServer(themeId);
    }
  }, [themeId, controller, isConnected, syncThemeToServer]);

  const bubbleState = useBubbleState(controller);

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    setController(ctrl);
    // Set initial theme on controller
    ctrl.setTheme(themeId);
  }, [themeId]);

  return (
    <div className="app">
      {/* Scanline overlay for CRT effect */}
      <div className="scanlines" />
      
      <Scene onControllerReady={handleControllerReady} theme={theme} />
      <SpeechBubble text={bubbleState.text} tone={bubbleState.tone} />
      <ControlPanel controller={controller} />
      
      {/* Theme selector */}
      <div style={styles.themeSelectorWrapper}>
        <ThemeSelector currentThemeId={themeId} onThemeChange={setThemeId} />
      </div>
      
      {/* Connection status indicator */}
      <div style={{
        ...styles.statusIndicator,
        borderColor: isConnected ? 'var(--retro-green, #33ff33)' : 'var(--retro-red, #ff3333)',
      }}>
        <span style={{
          ...styles.statusLed,
          backgroundColor: isConnected ? 'var(--retro-green, #33ff33)' : 'var(--retro-red, #ff3333)',
          boxShadow: isConnected 
            ? '0 0 8px var(--retro-green, #33ff33)' 
            : '0 0 8px var(--retro-red, #ff3333)',
          animation: isConnected ? 'led-blink 2s infinite' : 'none',
        }} />
        <span style={styles.statusText}>
          {isConnected ? 'LINK_OK' : 'NO_LINK'}
        </span>
      </div>
      
      {/* Session ID display */}
      <div style={styles.sessionIndicator}>
        <span style={styles.sessionLabel}>SID:</span>
        <span style={styles.sessionValue}>{sessionId.substring(0, 12)}...</span>
      </div>
    </div>
  );
}

const styles = {
  themeSelectorWrapper: {
    position: 'fixed' as const,
    top: '12px',
    left: '12px',
    zIndex: 1000,
  },
  statusIndicator: {
    position: 'fixed' as const,
    bottom: '12px',
    left: '12px',
    padding: '8px 14px',
    backgroundColor: 'var(--retro-bg, #0a0a0a)',
    border: '2px solid',
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    fontSize: '16px',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  statusLed: {
    width: '12px',
    height: '12px',
    borderRadius: '0',
  },
  statusText: {
    color: 'var(--retro-green, #33ff33)',
    textShadow: '0 0 6px rgba(51, 255, 51, 0.5)',
    letterSpacing: '1px',
  },
  sessionIndicator: {
    position: 'fixed' as const,
    bottom: '12px',
    right: '12px',
    padding: '8px 14px',
    backgroundColor: 'var(--retro-bg, #0a0a0a)',
    border: '2px solid var(--retro-green-dim, #1a8c1a)',
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    fontSize: '16px',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sessionLabel: {
    color: 'var(--retro-green-dim, #1a8c1a)',
  },
  sessionValue: {
    color: 'var(--retro-green, #33ff33)',
    textShadow: '0 0 4px rgba(51, 255, 51, 0.4)',
  },
};

export default App;
