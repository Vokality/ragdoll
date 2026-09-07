import { z } from "zod";
import {
  memoryTierSchema,
  profileEditSchema,
  WORKING_MEMORY_LIMIT,
  type MemoryFact,
  type UserProfile,
} from "../electron-api.js";
import type { StorageRepository } from "../infrastructure/storage-repository.js";

export const memoryMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("set_name"),
      text: z.string().trim().min(1).max(80),
    })
    .strict(),
  z.object({ action: z.literal("skip_name") }).strict(),
  z.object({ action: z.literal("forget_name") }).strict(),
  z
    .object({
      action: z.literal("remember"),
      text: z.string().trim().min(1).max(240),
      tier: memoryTierSchema,
    })
    .strict(),
  z.object({ action: z.literal("forget_note"), id: z.uuid() }).strict(),
  z
    .object({ action: z.literal("move"), id: z.uuid(), tier: memoryTierSchema })
    .strict(),
  z
    .object({ action: z.literal("use"), ids: z.array(z.uuid()).min(1).max(50) })
    .strict(),
]);
export const memorySearchSchema = z
  .object({
    query: z.string().trim().max(240),
    offset: z.number().int().nonnegative().default(0),
  })
  .strict();

/** Includes content and membership, but not access timestamps. */
export function longTermSignature(profile: UserProfile): string {
  return JSON.stringify(
    profile.notes
      .filter((fact) => fact.tier === "long_term")
      .map(({ id, text }) => ({ id, text })),
  );
}
function archiveOverflow(profile: UserProfile): void {
  const working = profile.notes
    .filter((fact) => fact.tier === "working")
    .sort((a, b) => a.lastUsedAt - b.lastUsedAt || a.createdAt - b.createdAt);
  for (const fact of working.slice(
    0,
    Math.max(0, working.length - WORKING_MEMORY_LIMIT),
  ))
    fact.tier = "long_term";
}
function finishChange(profile: UserProfile, before: string): void {
  archiveOverflow(profile);
  if (before !== longTermSignature(profile)) profile.longTermSummary = null;
  profile.revision += 1;
}

export class UserProfileService {
  constructor(
    private readonly storage: StorageRepository,
    private readonly changed: () => void,
    private readonly now: () => number = Date.now,
  ) {}

  async get(): Promise<UserProfile> {
    return (await this.storage.read()).profile;
  }

  /** Bounded model context; long-term facts are available only through retrieval. */
  async context() {
    const profile = await this.get();
    return {
      name: profile.name,
      nameDeclined: profile.nameDeclined,
      checkInsEnabled: profile.checkInsEnabled,
      workingMemory: profile.notes
        .filter((fact) => fact.tier === "working")
        .map(({ id, text }) => ({ id, text })),
      longTermMemory: {
        count: profile.notes.filter((fact) => fact.tier === "long_term").length,
        summary: profile.longTermSummary,
      },
    };
  }

  async search(input: unknown) {
    const { query, offset } = memorySearchSchema.parse(input);
    const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const matches = (await this.get()).notes.filter(
      (fact) =>
        fact.tier === "long_term" &&
        words.every((word) => fact.text.toLocaleLowerCase().includes(word)),
    );
    return {
      facts: matches.slice(offset, offset + 10),
      total: matches.length,
      nextOffset: offset + 10 < matches.length ? offset + 10 : null,
    };
  }

  async saveSummary(signature: string, summary: string): Promise<boolean> {
    const text = z.string().trim().min(1).max(2000).parse(summary);
    let saved = false;
    await this.storage.update((draft) => {
      if (longTermSignature(draft.profile) !== signature) return;
      draft.profile.longTermSummary = text;
      saved = true;
    });
    if (saved) this.changed();
    return saved;
  }

  async edit(input: unknown): Promise<void> {
    const edit = profileEditSchema.parse(input);
    await this.storage.update((draft) => {
      const profile = draft.profile;
      if (profile.revision !== edit.revision)
        throw new Error(
          "Lumen's memory changed. Reload it before saving your edits.",
        );
      if (new Set(edit.notes.map((note) => note.id)).size !== edit.notes.length)
        throw new Error("Memory fact IDs must be unique");
      const before = longTermSignature(profile);
      const now = this.now();
      profile.notes = edit.notes.map((note): MemoryFact => {
        const previous = profile.notes.find((fact) => fact.id === note.id);
        if (!previous) throw new Error("Unknown memory fact");
        return {
          ...previous,
          ...note,
          lastUsedAt:
            previous.text === note.text && previous.tier === note.tier
              ? previous.lastUsedAt
              : now,
        };
      });
      profile.name = edit.name;
      profile.nameDeclined = edit.name === null;
      profile.checkInsEnabled = edit.checkInsEnabled;
      finishChange(profile, before);
    });
    this.changed();
  }

  async mutate(input: unknown): Promise<void> {
    const mutation = memoryMutationSchema.parse(input);
    await this.storage.update((draft) => {
      const profile = draft.profile;
      const before = longTermSignature(profile);
      const now = this.now();
      switch (mutation.action) {
        case "set_name":
          profile.name = mutation.text;
          profile.nameDeclined = false;
          break;
        case "skip_name":
        case "forget_name":
          profile.name = null;
          profile.nameDeclined = true;
          break;
        case "remember": {
          const existing = profile.notes.find(
            (note) =>
              note.text.toLocaleLowerCase() ===
              mutation.text.toLocaleLowerCase(),
          );
          if (existing) {
            existing.lastUsedAt = now;
            existing.tier = mutation.tier;
          } else {
            profile.notes.push({
              id: crypto.randomUUID(),
              text: mutation.text,
              tier: mutation.tier,
              createdAt: now,
              lastUsedAt: now,
            });
          }
          break;
        }
        case "forget_note":
          profile.notes = profile.notes.filter(
            (note) => note.id !== mutation.id,
          );
          break;
        case "move": {
          const fact = profile.notes.find((note) => note.id === mutation.id);
          if (!fact) throw new Error("Unknown memory fact");
          fact.tier = mutation.tier;
          fact.lastUsedAt = now;
          break;
        }
        case "use":
          if (
            mutation.ids.some(
              (id) => !profile.notes.some((note) => note.id === id),
            )
          )
            throw new Error("Unknown memory fact");
          for (const fact of profile.notes)
            if (mutation.ids.includes(fact.id)) fact.lastUsedAt = now;
          break;
      }
      finishChange(profile, before);
    });
    this.changed();
  }

  async recordSuccess(toolName: string): Promise<void> {
    await this.storage.update((draft) => {
      draft.experience.firstSuccess ??= { toolName, occurredAt: Date.now() };
    });
    this.changed();
  }
}
