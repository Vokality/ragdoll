import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import type { TaskController, TaskState, Task, TaskStatus } from "@vokality/ragdoll";

interface TaskSheetProps {
  isOpen: boolean;
  onClose: () => void;
  controller: TaskController;
}

type AnimationState = "entering" | "visible" | "exiting" | "hidden";

const ANIMATION_DURATION = 250;

export function TaskSheet({ isOpen, onClose, controller }: TaskSheetProps) {
  const [state, setState] = useState<TaskState>(controller.getState());
  const [animationState, setAnimationState] = useState<AnimationState>("hidden");
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Sync state immediately in case it changed before subscription
    setState(controller.getState());
    const unsubscribe = controller.onUpdate(setState);
    return unsubscribe;
  }, [controller]);

  // Handle open/close with animation states
  useEffect(() => {
    // Clear any pending exit timer when opening
    if (isOpen) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      if (animationState === "hidden" || animationState === "exiting") {
        setAnimationState("entering");
        // Small delay to trigger CSS transition
        requestAnimationFrame(() => {
          setAnimationState("visible");
        });
      }
    } else {
      // Closing
      if (animationState === "visible" || animationState === "entering") {
        setAnimationState("exiting");
        exitTimerRef.current = setTimeout(() => {
          setAnimationState("hidden");
          exitTimerRef.current = null;
        }, ANIMATION_DURATION);
      }
    }

    // Cleanup on unmount only
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Don't render if fully hidden
  if (animationState === "hidden") {
    return null;
  }

  const activeTasks = state.tasks.filter((t) => t.status !== "done");
  const completedTasks = state.tasks.filter((t) => t.status === "done");
  const isVisible = animationState === "visible";

  const handleToggleStatus = (task: Task) => {
    if (task.status === "done") {
      controller.updateTaskStatus(task.id, "todo");
    } else {
      controller.updateTaskStatus(task.id, "done");
    }
  };

  const handleSetActive = (taskId: string) => {
    controller.setActiveTask(taskId);
  };

  const handleClearCompleted = () => {
    controller.clearCompleted();
  };

  return (
    <>
      <style>{`
        @keyframes sheetSlideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes sheetSlideDown {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(100%);
          }
        }

        @keyframes backdropFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes backdropFadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes taskItemFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .task-sheet-backdrop {
          animation: backdropFadeIn ${ANIMATION_DURATION}ms ease-out forwards;
        }

        .task-sheet-backdrop.exiting {
          animation: backdropFadeOut ${ANIMATION_DURATION}ms ease-out forwards;
        }

        .task-sheet-panel {
          animation: sheetSlideUp ${ANIMATION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
        }

        .task-sheet-panel.exiting {
          animation: sheetSlideDown ${ANIMATION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
        }

        .task-item {
          animation: taskItemFadeIn 200ms ease-out backwards;
        }

        .task-sheet-close:hover {
          color: var(--text-primary);
          background: var(--bg-glass);
        }

        .task-sheet-clear:hover {
          color: var(--text-primary);
          background: var(--bg-glass);
        }

        .task-checkbox:hover {
          border-color: var(--accent);
        }

        .task-content:hover {
          background: var(--bg-glass-light);
          border-radius: var(--radius-sm);
        }
      `}</style>

      {/* Backdrop */}
      <div
        className={`task-sheet-backdrop ${animationState === "exiting" ? "exiting" : ""}`}
        style={styles.backdrop}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`task-sheet-panel ${animationState === "exiting" ? "exiting" : ""}`}
        style={styles.sheet}
      >
        {/* Handle */}
        <div style={styles.handleWrapper}>
          <div style={styles.handle} />
        </div>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Tasks</h2>
          <button
            onClick={handleClose}
            style={styles.closeButton}
            className="task-sheet-close"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {activeTasks.length === 0 && completedTasks.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>✓</span>
              <p style={styles.emptyText}>No tasks yet</p>
              <p style={styles.emptySubtext}>Tasks will appear here when added</p>
            </div>
          ) : (
            <>
              {/* Active Tasks */}
              {activeTasks.length > 0 && (
                <section style={styles.section}>
                  <h3 style={styles.sectionTitle}>
                    Active ({activeTasks.length})
                  </h3>
                  <ul style={styles.taskList}>
                    {activeTasks.map((task, index) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        index={index}
                        isActive={task.id === state.activeTaskId}
                        onToggle={() => handleToggleStatus(task)}
                        onSetActive={() => handleSetActive(task.id)}
                        animate={isVisible}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <section style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>
                      Completed ({completedTasks.length})
                    </h3>
                    <button
                      onClick={handleClearCompleted}
                      style={styles.clearButton}
                      className="task-sheet-clear"
                    >
                      Clear all
                    </button>
                  </div>
                  <ul style={styles.taskList}>
                    {completedTasks.map((task, index) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        index={activeTasks.length + index}
                        isActive={false}
                        onToggle={() => handleToggleStatus(task)}
                        onSetActive={() => {}}
                        animate={isVisible}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

interface TaskItemProps {
  task: Task;
  index: number;
  isActive: boolean;
  onToggle: () => void;
  onSetActive: () => void;
  animate: boolean;
}

function TaskItem({ task, index, isActive, onToggle, onSetActive, animate }: TaskItemProps) {
  const isDone = task.status === "done";
  const isBlocked = task.status === "blocked";

  const itemStyle: CSSProperties = {
    ...styles.taskItem,
    ...(isActive && styles.taskItemActive),
    ...(isBlocked && styles.taskItemBlocked),
    animationDelay: animate ? `${index * 50}ms` : "0ms",
  };

  return (
    <li className="task-item" style={itemStyle}>
      <button
        onClick={onToggle}
        className="task-checkbox"
        style={{
          ...styles.checkbox,
          ...(isDone && styles.checkboxChecked),
        }}
        aria-label={isDone ? "Mark as incomplete" : "Mark as complete"}
      >
        {isDone && <CheckIcon />}
      </button>

      <div
        className={!isDone ? "task-content" : undefined}
        style={styles.taskContent}
        onClick={!isDone ? onSetActive : undefined}
      >
        <span
          style={{
            ...styles.taskText,
            ...(isDone && styles.taskTextDone),
          }}
        >
          {task.text}
        </span>
        {isBlocked && task.blockedReason && (
          <span style={styles.blockedReason}>{task.blockedReason}</span>
        )}
        <div style={styles.taskMeta}>
          <StatusBadge status={task.status} />
          {isActive && <span style={styles.activeBadge}>Current</span>}
        </div>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const config: Record<TaskStatus, { label: string; style: CSSProperties }> = {
    todo: {
      label: "To do",
      style: { backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" },
    },
    in_progress: {
      label: "In progress",
      style: { backgroundColor: "var(--accent-glow)", color: "var(--accent)" },
    },
    blocked: {
      label: "Blocked",
      style: { backgroundColor: "var(--error-dim)", color: "var(--error)" },
    },
    done: {
      label: "Done",
      style: { backgroundColor: "var(--success-dim)", color: "var(--success)" },
    },
  };

  const { label, style } = config[status];

  return <span style={{ ...styles.statusBadge, ...style }}>{label}</span>;
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    zIndex: 100,
  },
  sheet: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "70vh",
    backgroundColor: "var(--bg-secondary)",
    borderTopLeftRadius: "var(--radius-xl)",
    borderTopRightRadius: "var(--radius-xl)",
    border: "1px solid var(--border)",
    borderBottom: "none",
    zIndex: 101,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 -4px 30px rgba(0, 0, 0, 0.3)",
  },
  handleWrapper: {
    display: "flex",
    justifyContent: "center",
    padding: "12px 0 4px",
  },
  handle: {
    width: "36px",
    height: "4px",
    backgroundColor: "var(--bg-tertiary)",
    borderRadius: "2px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 20px 16px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  title: {
    fontSize: "18px",
    fontWeight: "600",
    color: "var(--text-primary)",
    margin: 0,
  },
  closeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "var(--radius-md)",
    color: "var(--text-muted)",
    cursor: "pointer",
    transition: "color 150ms ease, background 150ms ease",
    border: "none",
    background: "transparent",
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "16px 20px 24px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "16px",
    opacity: 0.3,
  },
  emptyText: {
    fontSize: "16px",
    fontWeight: "500",
    color: "var(--text-muted)",
    margin: 0,
  },
  emptySubtext: {
    fontSize: "14px",
    color: "var(--text-dim)",
    marginTop: "8px",
  },
  section: {
    marginBottom: "24px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--text-dim)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: "0 0 12px 0",
  },
  clearButton: {
    fontSize: "12px",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: "var(--radius-sm)",
    transition: "color 150ms ease, background 150ms ease",
    border: "none",
    background: "transparent",
  },
  taskList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  taskItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "12px",
    backgroundColor: "var(--bg-glass)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)",
    transition: "border-color 150ms ease, box-shadow 150ms ease, background 150ms ease",
  },
  taskItemActive: {
    borderColor: "var(--accent)",
    boxShadow: "0 0 0 1px var(--accent-glow), 0 0 12px var(--accent-glow)",
  },
  taskItemBlocked: {
    borderColor: "var(--error)",
    backgroundColor: "var(--error-dim)",
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "6px",
    border: "2px solid var(--border)",
    backgroundColor: "transparent",
    cursor: "pointer",
    flexShrink: 0,
    marginTop: "2px",
    transition: "border-color 150ms ease, background 150ms ease, transform 150ms ease",
  },
  checkboxChecked: {
    borderColor: "var(--success)",
    backgroundColor: "var(--success)",
    color: "var(--bg-primary)",
  },
  taskContent: {
    flex: 1,
    minWidth: 0,
    cursor: "pointer",
    padding: "2px 4px",
    margin: "-2px -4px",
    transition: "background 150ms ease",
    borderRadius: "var(--radius-sm)",
  },
  taskText: {
    display: "block",
    fontSize: "14px",
    fontWeight: "500",
    color: "var(--text-primary)",
    lineHeight: "1.4",
    wordBreak: "break-word",
  },
  taskTextDone: {
    textDecoration: "line-through",
    color: "var(--text-dim)",
  },
  blockedReason: {
    display: "block",
    fontSize: "12px",
    color: "var(--error)",
    marginTop: "4px",
    fontStyle: "italic",
  },
  taskMeta: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "8px",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: "500",
    borderRadius: "4px",
  },
  activeBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: "500",
    borderRadius: "4px",
    backgroundColor: "var(--accent)",
    color: "var(--bg-primary)",
  },
};
