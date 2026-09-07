import { describe, expect, it } from "bun:test";
import { DEFAULT_CHARACTER_SETTINGS } from "../electron-api.js";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createStorageRepository,
  storageSchema,
} from "./storage-repository.js";

describe("storageSchema", () => {
  it("normalizes persisted data into the complete application state", () => {
    expect(storageSchema.parse({})).toEqual({
      settings: {
        ...DEFAULT_CHARACTER_SETTINGS,
        disabledExtensions: [],
      },
      profile: {
        name: null,
        nameDeclined: false,
        notes: [],
        longTermSummary: null,
        checkInsEnabled: true,
        revision: 0,
      },
      experience: {
        introduced: false,
        firstSuccess: null,
        lastFocusCheckInAt: 0,
      },
      conversation: [],
      pendingAgentTurns: [],
      connections: [],
      connectionCredentials: {},
      extensionHost: {},
    });
  });
});

it("serializes direct writes and updates and reads their committed result", async () => {
  const root = await mkdtemp(join(tmpdir(), "lumen-storage-test-"));
  try {
    const repository = createStorageRepository(root);
    const initial = storageSchema.parse({});
    const write = repository.write(initial);
    initial.settings.theme = "robot";
    const updates = Array.from({ length: 20 }, (_, index) =>
      repository.update((draft) => {
        draft.conversation.push({ role: "user", content: String(index) });
      }),
    );
    const snapshot = await repository.read();
    await Promise.all([write, ...updates]);
    expect(snapshot.settings.theme).toBe("default");
    expect(snapshot.conversation).toHaveLength(20);
    expect(await readdir(root)).toEqual(["chat-storage.json"]);
    if (process.platform !== "win32")
      expect((await stat(repository.filePath)).mode & 0o777).toBe(0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("a failed mutation preserves storage and does not poison later writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "lumen-storage-test-"));
  try {
    const repository = createStorageRepository(root);
    await repository.write(storageSchema.parse({}));
    await expect(
      repository.update((draft) => {
        draft.settings.theme = "robot";
        throw new Error("failed mutation");
      }),
    ).rejects.toThrow("failed mutation");
    expect((await repository.read()).settings.theme).toBe("default");
    await repository.update((draft) => {
      draft.settings.variant = "einstein";
    });
    expect((await repository.read()).settings.variant).toBe("einstein");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("migrates original notes into working memory and persists both tiers across restarts", async () => {
  const root = await mkdtemp(join(tmpdir(), "lumen-memory-migration-"));
  try {
    const id = crypto.randomUUID();
    const migrated = storageSchema.parse({
      profile: { notes: [{ id, text: "Prefers mornings" }] },
    });
    expect(migrated.profile.notes[0]).toEqual({
      id,
      text: "Prefers mornings",
      tier: "working",
      createdAt: 0,
      lastUsedAt: 0,
    });
    migrated.profile.notes.push({
      id: crypto.randomUUID(),
      text: "Birthday May 3",
      tier: "long_term",
      createdAt: 42,
      lastUsedAt: 43,
    });
    migrated.profile.longTermSummary = "A birthday is saved.";
    await createStorageRepository(root).write(migrated);
    expect((await createStorageRepository(root).read()).profile).toEqual(
      migrated.profile,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
