import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { writePrivateFile } from "./write-private-file.js";
import { z } from "zod";
import {
  CHARACTER_THEME_IDS,
  CHARACTER_VARIANT_IDS,
  DEFAULT_CHARACTER_SETTINGS,
} from "../electron-api.js";
import {
  conversationEntrySchema,
  pendingAgentTurnSchema,
} from "../domain/conversation.js";

const configValuesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
);

const extensionHostDataSchema = z
  .object({
    configValues: configValuesSchema.optional(),
    configSecretsEncrypted: z.string().optional(),
    oauthTokensEncrypted: z.string().optional(),
  })
  .strict();

export const storageSchema = z
  .object({
    apiKeyEncrypted: z.string().optional(),
    settings: z
      .object({
        theme: z
          .enum(CHARACTER_THEME_IDS)
          .default(DEFAULT_CHARACTER_SETTINGS.theme),
        variant: z
          .enum(CHARACTER_VARIANT_IDS)
          .default(DEFAULT_CHARACTER_SETTINGS.variant),
        disabledExtensions: z.array(z.string()).default([]),
      })
      .strict()
      .prefault({}),
    conversation: z.array(conversationEntrySchema).default([]),
    pendingAgentTurns: z.array(pendingAgentTurnSchema).default([]),
    extensionHost: z.record(z.string(), extensionHostDataSchema).default({}),
  })
  .strict();

export type StorageData = z.infer<typeof storageSchema>;
export type StorageInput = z.input<typeof storageSchema>;

export interface StorageRepository {
  readonly filePath: string;
  read(): Promise<StorageData>;
  write(data: StorageData): Promise<void>;
  update(mutator: (draft: StorageData) => void): Promise<StorageData>;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && Reflect.get(error, "code") === "ENOENT";
}

export function createStorageRepository(
  userDataPath: string,
): StorageRepository {
  const storageFile = join(userDataPath, "chat-storage.json");
  let updateQueue = Promise.resolve();

  const readSnapshot = async (): Promise<StorageData> => {
    try {
      return storageSchema.parse(
        JSON.parse(await readFile(storageFile, "utf8")),
      );
    } catch (error) {
      if (isMissingFile(error)) return storageSchema.parse({});
      throw error;
    }
  };

  const persist = async (data: StorageData): Promise<void> => {
    const validated = storageSchema.parse(data);
    await writePrivateFile(storageFile, JSON.stringify(validated, null, 2));
  };

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const operation = updateQueue.then(task);
    updateQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };
  const read = async (): Promise<StorageData> => {
    await updateQueue;
    return readSnapshot();
  };
  const write = async (data: StorageData): Promise<void> => {
    // Snapshot at the boundary so later caller mutations cannot change a queued write.
    const snapshot = storageSchema.parse(data);
    return enqueue(() => persist(snapshot));
  };

  const update = (
    mutator: (draft: StorageData) => void,
  ): Promise<StorageData> => {
    return enqueue(async () => {
      const draft = await readSnapshot();
      mutator(draft);
      await persist(draft);
      return draft;
    });
  };

  return { filePath: storageFile, read, write, update };
}
