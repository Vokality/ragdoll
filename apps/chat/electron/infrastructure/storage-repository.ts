import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

export const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const storageSchema = z
  .object({
    apiKey: z.string().optional(),
    apiKeyEncrypted: z.string().optional(),
    settings: z
      .object({
        theme: z.string().optional(),
        variant: z.string().optional(),
        disabledExtensions: z.array(z.string()).optional(),
      })
      .optional(),
    conversation: z.array(conversationMessageSchema).optional(),
  })
  .passthrough();

export type StorageData = z.infer<typeof storageSchema>;

export interface StorageRepository {
  readonly filePath: string;
  read(): StorageData;
  write(data: StorageData): void;
  update(mutator: (draft: StorageData) => void): StorageData;
}

export function createStorageRepository(userDataPath: string): StorageRepository {
  const storageFile = path.join(userDataPath, "chat-storage.json");

  const read = (): StorageData => {
    try {
      if (fs.existsSync(storageFile)) {
        const data = fs.readFileSync(storageFile, "utf-8");
        const parsed = JSON.parse(data);
        const result = storageSchema.safeParse(parsed);
        if (result.success) {
          return result.data;
        }
        console.warn("Invalid chat storage detected, falling back to defaults", result.error.flatten());
      }
    } catch (error) {
      console.error("Failed to load storage:", error);
    }
    return {};
  };

  const write = (data: StorageData): void => {
    try {
      const validated = storageSchema.parse(data);
      fs.writeFileSync(storageFile, JSON.stringify(validated, null, 2));
    } catch (error) {
      console.error("Failed to save storage:", error);
    }
  };

  const update = (mutator: (draft: StorageData) => void): StorageData => {
    const draft = read();
    mutator(draft);
    write(draft);
    return draft;
  };

  return {
    filePath: storageFile,
    read,
    write,
    update,
  };
}
