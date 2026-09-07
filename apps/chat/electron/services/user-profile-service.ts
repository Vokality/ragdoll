import { z } from "zod";
import {
  profileEditSchema,
  type ProfileEdit,
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
    })
    .strict(),
  z.object({ action: z.literal("forget_note"), id: z.uuid() }).strict(),
]);

export class UserProfileService {
  constructor(
    private readonly storage: StorageRepository,
    private readonly changed: () => void,
  ) {}

  async get(): Promise<UserProfile> {
    return (await this.storage.read()).profile;
  }

  async edit(input: ProfileEdit): Promise<void> {
    const edit = profileEditSchema.parse(input);
    await this.storage.update((draft) => {
      if (draft.profile.revision !== edit.revision)
        throw new Error(
          "Lumen's memory changed. Reload it before saving your edits.",
        );
      if (new Set(edit.notes.map((note) => note.id)).size !== edit.notes.length)
        throw new Error("Memory note IDs must be unique");
      draft.profile = {
        ...edit,
        nameDeclined: edit.name === null,
        revision: edit.revision + 1,
      };
    });
    this.changed();
  }

  async mutate(input: unknown): Promise<UserProfile> {
    const mutation = memoryMutationSchema.parse(input);
    const data = await this.storage.update((draft) => {
      const profile = draft.profile;
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
        case "remember":
          if (
            profile.notes.some(
              (note) =>
                note.text.toLocaleLowerCase() ===
                mutation.text.toLocaleLowerCase(),
            )
          )
            return;
          if (profile.notes.length >= 8)
            throw new Error(
              "Memory is full. Forget an outdated note before adding another.",
            );
          profile.notes.push({ id: crypto.randomUUID(), text: mutation.text });
          break;
        case "forget_note":
          profile.notes = profile.notes.filter(
            (note) => note.id !== mutation.id,
          );
          break;
      }
      profile.revision += 1;
    });
    this.changed();
    return data.profile;
  }

  async recordSuccess(toolName: string): Promise<void> {
    await this.storage.update((draft) => {
      draft.experience.firstSuccess ??= { toolName, occurredAt: Date.now() };
    });
    this.changed();
  }
}
