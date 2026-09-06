import { expect, it } from "bun:test";
import { taskStateSchema } from "./task-state-schema.js";

const task = { id: "one", text: "Task", status: "todo", createdAt: 1 };

it("validates stored task state before it reaches the manager", () => {
  const valid = { tasks: [task], activeTaskId: "one", isExpanded: true };
  expect(taskStateSchema.parse(valid)).toEqual(valid);
  for (const invalid of [
    null,
    { tasks: "invalid", activeTaskId: null, isExpanded: false },
    {
      tasks: [{ ...task, status: "unknown" }],
      activeTaskId: null,
      isExpanded: false,
    },
    { tasks: [task, task], activeTaskId: null, isExpanded: false },
    { tasks: [task], activeTaskId: "missing", isExpanded: false },
    {
      tasks: [{ ...task, createdAt: Infinity }],
      activeTaskId: null,
      isExpanded: false,
    },
  ])
    expect(taskStateSchema.safeParse(invalid).success).toBe(false);
});
