/**
 * Idle animation controller for natural micro-movements
 * Handles breathing, blinking, eye saccades, and subtle head movements
 */

export interface IdleState {
  // Blink state
  blinkAmount: number; // 0 = open, 1 = closed
  isBlinking: boolean;

  // Breathing
  breathPhase: number; // 0-1 cycle
  breathAmount: number; // Current breath expansion

  // Eye micro-movements (saccades)
  pupilOffsetX: number;
  pupilOffsetY: number;

  // Subtle head movement
  headMicroX: number;
  headMicroY: number;
}

interface BlinkState {
  nextBlinkTime: number;
  blinkPhase: "idle" | "closing" | "closed" | "opening";
  blinkProgress: number;
}

interface SaccadeState {
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  nextSaccadeTime: number;
}

export class IdleController {
  private elapsed = 0;

  // Blink configuration
  private readonly blinkDuration = 0.15; // Total blink duration
  private readonly minBlinkInterval = 2.0;
  private readonly maxBlinkInterval = 5.0;
  private blinkState: BlinkState = {
    nextBlinkTime: this.randomBlinkInterval(),
    blinkPhase: "idle",
    blinkProgress: 0,
  };

  // Breathing configuration
  private readonly breathCycleDuration = 3.5; // Seconds per breath cycle
  private breathPhase = Math.random(); // Start at random phase

  // Saccade configuration
  private readonly saccadeMaxOffset = 3;
  private readonly minSaccadeInterval = 0.3;
  private readonly maxSaccadeInterval = 1.5;
  private saccadeState: SaccadeState = {
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    nextSaccadeTime: this.randomSaccadeInterval(),
  };

  // Head micro-movement
  private headNoisePhase = Math.random() * 100;

  // Current state
  private currentState: IdleState = {
    blinkAmount: 0,
    isBlinking: false,
    breathPhase: 0,
    breathAmount: 0,
    pupilOffsetX: 0,
    pupilOffsetY: 0,
    headMicroX: 0,
    headMicroY: 0,
  };

  // Whether idle animations are enabled
  private enabled = true;

  public update(deltaTime: number): void {
    if (!this.enabled) return;

    this.elapsed += deltaTime;

    this.updateBlink(deltaTime);
    this.updateBreathing();
    this.updateSaccades(deltaTime);
    this.updateHeadMicro();
  }

  private updateBlink(deltaTime: number): void {
    const bs = this.blinkState;

    switch (bs.blinkPhase) {
      case "idle":
        if (this.elapsed >= bs.nextBlinkTime) {
          bs.blinkPhase = "closing";
          bs.blinkProgress = 0;
          this.currentState.isBlinking = true;
        }
        break;

      case "closing":
        bs.blinkProgress += deltaTime / (this.blinkDuration * 0.4);
        if (bs.blinkProgress >= 1) {
          bs.blinkPhase = "closed";
          bs.blinkProgress = 0;
        }
        break;

      case "closed":
        bs.blinkProgress += deltaTime / (this.blinkDuration * 0.1);
        if (bs.blinkProgress >= 1) {
          bs.blinkPhase = "opening";
          bs.blinkProgress = 0;
        }
        break;

      case "opening":
        bs.blinkProgress += deltaTime / (this.blinkDuration * 0.5);
        if (bs.blinkProgress >= 1) {
          bs.blinkPhase = "idle";
          bs.blinkProgress = 0;
          bs.nextBlinkTime = this.elapsed + this.randomBlinkInterval();
          this.currentState.isBlinking = false;
        }
        break;
    }

    // Calculate blink amount with smooth curves
    switch (bs.blinkPhase) {
      case "closing":
        // Fast close with ease-in
        this.currentState.blinkAmount = this.easeInQuad(bs.blinkProgress);
        break;
      case "closed":
        this.currentState.blinkAmount = 1;
        break;
      case "opening":
        // Slower open with ease-out
        this.currentState.blinkAmount = 1 - this.easeOutQuad(bs.blinkProgress);
        break;
      default:
        this.currentState.blinkAmount = 0;
    }
  }

  private updateBreathing(): void {
    // Smooth sinusoidal breathing
    this.breathPhase = (this.elapsed / this.breathCycleDuration) % 1;

    // Use a modified sine wave for more natural breathing rhythm
    // Inhale is slightly faster than exhale
    const t = this.breathPhase;
    const breathCurve =
      t < 0.4
        ? Math.sin(((t / 0.4) * Math.PI) / 2) // Inhale
        : Math.cos((((t - 0.4) / 0.6) * Math.PI) / 2); // Exhale

    this.currentState.breathPhase = this.breathPhase;
    this.currentState.breathAmount = breathCurve * 0.02; // Subtle effect
  }

  private updateSaccades(deltaTime: number): void {
    const ss = this.saccadeState;

    // Check if it's time for a new saccade
    if (this.elapsed >= ss.nextSaccadeTime) {
      // Set new random target
      ss.targetX = (Math.random() - 0.5) * 2 * this.saccadeMaxOffset;
      ss.targetY = (Math.random() - 0.5) * 2 * this.saccadeMaxOffset;
      ss.nextSaccadeTime = this.elapsed + this.randomSaccadeInterval();
    }

    // Quick movement to target, then hold
    const moveSpeed = 30; // Saccades are fast
    const dx = ss.targetX - ss.currentX;
    const dy = ss.targetY - ss.currentY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.1) {
      const move = Math.min(dist, moveSpeed * deltaTime);
      ss.currentX += (dx / dist) * move;
      ss.currentY += (dy / dist) * move;
    } else {
      ss.currentX = ss.targetX;
      ss.currentY = ss.targetY;
    }

    this.currentState.pupilOffsetX = ss.currentX;
    this.currentState.pupilOffsetY = ss.currentY;
  }

  private updateHeadMicro(): void {
    // Use perlin-like noise for organic head movement
    const t = this.elapsed * 0.3 + this.headNoisePhase;

    // Combine multiple frequencies for organic movement
    const x =
      Math.sin(t * 0.7) * 0.3 +
      Math.sin(t * 1.3) * 0.15 +
      Math.sin(t * 2.1) * 0.05;
    const y = Math.sin(t * 0.5 + 1) * 0.2 + Math.sin(t * 1.1 + 2) * 0.1;

    this.currentState.headMicroX = x;
    this.currentState.headMicroY = y;
  }

  private randomBlinkInterval(): number {
    return (
      this.minBlinkInterval +
      Math.random() * (this.maxBlinkInterval - this.minBlinkInterval)
    );
  }

  private randomSaccadeInterval(): number {
    return (
      this.minSaccadeInterval +
      Math.random() * (this.maxSaccadeInterval - this.minSaccadeInterval)
    );
  }

  private easeInQuad(t: number): number {
    return t * t;
  }

  private easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  public getState(): IdleState {
    return { ...this.currentState };
  }

  public triggerBlink(): void {
    if (this.blinkState.blinkPhase === "idle") {
      this.blinkState.blinkPhase = "closing";
      this.blinkState.blinkProgress = 0;
      this.currentState.isBlinking = true;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public reset(): void {
    this.elapsed = 0;
    this.blinkState = {
      nextBlinkTime: this.randomBlinkInterval(),
      blinkPhase: "idle",
      blinkProgress: 0,
    };
    this.breathPhase = Math.random();
    this.saccadeState = {
      targetX: 0,
      targetY: 0,
      currentX: 0,
      currentY: 0,
      nextSaccadeTime: this.randomSaccadeInterval(),
    };
  }
}
