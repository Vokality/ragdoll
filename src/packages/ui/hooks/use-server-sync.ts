import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { CharacterController } from '../../character/controllers/character-controller';
import type {
  JointCommand,
  FacialStatePayload,
  SpeechBubblePayload,
} from '../../character/types';

interface UseServerSyncOptions {
  serverUrl?: string;
  autoConnect?: boolean;
}

interface ServerSyncState {
  isConnected: boolean;
  error: string | null;
}

export function useServerSync(
  controller: CharacterController | null,
  options: UseServerSyncOptions = {}
) {
  const { serverUrl = 'http://localhost:3001', autoConnect = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<ServerSyncState>({
    isConnected: false,
    error: null,
  });

  useEffect(() => {
    if (!autoConnect || !controller) return;

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to ragdoll server');
      setState({ isConnected: true, error: null });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from ragdoll server');
      setState({ isConnected: false, error: null });
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setState({ isConnected: false, error: error.message });
    });

    socket.on('facial-state-broadcast', (payload: FacialStatePayload) => {
      applyRemoteState(controller, payload);
    });

    socket.on('joint-broadcast', (command: JointCommand) => {
      controller.setJointRotation(command);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [controller, serverUrl, autoConnect]);

  const disconnect = () => {
    socketRef.current?.disconnect();
  };

  const connect = () => {
    socketRef.current?.connect();
  };

  return {
    ...state,
    disconnect,
    connect,
  };
}

function applyRemoteState(controller: CharacterController, payload: FacialStatePayload) {
  if (payload.mood) {
    controller.setMood(payload.mood.value, payload.mood.duration);
  }

  if (payload.action) {
    controller.triggerAction(payload.action.type, payload.action.duration);
  }

  if (payload.clearAction) {
    controller.clearAction();
  }

  if (payload.headPose) {
    const { yaw, pitch, duration } = payload.headPose;
    controller.setHeadPose({ yaw, pitch }, duration);
  }

  if (payload.bubble) {
    controller.setSpeechBubble(normalizeBubble(payload.bubble));
  }
}

function normalizeBubble(payload: SpeechBubblePayload): SpeechBubblePayload {
  return {
    text: payload.text ?? null,
    tone: payload.tone ?? 'default',
  };
}
