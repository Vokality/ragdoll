import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { CharacterController } from '../character/controllers/character-controller';
import type {
  JointCommand,
  JointName,
  FacialStatePayload,
  SpeechBubblePayload,
} from '../character/types';

interface Session {
  id: string;
  controller: CharacterController;
  sockets: Set<string>;
  stateIntervals: Map<string, NodeJS.Timeout>;
  themeId: string;
  createdAt: Date;
}

export class RagdollAPIServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private io: SocketIOServer;
  private sessions: Map<string, Session> = new Map();
  private socketToSession: Map<string, string> = new Map();
  private port: number;
  // Backward compatibility: default session
  private defaultSessionId: string = 'default';

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

    // Create default session for backward compatibility
    this.createSession(this.defaultSessionId);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private createSession(sessionId: string, themeId?: string): Session {
    const session: Session = {
      id: sessionId,
      controller: new CharacterController(themeId),
      sockets: new Set(),
      stateIntervals: new Map(),
      themeId: themeId || 'default',
      createdAt: new Date(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  private getSession(sessionId: string): Session {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = this.createSession(sessionId);
    }
    return session;
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clear all intervals
    session.stateIntervals.forEach((interval) => clearInterval(interval));
    session.stateIntervals.clear();

    // Remove session if empty (except default)
    if (session.sockets.size === 0 && sessionId !== this.defaultSessionId) {
      this.sessions.delete(sessionId);
    }
  }

  public setCharacterController(controller: CharacterController): void {
    // Set controller for default session (backward compatibility)
    const defaultSession = this.getSession(this.defaultSessionId);
    defaultSession.controller = controller;
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Create new session
    this.app.post('/api/session/create', (_req, res) => {
      const sessionId = randomUUID();
      this.createSession(sessionId);
      res.json({ sessionId, success: true });
    });

    // List active sessions
    this.app.get('/api/sessions', (_req, res) => {
      const sessions = Array.from(this.sessions.values()).map((session) => ({
        id: session.id,
        socketCount: session.sockets.size,
        themeId: session.themeId,
        createdAt: session.createdAt.toISOString(),
      }));
      res.json({ sessions });
    });

    // Get session theme
    this.app.get('/api/session/theme', (req, res) => {
      const sessionId = (req.query.sessionId as string) || this.defaultSessionId;
      const session = this.getSession(sessionId);
      res.json({ themeId: session.themeId });
    });

    // Set session theme
    this.app.post('/api/session/theme', (req, res) => {
      const sessionId = (req.query.sessionId as string) || this.defaultSessionId;
      const { themeId } = req.body;
      if (!themeId || typeof themeId !== 'string') {
        return res.status(400).json({ error: 'themeId is required' });
      }
      const session = this.getSession(sessionId);
      session.themeId = themeId;
      session.controller.setTheme(themeId);
      res.json({ success: true, themeId });
    });

    this.app.post('/api/facial-state', (req, res) => {
      const sessionId = (req.query.sessionId as string) || this.defaultSessionId;
      const session = this.getSession(sessionId);

      try {
        const payload: FacialStatePayload = req.body;
        this.applyFacialPayload(session, payload, true);
        res.json({ success: true, sessionId });
      } catch (error) {
        res.status(400).json({ error: String(error) });
      }
    });

    this.app.post('/api/joint', (req, res) => {
      const sessionId = (req.query.sessionId as string) || this.defaultSessionId;
      const session = this.getSession(sessionId);

      try {
        const command: JointCommand = req.body;
        session.controller.setJointRotation(command);
        this.io.to(`session:${sessionId}`).emit('joint-broadcast', command);
        res.json({ success: true, joint: command.joint, sessionId });
      } catch (error) {
        res.status(400).json({ error: String(error) });
      }
    });

    this.app.get('/api/state', (req, res) => {
      const sessionId = (req.query.sessionId as string) || this.defaultSessionId;
      const session = this.getSession(sessionId);

      try {
        const state = session.controller.getState();
        const serializedState = {
          headPose: state.headPose,
          joints: Object.fromEntries(
            Object.entries(state.joints).map(([key, value]) => [
              key,
              { x: value.x ?? 0, y: value.y ?? 0, z: value.z ?? 0 },
            ])
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
      res.json({ moods: ['neutral', 'smile', 'frown', 'laugh', 'angry', 'sad', 'surprise', 'confusion', 'thinking'] });
    });

    this.app.get('/api/joints', (_req, res) => {
      const joints: JointName[] = ['headPivot', 'neck'];
      res.json({ joints });
    });
  }

  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Join session (default or specified)
      socket.on('join-session', (sessionId: string) => {
        const targetSessionId = sessionId || this.defaultSessionId;
        const session = this.getSession(targetSessionId);
        
        // Leave previous session if any
        const previousSessionId = this.socketToSession.get(socket.id);
        if (previousSessionId && previousSessionId !== targetSessionId) {
          this.leaveSession(socket, previousSessionId);
        }

        // Join new session
        socket.join(`session:${targetSessionId}`);
        session.sockets.add(socket.id);
        this.socketToSession.set(socket.id, targetSessionId);
        
        socket.emit('session-joined', { sessionId: targetSessionId });
        console.log(`Socket ${socket.id} joined session ${targetSessionId}`);
      });

      socket.on('facial-state', (payload: FacialStatePayload & { sessionId?: string }) => {
        const sessionId = payload.sessionId || this.socketToSession.get(socket.id) || this.defaultSessionId;
        const session = this.getSession(sessionId);
        this.applyFacialPayload(session, payload, true);
      });

      socket.on('joint', (command: JointCommand & { sessionId?: string }) => {
        const sessionId = command.sessionId || this.socketToSession.get(socket.id) || this.defaultSessionId;
        const session = this.getSession(sessionId);
        session.controller.setJointRotation(command);
        this.io.to(`session:${sessionId}`).emit('joint-broadcast', command);
      });

      socket.on('subscribe-state', (sessionId?: string) => {
        const targetSessionId = sessionId || this.socketToSession.get(socket.id) || this.defaultSessionId;
        const session = this.getSession(targetSessionId);

        // Clear existing interval for this socket
        const existingInterval = session.stateIntervals.get(socket.id);
        if (existingInterval) {
          clearInterval(existingInterval);
        }

        // Create new interval for this socket
        const interval = setInterval(() => {
          socket.emit('state-update', session.controller.getState());
        }, 100);

        session.stateIntervals.set(socket.id, interval);
      });

      socket.on('unsubscribe-state', () => {
        const sessionId = this.socketToSession.get(socket.id);
        if (sessionId) {
          const session = this.sessions.get(sessionId);
          if (session) {
            const interval = session.stateIntervals.get(socket.id);
            if (interval) {
              clearInterval(interval);
              session.stateIntervals.delete(socket.id);
            }
          }
        }
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        const sessionId = this.socketToSession.get(socket.id);
        if (sessionId) {
          this.leaveSession(socket, sessionId);
        }
      });

      // Auto-join default session for backward compatibility
      const defaultSession = this.getSession(this.defaultSessionId);
      socket.join(`session:${this.defaultSessionId}`);
      defaultSession.sockets.add(socket.id);
      this.socketToSession.set(socket.id, this.defaultSessionId);
      socket.emit('session-joined', { sessionId: this.defaultSessionId });
    });
  }

  private leaveSession(socket: Socket, sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    socket.leave(`session:${sessionId}`);
    session.sockets.delete(socket.id);
    this.socketToSession.delete(socket.id);

    // Clear interval for this socket
    const interval = session.stateIntervals.get(socket.id);
    if (interval) {
      clearInterval(interval);
      session.stateIntervals.delete(socket.id);
    }

    // Cleanup empty sessions (except default)
    if (session.sockets.size === 0 && sessionId !== this.defaultSessionId) {
      this.cleanupSession(sessionId);
    }
  }

  private applyFacialPayload(session: Session, payload: FacialStatePayload, broadcast: boolean = true): void {
    const sanitizedPayload: FacialStatePayload = { ...payload };

    if (payload.mood) {
      session.controller.setMood(payload.mood.value, payload.mood.duration);
    }

    if (payload.action) {
      session.controller.triggerAction(payload.action.type, payload.action.duration);
    }

    if (payload.clearAction) {
      session.controller.clearAction();
    }

    if (payload.headPose) {
      const { yaw, pitch, duration } = payload.headPose;
      session.controller.setHeadPose({ yaw, pitch }, duration);
    }

    if (payload.bubble) {
      const normalizedBubble = this.normalizeBubble(payload.bubble);
      session.controller.setSpeechBubble(normalizedBubble);
      sanitizedPayload.bubble = normalizedBubble;
    }

    if (broadcast) {
      this.io.to(`session:${session.id}`).emit('facial-state-broadcast', sanitizedPayload);
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

  public updateAllControllers(deltaTime: number): void {
    // Update all character controllers in all sessions
    this.sessions.forEach((session) => {
      session.controller.update(deltaTime);
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      // Cleanup all sessions
      this.sessions.forEach((_session, sessionId) => {
        this.cleanupSession(sessionId);
      });
      this.sessions.clear();
      this.socketToSession.clear();

      this.io.close();
      this.server.close(() => {
        console.log('API server stopped');
        resolve();
      });
    });
  }
}
