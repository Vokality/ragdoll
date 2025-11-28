import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { CharacterController } from '../character/controllers/character-controller';
import type {
  JointCommand,
  JointName,
  FacialStatePayload,
  SpeechBubblePayload,
} from '../character/types';

export class RagdollAPIServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private io: SocketIOServer;
  private characterController: CharacterController | null = null;
  private stateUpdateInterval: NodeJS.Timeout | null = null;
  private port: number;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  public setCharacterController(controller: CharacterController): void {
    this.characterController = controller;
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    this.app.post('/api/facial-state', (req, res) => {
      if (!this.characterController) {
        return res.status(503).json({ error: 'Character controller not initialized' });
      }

      try {
        const payload: FacialStatePayload = req.body;
        this.applyFacialPayload(payload);
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: String(error) });
      }
    });

    this.app.post('/api/joint', (req, res) => {
      if (!this.characterController) {
        return res.status(503).json({ error: 'Character controller not initialized' });
      }

      try {
        const command: JointCommand = req.body;
        this.characterController.setJointRotation(command);
        this.io.emit('joint-broadcast', command);
        res.json({ success: true, joint: command.joint });
      } catch (error) {
        res.status(400).json({ error: String(error) });
      }
    });

    this.app.get('/api/state', (_req, res) => {
      if (!this.characterController) {
        return res.status(503).json({ error: 'Character controller not initialized' });
      }

      try {
        const state = this.characterController.getState();
        const serializedState = {
          headPose: state.headPose,
          joints: Object.fromEntries(
            Object.entries(state.joints).map(([key, value]) => [key, { x: value.x, y: value.y, z: value.z }])
          ),
          mood: state.mood,
          action: state.action,
          bubble: state.bubble,
          animation: state.animation,
        };
        res.json(serializedState);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/api/moods', (_req, res) => {
      res.json({ moods: ['neutral', 'smile', 'frown', 'laugh', 'angry', 'sad'] });
    });

    this.app.get('/api/joints', (_req, res) => {
      const joints: JointName[] = ['headPivot', 'neck'];
      res.json({ joints });
    });
  }

  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('facial-state', (payload: FacialStatePayload) => {
        this.applyFacialPayload(payload, false);
      });

      socket.on('joint', (command: JointCommand) => {
        if (this.characterController) {
          this.characterController.setJointRotation(command);
          this.io.emit('joint-broadcast', command);
        }
      });

      socket.on('subscribe-state', () => {
        if (this.stateUpdateInterval) {
          clearInterval(this.stateUpdateInterval);
        }

        this.stateUpdateInterval = setInterval(() => {
          if (this.characterController) {
            socket.emit('state-update', this.characterController.getState());
          }
        }, 100);
      });

      socket.on('unsubscribe-state', () => {
        if (this.stateUpdateInterval) {
          clearInterval(this.stateUpdateInterval);
          this.stateUpdateInterval = null;
        }
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (this.stateUpdateInterval) {
          clearInterval(this.stateUpdateInterval);
          this.stateUpdateInterval = null;
        }
      });
    });
  }

  private applyFacialPayload(payload: FacialStatePayload, broadcast: boolean = true): void {
    if (!this.characterController) {
      return;
    }

    const sanitizedPayload: FacialStatePayload = { ...payload };

    if (payload.mood) {
      this.characterController.setMood(payload.mood.value, payload.mood.duration);
    }

    if (payload.action) {
      this.characterController.triggerAction(payload.action.type, payload.action.duration);
    }

    if (payload.clearAction) {
      this.characterController.clearAction();
    }

    if (payload.headPose) {
      const { yaw, pitch, duration } = payload.headPose;
      this.characterController.setHeadPose({ yaw, pitch }, duration);
    }

    if (payload.bubble) {
      const normalizedBubble = this.normalizeBubble(payload.bubble);
      this.characterController.setSpeechBubble(normalizedBubble);
      sanitizedPayload.bubble = normalizedBubble;
    }

    if (broadcast) {
      this.io.emit('facial-state-broadcast', sanitizedPayload);
    }
  }

  private normalizeBubble(payload: SpeechBubblePayload): SpeechBubblePayload {
    return {
      text: payload.text ?? null,
      tone: payload.tone ?? 'default',
    };
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`Ragdoll API server listening on port ${this.port}`);
        console.log(`REST API: http://localhost:${this.port}/api`);
        console.log(`WebSocket: ws://localhost:${this.port}`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.stateUpdateInterval) {
        clearInterval(this.stateUpdateInterval);
      }
      this.io.close();
      this.server.close(() => {
        console.log('API server stopped');
        resolve();
      });
    });
  }
}
