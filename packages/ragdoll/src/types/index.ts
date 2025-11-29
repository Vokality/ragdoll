export type JointName = "headPivot" | "neck";

export type FacialMood =
  | "neutral"
  | "smile"
  | "frown"
  | "laugh"
  | "angry"
  | "sad"
  | "surprise"
  | "confusion"
  | "thinking";

export type FacialAction = "none" | "wink" | "talk";

export interface HeadPose {
  yaw: number;
  pitch: number;
}

// Vector3-like interface for compatibility
export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface Joint {
  name: JointName;
  minAngle: Vector3Like;
  maxAngle: Vector3Like;
  currentAngle: Vector3Like;
}

export interface Skeleton {
  joints: Map<JointName, Joint>;
  ikChains: IKChain[];
}

export interface IKChain {
  name: string;
  target: Vector3Like;
  poleTarget?: Vector3Like;
}

export interface FacialAnimationState {
  action: FacialAction | null;
  actionProgress: number;
  isTalking: boolean;
}

export interface SpeechBubbleState {
  text: string | null;
  tone: "default" | "shout" | "whisper";
}

export interface CharacterState {
  headPose: HeadPose;
  joints: Record<JointName, Vector3Like>;
  mood: FacialMood;
  action: FacialAction | null;
  bubble: SpeechBubbleState;
  animation: FacialAnimationState;
}

export type FacialCommand =
  | {
      action: "setMood";
      params: {
        mood: FacialMood;
        duration?: number;
      };
    }
  | {
      action: "triggerAction";
      params: {
        action: Exclude<FacialAction, "none">;
        duration?: number;
      };
    }
  | {
      action: "clearAction";
    }
  | {
      action: "setHeadPose";
      params: {
        yaw?: number;
        pitch?: number;
        duration?: number;
      };
    }
  | {
      action: "setSpeechBubble";
      params: SpeechBubbleState;
    };

export interface SpeechBubblePayload {
  text: string | null;
  tone?: "default" | "shout" | "whisper";
}

export interface FacialStatePayload {
  mood?: {
    value: FacialMood;
    duration?: number;
  };
  action?: {
    type: Exclude<FacialAction, "none">;
    duration?: number;
  };
  clearAction?: boolean;
  headPose?: {
    yaw?: number;
    pitch?: number;
    duration?: number;
  };
  bubble?: SpeechBubblePayload;
}

export interface JointCommand {
  joint: JointName;
  angle?: Vector3Like;
  rotation?: { x: number; y: number; z: number };
}

export type PomodoroState = "idle" | "running" | "paused" | "break";

export type PomodoroDuration = 5 | 15 | 30 | 60 | 120; // minutes

export interface PomodoroStateData {
  state: PomodoroState;
  sessionDuration: PomodoroDuration; // minutes
  breakDuration: PomodoroDuration; // minutes
  elapsedTime: number; // seconds
  remainingTime: number; // seconds
  isBreak: boolean;
}
