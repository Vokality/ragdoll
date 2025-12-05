import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import type { Task, TaskState } from "@vokality/ragdoll-extension-tasks";

const TASK_STATUS_VALUES = ["todo", "in_progress", "blocked", "done"] as const;

const taskSchema: z.ZodType<Task> = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(TASK_STATUS_VALUES),
  createdAt: z.number().int().nonnegative(),
  blockedReason: z.string().optional(),
});

export const taskStateSchema: z.ZodType<TaskState> = z.object({
  tasks: z.array(taskSchema),
  activeTaskId: z.string().nullable(),
  isExpanded: z.boolean().default(false),
});

export const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const spotifyTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  scope: z.string(),
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
    tasks: taskStateSchema.optional(),
    spotifyClientId: z.string().optional(),
    spotifyTokens: spotifyTokensSchema.optional(),
  })
  .passthrough();

export type StorageData = z.infer<typeof storageSchema>;

export interface StorageRepository {
  readonly filePath: string;
  read(): StorageData;
  write(data: StorageData): void;
  update(mutator: (draft: StorageData) => void): StorageData;
  getTaskState(): TaskState;
  setTaskState(state: TaskState): void;
}

export const DEFAULT_TASK_STATE: TaskState = {
  tasks: [],
  activeTaskId: null,
  isExpanded: false,
};

export function cloneTaskState(state: TaskState): TaskState {
  return {
    tasks: state.tasks.map((task: Task) => ({ ...task })),
    activeTaskId: state.activeTaskId,
    isExpanded: state.isExpanded,
  };
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

  const getTaskState = (): TaskState => {
    const storage = read();
    return storage.tasks ? cloneTaskState(storage.tasks) : cloneTaskState(DEFAULT_TASK_STATE);
  };

  const setTaskState = (state: TaskState): void => {
    update((draft) => {
      draft.tasks = cloneTaskState(state);
    });
  };

  return {
    filePath: storageFile,
    read,
    write,
    update,
    getTaskState,
    setTaskState,
  };
}
