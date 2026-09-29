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

export type FacialAction = "none" | "wink" | "talk" | "shake";

export type FaceAxis = "smile" | "frown" | "brows" | "eyesOpen" | "jaw";
export type GazeAxis = "gazeX" | "gazeY";
export type ExpressionAxis = FaceAxis | GazeAxis;

export interface ExpressionAxes {
  smile: number;
  frown: number;
  brows: number;
  eyesOpen: number;
  jaw: number;
  gazeX: number;
  gazeY: number;
}

export type ExpressionPatch = { [K in ExpressionAxis]?: number };

export interface HeadPose {
  yaw: number;
  pitch: number;
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface FacialAnimationState {
  action: FacialAction | null;
  actionProgress: number;
  isTalking: boolean;
}

export interface CharacterState {
  headPose: HeadPose;
  joints: Record<JointName, Vector3Like>;
  mood: FacialMood;
  action: FacialAction | null;
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
      action: "setExpression";
      params: ExpressionPatch & { duration?: number };
    }
  | {
      action: "resetExpression";
      params: { axes?: readonly ExpressionAxis[]; duration?: number };
    };
