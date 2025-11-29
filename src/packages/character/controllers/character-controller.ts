import { RagdollSkeleton } from '../models/ragdoll-skeleton';
import { RagdollGeometry } from '../models/ragdoll-geometry';
import type { ExpressionConfig } from '../models/ragdoll-geometry';
import { ExpressionController } from './expression-controller';
import { HeadPoseController } from './head-pose-controller';
import { IdleController } from './idle-controller';
import type { IdleState } from './idle-controller';
import type { RagdollTheme } from '../themes/types';
import { getTheme, getDefaultTheme } from '../themes';
import type {
  CharacterState,
  FacialCommand,
  FacialMood,
  FacialAction,
  SpeechBubblePayload,
  SpeechBubbleState,
  JointCommand,
  JointName,
  HeadPose,
} from '../types';

export class CharacterController {
  private skeleton: RagdollSkeleton;
  private geometry: RagdollGeometry;
  private expressionController: ExpressionController;
  private headPoseController: HeadPoseController;
  private idleController: IdleController;
  private speechBubble: SpeechBubbleState = { text: null, tone: 'default' };
  private theme: RagdollTheme;

  constructor(themeId?: string) {
    this.skeleton = new RagdollSkeleton();
    this.geometry = new RagdollGeometry();
    this.theme = themeId ? getTheme(themeId) : getDefaultTheme();
    this.expressionController = new ExpressionController(this.geometry);
    this.headPoseController = new HeadPoseController(this.skeleton);
    this.idleController = new IdleController();
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

  public setHeadPose(pose: Partial<HeadPose>, duration?: number): void {
    this.headPoseController.setTargetPose(pose, duration);
  }

  public nudgeHead(delta: Partial<HeadPose>, duration?: number): void {
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
      const rotation = command.angle.y ?? command.angle.x ?? 0;
      this.skeleton.setJointRotation(command.joint, rotation);
    }
  }

  public getJointRotation(joint: JointName): number | null {
    return this.skeleton.getJointRotation(joint);
  }

  public update(deltaTime: number): void {
    this.expressionController.update(deltaTime);
    this.headPoseController.update(deltaTime);
    this.idleController.update(deltaTime);
    this.skeleton.update(deltaTime);
  }

  public getState(): CharacterState {
    const joints: Record<JointName, { x: number; y: number; z: number }> = {} as Record<
      JointName,
      { x: number; y: number; z: number }
    >;
    this.skeleton.skeleton.joints.forEach((_joint, name) => {
      const rotation = this.skeleton.getJointRotation(name);
      if (rotation !== null) {
        joints[name] = { x: 0, y: rotation, z: 0 };
      }
    });

    return {
      headPose: this.headPoseController.getPose(),
      joints: joints as Record<JointName, { x: number; y: number; z: number }>,
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

  public getHeadWorldPosition(): { x: number; y: number; z: number } {
    return { x: 0, y: -200, z: 0 };
  }

  public getExpression(): ExpressionConfig {
    return this.expressionController.getExpression();
  }

  public getExpressionWithAction(): ExpressionConfig {
    return this.expressionController.getExpressionWithAction();
  }

  public getGeometry(): RagdollGeometry {
    return this.geometry;
  }

  public getIdleState(): IdleState {
    return this.idleController.getState();
  }

  public getIdleController(): IdleController {
    return this.idleController;
  }

  public triggerBlink(): void {
    this.idleController.triggerBlink();
  }

  public setIdleEnabled(enabled: boolean): void {
    this.idleController.setEnabled(enabled);
  }

  public getTheme(): RagdollTheme {
    return this.theme;
  }

  public setTheme(themeId: string): void {
    this.theme = getTheme(themeId);
  }

  public getThemeId(): string {
    return this.theme.id;
  }
}
