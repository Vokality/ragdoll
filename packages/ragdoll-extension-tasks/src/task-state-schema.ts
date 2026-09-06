import { z } from "@vokality/ragdoll-extensions";
import { TASK_STATUSES, type TaskState } from "./task-manager.js";

export const taskStateSchema = z
  .object({
    tasks: z.array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
        status: z.enum(TASK_STATUSES),
        createdAt: z.number(),
        blockedReason: z.string().optional(),
      }),
    ),
    activeTaskId: z.string().min(1).nullable(),
    isExpanded: z.boolean(),
  })
  .superRefine((state, context) => {
    const ids = new Set(state.tasks.map((task) => task.id));
    if (ids.size !== state.tasks.length) {
      context.addIssue({
        code: "custom",
        message: "Stored task IDs must be unique",
        path: ["tasks"],
      });
    }
    if (state.activeTaskId !== null && !ids.has(state.activeTaskId)) {
      context.addIssue({
        code: "custom",
        message: "Active task must reference a stored task",
        path: ["activeTaskId"],
      });
    }
  }) satisfies z.ZodType<TaskState>;
