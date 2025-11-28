import * as THREE from 'three';
import type { FacialAction, FacialMood } from '../types';
import { RagdollGeometry } from '../models/ragdoll-geometry';

interface ExpressionConfig {
  mouthScale: THREE.Vector3;
  mouthPosition: THREE.Vector3;
  eyeScale: THREE.Vector3;
  eyebrowPosition: { left: THREE.Vector3; right: THREE.Vector3 };
  eyebrowRotation: { left: THREE.Euler; right: THREE.Euler };
}

interface ActionState {
  name: Exclude<FacialAction, 'none'>;
  elapsed: number;
  duration: number;
}

interface ActionOverlay {
  mouthScale: THREE.Vector3;
  mouthOffset: THREE.Vector3;
  leftEyeScale: THREE.Vector3;
  rightEyeScale: THREE.Vector3;
  leftBrowOffset: THREE.Vector3;
  rightBrowOffset: THREE.Vector3;
  leftBrowRotation: number;
  rightBrowRotation: number;
  leftEyelid: number;
  rightEyelid: number;
}

export class ExpressionController {
  private geometry: RagdollGeometry;
  private currentMood: FacialMood = 'neutral';
  private previousMood: FacialMood = 'neutral';
  private targetConfig: ExpressionConfig;
  private currentConfig: ExpressionConfig;
  private transitionProgress = 1;
  private transitionDuration = 0.3;
  private actionState: ActionState | null = null;

  private readonly moods: Record<FacialMood, ExpressionConfig> = {
    neutral: this.createConfig({
      mouthScale: new THREE.Vector3(1, 1, 1),
      mouthPosition: new THREE.Vector3(0, -0.06, 0.175),
      eyeScale: new THREE.Vector3(1, 1, 1),
      eyebrowPosition: {
        left: new THREE.Vector3(0.05, 0.1, 0.16),
        right: new THREE.Vector3(-0.05, 0.1, 0.16),
      },
      eyebrowRotation: {
        left: new THREE.Euler(0, 0, -0.05),
        right: new THREE.Euler(0, 0, 0.05),
      },
    }),
    smile: this.createConfig({
      mouthScale: new THREE.Vector3(1.3, 0.7, 1),
      mouthPosition: new THREE.Vector3(0, -0.055, 0.175),
      eyeScale: new THREE.Vector3(0.9, 1.1, 1),
      eyebrowPosition: {
        left: new THREE.Vector3(0.05, 0.11, 0.16),
        right: new THREE.Vector3(-0.05, 0.11, 0.16),
      },
      eyebrowRotation: {
        left: new THREE.Euler(0, 0, -0.2),
        right: new THREE.Euler(0, 0, 0.2),
      },
    }),
    frown: this.createConfig({
      mouthScale: new THREE.Vector3(0.9, 0.6, 1),
      mouthPosition: new THREE.Vector3(0, -0.07, 0.175),
      eyeScale: new THREE.Vector3(0.95, 0.9, 1),
      eyebrowPosition: {
        left: new THREE.Vector3(0.05, 0.095, 0.16),
        right: new THREE.Vector3(-0.05, 0.095, 0.16),
      },
      eyebrowRotation: {
        left: new THREE.Euler(0, 0, 0.25),
        right: new THREE.Euler(0, 0, -0.25),
      },
    }),
    laugh: this.createConfig({
      mouthScale: new THREE.Vector3(1.4, 1.2, 1),
      mouthPosition: new THREE.Vector3(0, -0.05, 0.175),
      eyeScale: new THREE.Vector3(0.85, 0.9, 1),
      eyebrowPosition: {
        left: new THREE.Vector3(0.05, 0.115, 0.16),
        right: new THREE.Vector3(-0.05, 0.115, 0.16),
      },
      eyebrowRotation: {
        left: new THREE.Euler(0, 0, -0.3),
        right: new THREE.Euler(0, 0, 0.3),
      },
    }),
    angry: this.createConfig({
      mouthScale: new THREE.Vector3(0.75, 0.95, 1),
      mouthPosition: new THREE.Vector3(0, -0.065, 0.175),
      eyeScale: new THREE.Vector3(1.0, 0.75, 1),
      eyebrowPosition: {
        left: new THREE.Vector3(0.05, 0.085, 0.16),
        right: new THREE.Vector3(-0.05, 0.085, 0.16),
      },
      eyebrowRotation: {
        left: new THREE.Euler(0, 0, 0.4),
        right: new THREE.Euler(0, 0, -0.4),
      },
    }),
    sad: this.createConfig({
      mouthScale: new THREE.Vector3(0.8, 0.55, 1),
      mouthPosition: new THREE.Vector3(0, -0.075, 0.175),
      eyeScale: new THREE.Vector3(1.05, 0.85, 1),
      eyebrowPosition: {
        left: new THREE.Vector3(0.05, 0.09, 0.16),
        right: new THREE.Vector3(-0.05, 0.09, 0.16),
      },
      eyebrowRotation: {
        left: new THREE.Euler(0, 0, 0.2),
        right: new THREE.Euler(0, 0, -0.2),
      },
    }),
  };

  constructor(geometry: RagdollGeometry) {
    this.geometry = geometry;
    this.currentConfig = this.createConfigFromMood('neutral');
    this.targetConfig = this.createConfigFromMood('neutral');
    this.applyConfiguration();
  }

  public setMood(mood: FacialMood, transitionDuration: number = 0.35): void {
    if (mood === this.currentMood) return;

    this.previousMood = this.currentMood;
    this.currentMood = mood;
    this.targetConfig = this.createConfigFromMood(mood);
    this.transitionDuration = Math.max(0.05, transitionDuration);
    this.transitionProgress = 0;
  }

  public triggerAction(action: Exclude<FacialAction, 'none'>, duration: number = 0.6): void {
    const resolvedDuration = action === 'talk' ? Number.POSITIVE_INFINITY : Math.max(0.2, duration);
    this.actionState = { name: action, elapsed: 0, duration: resolvedDuration };
  }

  public clearAction(): void {
    this.actionState = null;
  }

  public update(deltaTime: number): void {
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + deltaTime / this.transitionDuration);
      const t = this.easeInOutCubic(this.transitionProgress);
      this.interpolateConfig(t);
    }

    if (this.actionState) {
      this.actionState.elapsed += deltaTime;
      if (this.actionState.name !== 'talk' && this.actionState.elapsed >= this.actionState.duration) {
        this.actionState = null;
      }
    }

    this.applyConfiguration();
  }

  public getCurrentMood(): FacialMood {
    return this.currentMood;
  }

  public getActiveAction(): FacialAction | null {
    return this.actionState?.name ?? null;
  }

  public isTalking(): boolean {
    return this.actionState?.name === 'talk';
  }

  public getActionProgress(): number {
    if (!this.actionState) {
      return 0;
    }

    if (!Number.isFinite(this.actionState.duration)) {
      return 0.5;
    }

    return Math.min(1, this.actionState.elapsed / this.actionState.duration);
  }

  private createConfig(config: ExpressionConfig): ExpressionConfig {
    return {
      mouthScale: config.mouthScale,
      mouthPosition: config.mouthPosition,
      eyeScale: config.eyeScale,
      eyebrowPosition: {
        left: config.eyebrowPosition.left,
        right: config.eyebrowPosition.right,
      },
      eyebrowRotation: {
        left: config.eyebrowRotation.left,
        right: config.eyebrowRotation.right,
      },
    };
  }

  private createConfigFromMood(mood: FacialMood): ExpressionConfig {
    const base = this.moods[mood];
    return {
      mouthScale: base.mouthScale.clone(),
      mouthPosition: base.mouthPosition.clone(),
      eyeScale: base.eyeScale.clone(),
      eyebrowPosition: {
        left: base.eyebrowPosition.left.clone(),
        right: base.eyebrowPosition.right.clone(),
      },
      eyebrowRotation: {
        left: base.eyebrowRotation.left.clone(),
        right: base.eyebrowRotation.right.clone(),
      },
    };
  }

  private interpolateConfig(t: number): void {
    const prevConfig = this.moods[this.previousMood];

    this.currentConfig.mouthScale.lerpVectors(prevConfig.mouthScale, this.targetConfig.mouthScale, t);
    this.currentConfig.mouthPosition.lerpVectors(prevConfig.mouthPosition, this.targetConfig.mouthPosition, t);
    this.currentConfig.eyeScale.lerpVectors(prevConfig.eyeScale, this.targetConfig.eyeScale, t);
    this.currentConfig.eyebrowPosition.left.lerpVectors(
      prevConfig.eyebrowPosition.left,
      this.targetConfig.eyebrowPosition.left,
      t
    );
    this.currentConfig.eyebrowPosition.right.lerpVectors(
      prevConfig.eyebrowPosition.right,
      this.targetConfig.eyebrowPosition.right,
      t
    );

    this.currentConfig.eyebrowRotation.left.set(
      THREE.MathUtils.lerp(prevConfig.eyebrowRotation.left.x, this.targetConfig.eyebrowRotation.left.x, t),
      THREE.MathUtils.lerp(prevConfig.eyebrowRotation.left.y, this.targetConfig.eyebrowRotation.left.y, t),
      THREE.MathUtils.lerp(prevConfig.eyebrowRotation.left.z, this.targetConfig.eyebrowRotation.left.z, t)
    );
    this.currentConfig.eyebrowRotation.right.set(
      THREE.MathUtils.lerp(prevConfig.eyebrowRotation.right.x, this.targetConfig.eyebrowRotation.right.x, t),
      THREE.MathUtils.lerp(prevConfig.eyebrowRotation.right.y, this.targetConfig.eyebrowRotation.right.y, t),
      THREE.MathUtils.lerp(prevConfig.eyebrowRotation.right.z, this.targetConfig.eyebrowRotation.right.z, t)
    );
  }

  private applyConfiguration(): void {
    const {
      mouth,
      leftEye,
      rightEye,
      leftEyebrow,
      rightEyebrow,
      leftEyelid,
      rightEyelid,
    } = this.geometry.facialMeshes;

    const mouthScale = this.currentConfig.mouthScale.clone();
    const mouthPosition = this.currentConfig.mouthPosition.clone();
    const leftEyeScale = this.currentConfig.eyeScale.clone();
    const rightEyeScale = this.currentConfig.eyeScale.clone();
    const leftBrowPosition = this.currentConfig.eyebrowPosition.left.clone();
    const rightBrowPosition = this.currentConfig.eyebrowPosition.right.clone();
    const leftBrowRotation = this.currentConfig.eyebrowRotation.left.clone();
    const rightBrowRotation = this.currentConfig.eyebrowRotation.right.clone();

    const overlay = this.getActionOverlay();
    mouthScale.multiply(overlay.mouthScale);
    mouthPosition.add(overlay.mouthOffset);
    leftEyeScale.multiply(overlay.leftEyeScale);
    rightEyeScale.multiply(overlay.rightEyeScale);
    leftBrowPosition.add(overlay.leftBrowOffset);
    rightBrowPosition.add(overlay.rightBrowOffset);
    leftBrowRotation.z += overlay.leftBrowRotation;
    rightBrowRotation.z += overlay.rightBrowRotation;

    mouth.scale.copy(mouthScale);
    mouth.position.copy(mouthPosition);

    leftEye.scale.copy(leftEyeScale);
    rightEye.scale.copy(rightEyeScale);

    leftEyebrow.position.copy(leftBrowPosition);
    rightEyebrow.position.copy(rightBrowPosition);
    leftEyebrow.rotation.copy(leftBrowRotation);
    rightEyebrow.rotation.copy(rightBrowRotation);
    this.applyEyelid(leftEyelid, overlay.leftEyelid);
    this.applyEyelid(rightEyelid, overlay.rightEyelid);
  }

  private getActionOverlay(): ActionOverlay {
    const zeroVec = () => new THREE.Vector3(0, 0, 0);
    const oneVec = () => new THREE.Vector3(1, 1, 1);
    const base: ActionOverlay = {
      mouthScale: oneVec(),
      mouthOffset: zeroVec(),
      leftEyeScale: oneVec(),
      rightEyeScale: oneVec(),
      leftBrowOffset: zeroVec(),
      rightBrowOffset: zeroVec(),
      leftBrowRotation: 0,
      rightBrowRotation: 0,
      leftEyelid: 0,
      rightEyelid: 0,
    };

    if (!this.actionState) {
      return base;
    }

    if (this.actionState.name === 'wink') {
      const progress = Math.min(1, this.actionState.elapsed / this.actionState.duration);
      const winkCurve = Math.sin(progress * Math.PI);
      return {
        ...base,
        rightEyeScale: new THREE.Vector3(1, THREE.MathUtils.lerp(1, 0.05, winkCurve), 1),
        rightBrowOffset: new THREE.Vector3(0, -0.01 * winkCurve, 0),
        rightBrowRotation: THREE.MathUtils.lerp(0, -0.35, winkCurve),
        rightEyelid: winkCurve,
      };
    }

    if (this.actionState.name === 'talk') {
      const cycle = Math.sin(this.actionState.elapsed * 8);
      return {
        ...base,
        mouthScale: new THREE.Vector3(1 + Math.abs(cycle) * 0.15, 1 + Math.abs(cycle) * 0.4, 1),
        mouthOffset: new THREE.Vector3(0, Math.abs(cycle) * 0.004, 0),
      };
    }

    return base;
  }

  private applyEyelid(mesh: THREE.Mesh, progress: number): void {
    const basePosition = mesh.userData.basePosition as THREE.Vector3 | undefined;
    const baseScale = mesh.userData.baseScale as THREE.Vector3 | undefined;
    if (!basePosition || !baseScale) return;

    const clamped = THREE.MathUtils.clamp(progress, 0, 1);
    mesh.visible = clamped > 0.02;
    mesh.position.set(
      basePosition.x,
      THREE.MathUtils.lerp(basePosition.y, basePosition.y - 0.05, clamped),
      basePosition.z
    );
    mesh.scale.set(baseScale.x, THREE.MathUtils.lerp(0.02, baseScale.y, clamped), baseScale.z);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
