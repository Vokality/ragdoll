import * as THREE from 'three';

export type JointName = 'headPivot' | 'neck';

export type FacialMood = 'neutral' | 'smile' | 'frown' | 'laugh' | 'angry' | 'sad';

export type FacialAction = 'none' | 'wink' | 'talk';

export interface HeadPose {
  yaw: number;
  pitch: number;
}

export interface Joint {
  name: JointName;
  bone: THREE.Bone;
  minAngle: THREE.Vector3;
  maxAngle: THREE.Vector3;
  currentAngle: THREE.Vector3;
}

export interface Skeleton {
  root: THREE.Bone;
  joints: Map<JointName, Joint>;
  ikChains: IKChain[];
}

export interface IKChain {
  name: string;
  bones: THREE.Bone[];
  target: THREE.Vector3;
  poleTarget?: THREE.Vector3;
}

export interface FacialAnimationState {
  action: FacialAction | null;
  actionProgress: number;
  isTalking: boolean;
}

export interface SpeechBubbleState {
  text: string | null;
  tone: 'default' | 'shout' | 'whisper';
}

export interface CharacterState {
  headPose: HeadPose;
  joints: Record<JointName, THREE.Vector3>;
  mood: FacialMood;
  action: FacialAction | null;
  bubble: SpeechBubbleState;
  animation: FacialAnimationState;
}

export type FacialCommand =
  | {
      action: 'setMood';
      params: {
        mood: FacialMood;
        duration?: number;
      };
    }
  | {
      action: 'triggerAction';
      params: {
        action: Exclude<FacialAction, 'none'>;
        duration?: number;
      };
    }
  | {
      action: 'clearAction';
    }
  | {
      action: 'setHeadPose';
      params: {
        yaw?: number;
        pitch?: number;
        duration?: number;
      };
    }
  | {
      action: 'setSpeechBubble';
      params: SpeechBubbleState;
    };

export interface SpeechBubblePayload {
  text: string | null;
  tone?: 'default' | 'shout' | 'whisper';
}

export interface FacialStatePayload {
  mood?: {
    value: FacialMood;
    duration?: number;
  };
  action?: {
    type: Exclude<FacialAction, 'none'>;
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
  angle?: THREE.Vector3;
  rotation?: THREE.Euler;
}
