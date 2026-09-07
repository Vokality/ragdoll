import type { CharacterReaction, ExperienceSnapshot } from "../electron-api.js";
import type { AppConversationEvent } from "../domain/conversation.js";
import type { StorageRepository } from "../infrastructure/storage-repository.js";

const MIN_ABSENCE_MS = 15 * 60_000;
const CHECK_IN_INTERVAL_MS = 4 * 60 * 60_000;

/** Host facts and admission policy; the agent authors every greeting/check-in. */
export class ExperienceService {
  private active = false;
  private busy = false;
  private error: string | null = null;
  private blurredAt: number | null = null;
  private focusQueue = Promise.resolve();

  constructor(
    private readonly storage: StorageRepository,
    private readonly schedule: () => Promise<void>,
    private readonly changed: () => void,
    private readonly reaction: (reaction: CharacterReaction) => void,
    private readonly now: () => number = Date.now,
  ) {}

  async snapshot(): Promise<ExperienceSnapshot> {
    const data = await this.storage.read();
    return {
      profile: data.profile,
      needsFirstAction: data.experience.firstSuccess === null,
      busy: this.busy,
      error: this.error,
    };
  }

  async begin(): Promise<void> {
    this.active = true;
    await this.storage.update((draft) => {
      if (
        draft.experience.introduced ||
        draft.conversation.some(
          (entry) =>
            "kind" in entry &&
            entry.kind === "app-event" &&
            entry.type === "app.onboarding",
        )
      )
        return;
      const event: AppConversationEvent = {
        kind: "app-event",
        id: crypto.randomUUID(),
        type: "app.onboarding",
        payload: {},
        turnPolicy: "start-turn",
        occurredAt: this.now(),
      };
      draft.conversation.push(event);
      draft.pendingAgentTurns.push({
        triggerEventId: event.id,
        createdAt: event.occurredAt,
      });
    });
    await this.schedule();
    this.changed();
  }

  blur(): void {
    if (this.active && this.blurredAt === null) this.blurredAt = this.now();
  }

  focus(): Promise<void> {
    const absentSince = this.blurredAt;
    this.blurredAt = null;
    const run = this.focusQueue.then(async () => {
      if (
        !this.active ||
        this.busy ||
        absentSince === null ||
        this.now() - absentSince < MIN_ABSENCE_MS
      )
        return;
      const now = this.now();
      let queued = false;
      await this.storage.update((draft) => {
        if (
          !draft.profile.checkInsEnabled ||
          !draft.experience.introduced ||
          draft.experience.firstSuccess === null ||
          draft.pendingAgentTurns.length ||
          now - draft.experience.lastFocusCheckInAt < CHECK_IN_INTERVAL_MS
        )
          return;
        const event: AppConversationEvent = {
          kind: "app-event",
          id: crypto.randomUUID(),
          type: "app.focused",
          payload: {
            absentForMinutes: Math.floor((now - absentSince) / 60_000),
            localHour: new Date(now).getHours(),
          },
          turnPolicy: "start-turn",
          occurredAt: now,
        };
        draft.conversation.push(event);
        draft.pendingAgentTurns.push({
          triggerEventId: event.id,
          createdAt: now,
        });
        draft.experience.lastFocusCheckInAt = now;
        queued = true;
      });
      if (queued) {
        this.reaction("welcome");
        await this.schedule();
      }
    });
    this.focusQueue = run.catch(() => {});
    return run;
  }

  async shouldEvaluate(event: AppConversationEvent): Promise<boolean> {
    if (event.type === "app.onboarding") return true;
    const data = await this.storage.read();
    return (
      data.profile.checkInsEnabled &&
      this.now() - event.occurredAt < MIN_ABSENCE_MS
    );
  }

  started(): void {
    this.busy = true;
    this.error = null;
    this.reaction("working");
    this.changed();
  }
  finished(
    success: boolean,
    error: string | null = null,
    reaction: CharacterReaction = "completed",
  ): void {
    this.busy = false;
    this.error = error;
    this.reaction(success ? reaction : "failed");
    this.changed();
  }
}
