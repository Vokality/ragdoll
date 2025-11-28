import * as THREE from 'three';
import { RagdollSkeleton } from '../models/ragdoll-skeleton';
import { RagdollGeometry } from '../models/ragdoll-geometry';
import { ExpressionController } from './expression-controller';
import { HeadPoseController } from './head-pose-controller';
import type {
  CharacterState,
  FacialCommand,
  FacialMood,
  FacialAction,
  SpeechBubblePayload,
  SpeechBubbleState,
  JointCommand,
  JointName,
} from '../types';

export class CharacterController {
  private skeleton: RagdollSkeleton;
  private geometry: RagdollGeometry;
  private expressionController: ExpressionController;
  private headPoseController: HeadPoseController;
  private speechBubble: SpeechBubbleState = { text: null, tone: 'default' };

  constructor() {
    this.skeleton = new RagdollSkeleton();
    this.geometry = new RagdollGeometry(this.skeleton);
    this.expressionController = new ExpressionController(this.geometry);
    this.headPoseController = new HeadPoseController(this.skeleton);
  }

  public executeCommand(command: FacialCommand): void {
    switch (command.action) {
      case 'setMood':
        this.setMood(command.params.mood, command.params.duration);
        break;
      case 'triggerAction':
        this.triggerAction(command.params.action, command.params.duration);
        break;
      case 'clearAction':
        this.clearAction();
        break;
      case 'setHeadPose':
        this.setHeadPose(command.params, command.params.duration);
        break;
      case 'setSpeechBubble':
        this.setSpeechBubble(command.params);
        break;
    }
  }

  public setMood(mood: FacialMood, duration?: number): void {
    this.expressionController.setMood(mood, duration);
  }

  public triggerAction(action: Exclude<FacialAction, 'none'>, duration?: number): void {
    this.expressionController.triggerAction(action, duration);
  }

  public clearAction(): void {
    this.expressionController.clearAction();
  }

  public setHeadPose(pose: Partial<{ yaw: number; pitch: number }>, duration?: number): void {
    this.headPoseController.setTargetPose(pose, duration);
  }

  public nudgeHead(delta: Partial<{ yaw: number; pitch: number }>, duration?: number): void {
    this.headPoseController.nudge(delta, duration);
  }

  public setSpeechBubble(payload: SpeechBubblePayload): void {
    this.speechBubble = {
      text: payload.text,
      tone: payload.tone ?? 'default',
    };

    if (payload.text && !this.expressionController.isTalking()) {
      this.expressionController.triggerAction('talk');
    }

    if (!payload.text && this.expressionController.isTalking()) {
      this.expressionController.clearAction();
    }
  }

  public setJointRotation(command: JointCommand): void {
    if (command.angle) {
      this.skeleton.setJointRotation(command.joint, command.angle);
    }
  }

  public getJointRotation(joint: JointName): THREE.Vector3 | null {
    return this.skeleton.getJointRotation(joint);
  }

  public getGroup(): THREE.Group {
    return this.geometry.getGroup();
  }

  public update(deltaTime: number): void {
    this.expressionController.update(deltaTime);
    this.headPoseController.update(deltaTime);
    this.skeleton.update(deltaTime);
  }

  public getState(): CharacterState {
    const joints: Record<JointName, THREE.Vector3> = {} as Record<JointName, THREE.Vector3>;
    this.skeleton.skeleton.joints.forEach((_joint, name) => {
      const rotation = this.skeleton.getJointRotation(name);
      if (rotation) {
        joints[name] = rotation.clone();
      }
    });

    return {
      headPose: this.headPoseController.getPose(),
      joints,
      mood: this.expressionController.getCurrentMood(),
      action: this.expressionController.getActiveAction(),
      bubble: this.getSpeechBubble(),
      animation: {
        action: this.expressionController.getActiveAction(),
        actionProgress: this.expressionController.getActionProgress(),
        isTalking: this.expressionController.isTalking(),
      },
    };
  }

  public getSpeechBubble(): SpeechBubbleState {
    return { ...this.speechBubble };
  }

  public getHeadWorldPosition(): THREE.Vector3 {
    const position = new THREE.Vector3();
    this.geometry.facialMeshes.head.getWorldPosition(position);
    return position;
  }
}
