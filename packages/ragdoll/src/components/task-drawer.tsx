import React, { useEffect, useState, useCallback, useRef } from "react";
import { TaskController } from "../controllers/task-controller";
import type { TaskState, Task, TaskStatus } from "../types";
import type { RagdollTheme } from "../themes/types";

interface TaskDrawerProps {
  controller: TaskController;
  theme?: RagdollTheme;
}

/**
 * Animated status icon component with pulse effect for blocked
 */
function StatusIcon({ status, color, animate = false }: { status: TaskStatus; color: string; animate?: boolean }) {
  const pulseStyle: React.CSSProperties = status === "blocked" ? {
    animation: "pulse 2s ease-in-out infinite",
  } : {};

  switch (status) {
    case "todo":
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transition: "all 0.3s ease", ...pulseStyle }}>
          <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.5" style={{ transition: "stroke 0.3s ease" }} />
        </svg>
      );
    case "in_progress":
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transition: "all 0.3s ease" }}>
          <circle cx="7" cy="7" r="6" fill={color} fillOpacity="0.15" style={{ transition: "all 0.3s ease" }} />
          <path d="M5 4L10 7L5 10V4Z" fill={color} style={{ transition: "fill 0.3s ease" }} />
        </svg>
      );
    case "blocked":
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transition: "all 0.3s ease", ...pulseStyle }}>
          <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.5" style={{ transition: "stroke 0.3s ease" }} />
          <line x1="4" y1="7" x2="10" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "done":
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transition: "all 0.3s ease" }}>
          <circle cx="7" cy="7" r="6" fill={color} style={{ transition: "fill 0.3s ease" }} />
          <path 
            d="M4 7L6 9L10 5" 
            stroke="white" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{
              strokeDasharray: animate ? 12 : 0,
              strokeDashoffset: animate ? 0 : 0,
              transition: "stroke-dashoffset 0.4s ease",
            }}
          />
        </svg>
      );
  }
}

/**
 * Animated chevron icon for drawer handle
 */
function ChevronIcon({ isExpanded, color }: { isExpanded: boolean; color: string }) {
  return (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 16 16" 
      fill="none"
      style={{
        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <path 
        d="M4 6L8 10L12 6" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Single task item row with staggered animation
 */
function TaskItem({ 
  task, 
  isActive, 
  colors,
  index,
  isVisible,
}: { 
  task: Task; 
  isActive: boolean;
  colors: TaskColors;
  index: number;
  isVisible: boolean;
}) {
  const statusColor = getStatusColor(task.status, colors);
  const isDone = task.status === "done";
  const isBlocked = task.status === "blocked";
  
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 0",
        opacity: isVisible ? (isDone ? 0.5 : isActive ? 1 : 0.75) : 0,
        transform: isVisible ? "translateY(0)" : "translateY(-8px)",
        transition: `
          opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${index * 50}ms,
          transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 50}ms
        `,
      }}
    >
      <div style={{ 
        flexShrink: 0,
        animation: isBlocked ? "pulse 2s ease-in-out infinite" : undefined,
      }}>
        <StatusIcon status={task.status} color={statusColor} />
      </div>
      <span
        style={{
          flex: 1,
          fontSize: "13px",
          color: colors.text,
          textDecoration: isDone ? "line-through" : "none",
          fontWeight: isActive ? 600 : 400,
          transition: "all 0.3s ease",
        }}
      >
        {task.text}
      </span>
      {isBlocked && task.blockedReason && (
        <span style={{ 
          fontSize: "10px", 
          color: colors.blocked, 
          opacity: 0.8,
          maxWidth: "80px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {task.blockedReason}
        </span>
      )}
    </div>
  );
}

interface TaskColors {
  text: string;
  muted: string;
  accent: string;
  blocked: string;
  done: string;
  border: string;
  background: string;
  glow: string;
}

function getStatusColor(status: TaskStatus, colors: TaskColors): string {
  switch (status) {
    case "in_progress":
      return colors.accent;
    case "blocked":
      return colors.blocked;
    case "done":
      return colors.done;
    default:
      return colors.muted;
  }
}

/**
 * Task drawer component with beautiful animations
 */
export function TaskDrawer({ controller, theme }: TaskDrawerProps) {
  const [state, setState] = useState<TaskState>(controller.getState());
  const prevExpandedRef = useRef(state.isExpanded);

  useEffect(() => {
    const unsubscribe = controller.onUpdate((newState) => {
      prevExpandedRef.current = newState.isExpanded;
      setState(newState);
    });
    setState(controller.getState());
    return unsubscribe;
  }, [controller]);

  const handleToggle = useCallback(() => {
    controller.toggle();
  }, [controller]);

  // Don't render if no tasks
  if (state.tasks.length === 0) {
    return null;
  }

  // Theme-aware colors with glow
  const colors: TaskColors = {
    text: theme?.colors.hair.light ?? "#f1f5f9",
    muted: theme?.colors.skin.dark ?? "#94a3b8",
    accent: theme?.colors.eyes.iris ?? "#5a9bc4",
    blocked: theme?.colors.lips.lower ?? "#e07882",
    done: "#4ade80",
    border: theme?.colors.shadow.color ?? "rgba(148, 163, 184, 0.2)",
    background: theme?.colors.shadow.transparent ?? "rgba(0, 0, 0, 0.15)",
    glow: theme?.colors.eyes.iris ?? "#5a9bc4",
  };

  const activeTask = state.tasks.find((t) => t.id === state.activeTaskId);
  const otherTasks = state.tasks.filter((t) => t.id !== state.activeTaskId);
  const totalTasks = state.tasks.length;
  const completedTasks = state.tasks.filter((t) => t.status === "done").length;
  const progress = `${completedTasks}/${totalTasks}`;

  return (
    <div style={styles.container}>
      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(90, 155, 196, 0); }
          50% { box-shadow: 0 0 12px 2px rgba(90, 155, 196, 0.15); }
        }
      `}</style>

      {/* Main card */}
      <div
        style={{
          ...styles.card,
          borderColor: colors.border,
          backgroundColor: colors.background,
          boxShadow: activeTask ? `0 0 20px 0 ${colors.glow}15` : "none",
          transition: "box-shadow 0.5s ease, transform 0.3s ease",
        }}
      >
        {/* Active task section */}
        {activeTask ? (
          <div style={styles.activeSection}>
            <div style={styles.activeHeader}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
                <StatusIcon status="in_progress" color={colors.accent} />
                <span style={{ 
                  ...styles.statusLabel, 
                  color: colors.accent,
                  animation: "glow 3s ease-in-out infinite",
                }}>
                  IN PROGRESS
                </span>
              </div>
            </div>
            <div 
              style={{ 
                ...styles.activeText, 
                color: colors.text,
                animation: "slideIn 0.4s ease",
              }}
            >
              {activeTask.text}
            </div>
            {/* Progress indicator */}
            <div style={{
              ...styles.progressBar,
              backgroundColor: `${colors.accent}20`,
              marginTop: "12px",
            }}>
              <div style={{
                height: "100%",
                width: `${(completedTasks / totalTasks) * 100}%`,
                backgroundColor: colors.accent,
                borderRadius: "2px",
                transition: "width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }} />
            </div>
          </div>
        ) : (
          <div style={styles.activeSection}>
            <div style={{ ...styles.noActiveText, color: colors.muted }}>
              No active task
            </div>
          </div>
        )}

        {/* Drawer handle */}
        {otherTasks.length > 0 && (
          <button
            onClick={handleToggle}
            style={{
              ...styles.handle,
              borderTopColor: colors.border,
            }}
            aria-label={state.isExpanded ? "Collapse tasks" : "Expand tasks"}
          >
            <span style={{ 
              ...styles.handleText, 
              color: colors.muted,
              transition: "color 0.2s ease",
            }}>
              {progress}
            </span>
            <ChevronIcon isExpanded={state.isExpanded} color={colors.muted} />
          </button>
        )}

        {/* Expanded task list with staggered animations */}
        <div
          style={{
            ...styles.expandedSection,
            maxHeight: state.isExpanded ? `${otherTasks.length * 44 + 20}px` : "0px",
            opacity: state.isExpanded ? 1 : 0,
            borderTopColor: colors.border,
            borderTopWidth: state.isExpanded && otherTasks.length > 0 ? "1px" : "0px",
          }}
        >
          <div style={styles.taskList}>
            {otherTasks.map((task, index) => (
              <TaskItem
                key={task.id}
                task={task}
                isActive={false}
                colors={colors}
                index={index}
                isVisible={state.isExpanded}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: "12px",
    width: "100%",
    maxWidth: "280px",
  },
  card: {
    width: "100%",
    borderRadius: "14px",
    border: "1px solid",
    overflow: "hidden",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },
  activeSection: {
    padding: "16px 18px",
  },
  activeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  statusLabel: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  activeText: {
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: 1.5,
  },
  noActiveText: {
    fontSize: "13px",
    fontStyle: "italic",
    textAlign: "center",
    padding: "8px 0",
  },
  progressBar: {
    height: "3px",
    borderRadius: "2px",
    overflow: "hidden",
  },
  handle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    width: "100%",
    padding: "10px 18px",
    background: "transparent",
    border: "none",
    borderTop: "1px solid",
    cursor: "pointer",
    transition: "background 0.2s ease, opacity 0.2s ease",
  },
  handleText: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.3px",
  },
  expandedSection: {
    overflow: "hidden",
    transition: `
      max-height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
      opacity 0.3s ease
    `,
    borderTopStyle: "solid",
  },
  taskList: {
    padding: "6px 18px 12px",
  },
};
