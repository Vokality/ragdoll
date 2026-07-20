import {
  chmod,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
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

  const read = async (): Promise<StorageData> => {
    try {
      return storageSchema.parse(
        JSON.parse(await readFile(storageFile, "utf8")),
      );
    } catch (error) {
      if (isMissingFile(error)) return storageSchema.parse({});
      throw error;
    }
  };

  const write = async (data: StorageData): Promise<void> => {
    const validated = storageSchema.parse(data);
    const temporaryFile = `${storageFile}.tmp`;
    await mkdir(dirname(storageFile), { recursive: true });
    await writeFile(temporaryFile, JSON.stringify(validated, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    try {
      await rename(temporaryFile, storageFile);
      await chmod(storageFile, 0o600);
    } catch (error) {
      await unlink(temporaryFile).catch(() => undefined);
      throw error;
    }
  };

  const update = (
    mutator: (draft: StorageData) => void,
  ): Promise<StorageData> => {
    const operation = updateQueue.then(async () => {
      const draft = await read();
      mutator(draft);
      await write(draft);
      return draft;
    });
    updateQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };

  return { filePath: storageFile, read, write, update };
}
