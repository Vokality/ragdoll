/**
 * Task Extension UI Slot
 *
 * Provides a UI slot for the task extension that displays tasks in a
 * panel with checkboxes for completion.
 */

import {
  createDerivedSlotState,
  type ExtensionUISlot,
  type ListPanelItem,
  type ListPanelSection,
  type ItemStatus,
  type SlotStateStore,
} from "@vokality/ragdoll-extensions/ui";
import type { TaskManager, Task, TaskState, TaskStatus } from "./task-manager.js";

// =============================================================================
// Types
// =============================================================================

export interface TaskUISlotOptions {
  /** The task manager instance to derive state from */
  manager: TaskManager;
  /** Optional slot ID (default: "tasks.main") */
  id?: string;
  /** Optional slot label (default: "Tasks") */
  label?: string;
  /** Optional slot priority (default: 100) */
  priority?: number;
}

export interface TaskUISlotResult {
  /** The UI slot definition */
  slot: ExtensionUISlot;
  /** The slot state store (for external subscriptions) */
  state: SlotStateStore;
}

// =============================================================================
// Status Mapping
// =============================================================================

function taskStatusToItemStatus(status: TaskStatus, isActive: boolean): ItemStatus {
  if (isActive) return "active";
  switch (status) {
    case "done":
      return "success";
    case "blocked":
      return "error";
    case "in_progress":
      return "active";
    case "todo":
    default:
      return "default";
  }
}

// =============================================================================
// Task to Panel Item Conversion
// =============================================================================

function taskToListItem(
  task: Task,
  isActive: boolean,
  manager: TaskManager
): ListPanelItem {
  const isDone = task.status === "done";

  return {
    id: task.id,
    label: task.text,
    sublabel: task.blockedReason,
    status: taskStatusToItemStatus(task.status, isActive),
    checkable: true,
    checked: isDone,
    onToggle: () => {
      if (isDone) {
        manager.updateTaskStatus(task.id, "todo");
      } else {
        manager.updateTaskStatus(task.id, "done");
      }
    },
    onClick: !isDone
      ? () => {
          manager.setActiveTask(task.id);
        }
      : undefined,
  };
}

// =============================================================================
// State Derivation
// =============================================================================

function deriveSlotState(
  taskState: TaskState,
  manager: TaskManager
): {
  badge: number | string | null;
  visible: boolean;
  panel: {
    type: "list";
    title: string;
    emptyMessage: string;
    sections: ListPanelSection[];
  };
} {
  const { tasks, activeTaskId } = taskState;

  // Separate tasks by completion status
  const activeTasks = tasks.filter((t) => t.status !== "done");
  const completedTasks = tasks.filter((t) => t.status === "done");

  // Badge shows count of active (non-done) tasks
  const badge = activeTasks.length > 0 ? activeTasks.length : null;

  // Visible when there are any tasks
  const visible = tasks.length > 0;

  // Build sections
  const sections: ListPanelSection[] = [];

  if (activeTasks.length > 0) {
    sections.push({
      id: "active",
      title: "Active",
      items: activeTasks.map((task) =>
        taskToListItem(task, task.id === activeTaskId, manager)
      ),
    });
  }

  if (completedTasks.length > 0) {
    sections.push({
      id: "completed",
      title: "Completed",
      items: completedTasks.map((task) =>
        taskToListItem(task, false, manager)
      ),
      collapsible: true,
      defaultCollapsed: activeTasks.length > 3,
      actions: [
        {
          id: "clear-completed",
          label: "Clear all",
          onClick: () => {
            manager.clearCompletedTasks();
          },
        },
      ],
    });
  }

  return {
    badge,
    visible,
    panel: {
      type: "list" as const,
      title: "Tasks",
      emptyMessage: "No tasks yet",
      sections,
    },
  };
}

// =============================================================================
// UI Slot Factory
// =============================================================================

/**
 * Create a UI slot for the task extension.
 *
 * The slot displays a checklist icon with a badge showing the count of
 * active tasks. When clicked, it opens a panel with all tasks grouped
 * by status (active vs completed).
 *
 * @example
 * ```ts
 * const { extension, manager } = createStatefulTaskExtension({
 *   onStateChange: (event) => saveToStorage(event.state),
 * });
 *
 * const { slot } = createTaskUISlot({ manager });
 *
 * // Use in your app
 * <SlotBar slots={[slot]} />
 * ```
 */
export function createTaskUISlot(options: TaskUISlotOptions): TaskUISlotResult {
  const {
    manager,
    id = "tasks.main",
    label = "Tasks",
    priority = 100,
  } = options;

  // Create derived state that recomputes when manager state changes
  const state = createDerivedSlotState({
    getSourceState: () => manager.getState(),
    subscribeToSource: (callback) => manager.onStateChange(() => callback()),
    deriveState: (taskState) => deriveSlotState(taskState, manager),
  });

  const slot: ExtensionUISlot = {
    id,
    label,
    icon: "checklist",
    priority,
    state,
  };

  return { slot, state };
}

// =============================================================================
// Convenience Export
// =============================================================================

/**
 * Create a stateful task extension with UI slot included.
 *
 * This is a convenience wrapper that creates both the extension and
 * its UI slot in one call.
 *
 * @example
 * ```ts
 * import { createTaskExtensionWithUI } from "@vokality/ragdoll-extensions";
 *
 * const { extension, manager, slot } = createTaskExtensionWithUI({
 *   onStateChange: (event) => saveToStorage(event.state),
 * });
 *
 * await registry.register(extension);
 *
 * // Use slot in UI
 * <SlotBar slots={[slot]} />
 * ```
 */
export { createTaskUISlot as createTaskSlot };
