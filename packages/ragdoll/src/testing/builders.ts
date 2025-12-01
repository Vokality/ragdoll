/**
 * Test builders for creating test data
 */

import type {
  CharacterState,
  FacialMood,
  FacialAction,
  HeadPose,
  JointName,
  Vector3Like,
  SpeechBubbleState,
} from "../types";

/**
 * Builder for CharacterState
 */
export class CharacterStateBuilder {
  private state: CharacterState;

  constructor() {
    this.state = this.getDefaultState();
  }

  private getDefaultState(): CharacterState {
    const joints: Record<JointName, Vector3Like> = {
      headPivot: { x: 0, y: 0, z: 0 },
      neck: { x: 0, y: 0, z: 0 },
    };

    return {
      headPose: { yaw: 0, pitch: 0 },
      joints,
      mood: "neutral",
      action: null,
      bubble: { text: null, tone: "default" },
      animation: {
        action: null,
        actionProgress: 0,
        isTalking: false,
      },
    };
  }

  withMood(mood: FacialMood): this {
    this.state.mood = mood;
    return this;
  }

  withAction(action: FacialAction | null, progress = 0): this {
    this.state.action = action;
    this.state.animation.action = action;
    this.state.animation.actionProgress = progress;
    return this;
  }

  withHeadPose(pose: Partial<HeadPose>): this {
    this.state.headPose = { ...this.state.headPose, ...pose };
    return this;
  }

  withSpeechBubble(
    text: string | null,
    tone?: "default" | "whisper" | "shout",
  ): this {
    this.state.bubble = { text, tone: tone ?? "default" };
    return this;
  }

  withTalking(isTalking: boolean): this {
    this.state.animation.isTalking = isTalking;
    return this;
  }

  build(): CharacterState {
    return JSON.parse(JSON.stringify(this.state));
  }
}

/**
 * Builder for SpeechBubbleState
 */
export class SpeechBubbleBuilder {
  private bubble: SpeechBubbleState = { text: null, tone: "default" };

  withText(text: string): this {
    this.bubble.text = text;
    return this;
  }

  withTone(tone: "default" | "whisper" | "shout"): this {
    this.bubble.tone = tone;
    return this;
  }

  build(): SpeechBubbleState {
    return { ...this.bubble };
  }
}

/**
 * Builder for HeadPose
 */
export class HeadPoseBuilder {
  private pose: HeadPose = { yaw: 0, pitch: 0 };

  withYaw(yaw: number): this {
    this.pose.yaw = yaw;
    return this;
  }

  withPitch(pitch: number): this {
    this.pose.pitch = pitch;
    return this;
  }

  lookingLeft(degrees: number): this {
    this.pose.yaw = (degrees * Math.PI) / 180;
    return this;
  }

  lookingRight(degrees: number): this {
    this.pose.yaw = -(degrees * Math.PI) / 180;
    return this;
  }

  lookingUp(degrees: number): this {
    this.pose.pitch = (degrees * Math.PI) / 180;
    return this;
  }

  lookingDown(degrees: number): this {
    this.pose.pitch = -(degrees * Math.PI) / 180;
    return this;
  }

  build(): HeadPose {
    return { ...this.pose };
  }
}
