import { useState, useCallback } from 'react';
import { Scene } from './packages/ui/components/scene';
import { ControlPanel } from './packages/ui/components/control-panel';
import { SpeechBubble } from './packages/ui/components/speech-bubble';
import { CharacterController } from './packages/character/controllers/character-controller';
import { useServerSync } from './packages/ui/hooks/use-server-sync';
import { useBubbleState } from './packages/ui/hooks/use-bubble-state';
import './App.css';

function App() {
  const [controller, setController] = useState<CharacterController | null>(null);

  // Connect to the API server to receive MCP commands
  const { isConnected } = useServerSync(controller, {
    serverUrl: 'http://localhost:3001',
    autoConnect: true,
  });

  const bubbleState = useBubbleState(controller);

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    setController(ctrl);
  }, []);

  return (
    <div className="app">
      <Scene onControllerReady={handleControllerReady} />
      <SpeechBubble text={bubbleState.text} tone={bubbleState.tone} />
      <ControlPanel controller={controller} />
      {/* Connection status indicator */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        padding: '8px 12px',
        borderRadius: '4px',
        backgroundColor: isConnected ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)',
        color: 'white',
        fontSize: '12px',
        fontFamily: 'system-ui, sans-serif',
        zIndex: 1000,
      }}>
        {isConnected ? '● Connected to server' : '○ Disconnected'}
      </div>
    </div>
  );
}

export default App;
