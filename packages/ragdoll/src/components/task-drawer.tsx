import React, { useEffect, useState, useCallback, useRef } from "react";
import { TaskController } from "../controllers/task-controller";
import type { TaskState, Task, TaskStatus } from "../types";
import type { RagdollTheme } from "../themes/types";

interface TaskDrawerProps {
  controller: TaskController;
  theme?: RagdollTheme;
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

// Gesture tracking
interface DragState {
  isDragging: boolean;
  startX: number;
  currentX: number;
  startTime: number;
}

const SWIPE_THRESHOLD = 50; // px
const VELOCITY_THRESHOLD = 0.5; // px/ms
const MAX_PEEK_CARDS = 3;

/**
 * Get card style based on position in stack
 */
function getCardStyle(
  index: number,
  currentIndex: number,
  dragOffset: number = 0,
  isDragging: boolean = false,
): React.CSSProperties {
  const distance = index - currentIndex;

  // Cards behind current (already viewed)
  if (distance < 0) {
    return {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      opacity: 0,
      pointerEvents: "none",
      transform: "translateX(-100%) scale(0.8)",
    };
  }

  // Cards too far ahead
  if (distance > MAX_PEEK_CARDS) {
    return {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      opacity: 0,
      pointerEvents: "none",
    };
  }

  // Current card
  if (distance === 0) {
    const dragTransform = isDragging ? `translateX(${dragOffset * 0.3}px)` : "";
    return {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      transform: `${dragTransform} scale(1) translateY(0px)`,
      opacity: 1,
      transition: isDragging
        ? "none"
        : "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      pointerEvents: "auto",
    };
  }

  // Peek cards
  const yOffset = distance * 4;
  const scale = 1 - distance * 0.05;
  const opacity = 0.6 + (1 - distance * 0.2);

  return {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50 - distance * 10,
    transform: `translateY(-${yOffset}px) scale(${scale})`,
    opacity,
    transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
    pointerEvents: "none",
  };
}

/**
 * Status icon component
 */
function StatusIcon({
  status,
  color,
  size = 16,
}: {
  status: TaskStatus;
  color: string;
  size?: number;
}) {
  const pulseStyle: React.CSSProperties =
    status === "blocked"
      ? {
          animation: "pulse 2s ease-in-out infinite",
        }
      : {};

  switch (status) {
    case "todo":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 14 14"
          fill="none"
          style={{ transition: "all 0.3s ease", ...pulseStyle }}
        >
          <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "in_progress":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 14 14"
          fill="none"
          style={{ transition: "all 0.3s ease" }}
        >
          <circle cx="7" cy="7" r="6" fill={color} fillOpacity="0.15" />
          <path d="M5 4L10 7L5 10V4Z" fill={color} />
        </svg>
      );
    case "blocked":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 14 14"
          fill="none"
          style={{ transition: "all 0.3s ease", ...pulseStyle }}
        >
          <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.5" />
          <line
            x1="4"
            y1="7"
            x2="10"
            y2="7"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "done":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 14 14"
          fill="none"
          style={{ transition: "all 0.3s ease" }}
        >
          <circle cx="7" cy="7" r="6" fill={color} />
          <path
            d="M4 7L6 9L10 5"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

/**
 * Single task card
 */
function TaskCard({
  task,
  colors,
  style,
  isActive,
  onPointerDown,
}: {
  task: Task;
  colors: TaskColors;
  style: React.CSSProperties;
  isActive: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const statusColor = getStatusColor(task.status, colors);
  const isBlocked = task.status === "blocked";
  const isDone = task.status === "done";
  const isInProgress = task.status === "in_progress";

  // Enhanced styles for priority
  const cardBorder = isBlocked
    ? `1px solid ${colors.blocked}`
    : isDone
      ? `0.5px solid ${colors.border}`
      : isInProgress && isActive
        ? `1px solid ${colors.accent}`
        : `0.5px solid ${colors.border}`;

  const cardGlow =
    isInProgress && isActive ? `0 0 12px 0 ${colors.glow}15` : "none";

  const cardFilter = isDone ? "saturate(0.5)" : "none";

  return (
    <div
      style={{
        ...style,
        borderRadius: "10px",
        border: cardBorder,
        backgroundColor: colors.background,
        boxShadow: cardGlow,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "12px 14px",
        minHeight: "70px",
        filter: cardFilter,
        cursor: isActive ? "grab" : "default",
      }}
      onPointerDown={onPointerDown}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div style={{ flexShrink: 0, marginTop: "1px" }}>
          <StatusIcon
            status={task.status}
            color={statusColor}
            size={isBlocked ? 15 : 13}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: isActive && isInProgress ? "14px" : "13px",
              fontWeight: isActive ? 500 : 400,
              color: colors.text,
              lineHeight: 1.4,
              marginBottom: "2px",
              transition: "all 0.3s ease",
            }}
          >
            {task.text}
          </div>
          {isBlocked && task.blockedReason && (
            <div
              style={{
                fontSize: "11px",
                color: colors.blocked,
                marginTop: "6px",
                padding: "4px 8px",
                backgroundColor: `${colors.blocked}15`,
                borderRadius: "4px",
                borderLeft: `2px solid ${colors.blocked}`,
              }}
            >
              {task.blockedReason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
 * Stacked card task drawer with gestures, keyboard nav, and search
 */
export function TaskDrawer({ controller, theme }: TaskDrawerProps) {
  const [state, setState] = useState<TaskState>(controller.getState());
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    currentX: 0,
    startTime: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = controller.onUpdate((newState) => {
      setState(newState);
    });
    setState(controller.getState());
    return unsubscribe;
  }, [controller]);

  // Filter tasks
  const filteredTasks = state.tasks.filter((task) => {
    // Auto-hide completed unless toggled
    if (!showCompleted && task.status === "done") return false;

    // Search query
    if (searchQuery) {
      return task.text.toLowerCase().includes(searchQuery.toLowerCase());
    }

    return true;
  });

  // Reset card index if needed
  useEffect(() => {
    if (currentCardIndex >= filteredTasks.length && filteredTasks.length > 0) {
      setCurrentCardIndex(0);
    }
  }, [filteredTasks.length, currentCardIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in search
      if (document.activeElement === searchInputRef.current) {
        if (e.key === "Escape") {
          setSearchQuery("");
          searchInputRef.current?.blur();
        }
        return;
      }

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          setCurrentCardIndex((prev) =>
            Math.min(prev + 1, filteredTasks.length - 1),
          );
          break;
        case "ArrowLeft":
          e.preventDefault();
          setCurrentCardIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Home":
          e.preventDefault();
          setCurrentCardIndex(0);
          break;
        case "End":
          e.preventDefault();
          setCurrentCardIndex(filteredTasks.length - 1);
          break;
        case "/":
          e.preventDefault();
          searchInputRef.current?.focus();
          break;
        case "Escape":
          setSearchQuery("");
          break;
        default:
          // Number keys 1-9
          if (e.key >= "1" && e.key <= "9") {
            const index = parseInt(e.key) - 1;
            if (index < filteredTasks.length) {
              e.preventDefault();
              setCurrentCardIndex(index);
            }
          }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredTasks.length]);

  // Gesture handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragState({
      isDragging: true,
      startX: e.clientX,
      currentX: e.clientX,
      startTime: Date.now(),
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.isDragging) return;

      setDragState((prev) => ({
        ...prev,
        currentX: e.clientX,
      }));
    },
    [dragState.isDragging],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.isDragging) return;

      const deltaX = dragState.currentX - dragState.startX;
      const deltaTime = Date.now() - dragState.startTime;
      const velocity = Math.abs(deltaX) / deltaTime;

      // Determine if swipe occurred
      if (Math.abs(deltaX) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        if (deltaX < 0) {
          // Swipe left - next card
          setCurrentCardIndex((prev) =>
            Math.min(prev + 1, filteredTasks.length - 1),
          );
        } else {
          // Swipe right - previous card
          setCurrentCardIndex((prev) => Math.max(prev - 1, 0));
        }
      }

      setDragState({
        isDragging: false,
        startX: 0,
        currentX: 0,
        startTime: 0,
      });
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    },
    [dragState, filteredTasks.length],
  );

  // Don't render if no tasks
  if (state.tasks.length === 0) {
    return null;
  }

  // Theme-aware colors
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

  const dragOffset = dragState.isDragging
    ? dragState.currentX - dragState.startX
    : 0;

  const hiddenCompletedCount = state.tasks.filter(
    (t) => t.status === "done" && !showCompleted,
  ).length;

  const currentTask = filteredTasks[currentCardIndex];

  return (
    <div style={styles.container} ref={containerRef}>
      {/* CSS animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Search bar */}
      <div style={styles.searchBar}>
        <div style={styles.searchInputWrapper}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ flexShrink: 0 }}
          >
            <circle
              cx="6"
              cy="6"
              r="4"
              stroke={colors.muted}
              strokeWidth="1.5"
            />
            <path
              d="M9 9L12 12"
              stroke={colors.muted}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              ...styles.searchInput,
              color: colors.text,
              borderColor: colors.border,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                ...styles.clearButton,
                color: colors.muted,
              }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Card stack */}
      <div
        style={styles.cardStack}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {filteredTasks.length === 0 ? (
          <div
            style={{
              ...styles.emptyState,
              color: colors.muted,
              borderColor: colors.border,
            }}
          >
            {searchQuery ? "No matching tasks" : "All tasks completed!"}
          </div>
        ) : (
          <>
            {filteredTasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                colors={colors}
                style={getCardStyle(
                  index,
                  currentCardIndex,
                  dragOffset,
                  dragState.isDragging && index === currentCardIndex,
                )}
                isActive={index === currentCardIndex}
                onPointerDown={
                  index === currentCardIndex ? handlePointerDown : undefined
                }
              />
            ))}
          </>
        )}
      </div>

      {/* Card navigation indicator */}
      {filteredTasks.length > 1 && (
        <div style={styles.navIndicator}>
          <span style={{ ...styles.navText, color: colors.muted }}>
            {currentCardIndex + 1} / {filteredTasks.length}
          </span>
          <div style={styles.navDots}>
            {filteredTasks.slice(0, 5).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentCardIndex(index)}
                style={{
                  ...styles.navDot,
                  backgroundColor:
                    index === currentCardIndex ? colors.accent : colors.border,
                  width: index === currentCardIndex ? "16px" : "6px",
                }}
                aria-label={`Go to task ${index + 1}`}
              />
            ))}
            {filteredTasks.length > 5 && (
              <span style={{ ...styles.navText, color: colors.muted }}>
                +{filteredTasks.length - 5}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Show completed toggle */}
      {hiddenCompletedCount > 0 && (
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          style={{
            ...styles.toggleCompleted,
            color: colors.muted,
            borderColor: colors.border,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" fill={colors.done} />
            <path
              d="M4 7L6 9L10 5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {showCompleted ? "Hide" : "Show"} {hiddenCompletedCount} completed
        </button>
      )}

      {/* Keyboard hints */}
      {currentTask && (
        <div style={{ ...styles.keyboardHint, color: colors.muted }}>
          ← → Navigate • / Search • 1-{Math.min(9, filteredTasks.length)} Jump
        </div>
      )}
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
    maxWidth: "300px",
    gap: "10px",
  },
  searchBar: {
    width: "100%",
  },
  searchInputWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 8px",
    borderRadius: "6px",
    border: "0.5px solid",
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  searchInput: {
    flex: 1,
    background: "none",
    border: "none",
    outline: "none",
    fontSize: "11px",
    fontFamily: "inherit",
  },
  clearButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px 4px",
    fontSize: "12px",
    opacity: 0.7,
    transition: "opacity 0.2s ease",
  },
  cardStack: {
    position: "relative",
    width: "100%",
    height: "120px",
    touchAction: "none",
  },
  emptyState: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    textAlign: "center",
    fontSize: "12px",
    fontStyle: "italic",
    padding: "16px",
    border: "0.5px dashed",
    borderRadius: "10px",
    width: "80%",
  },
  navIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "4px 10px",
    borderRadius: "10px",
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  navText: {
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.2px",
  },
  navDots: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  navDot: {
    width: "6px",
    height: "6px",
    borderRadius: "3px",
    border: "none",
    padding: 0,
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  toggleCompleted: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 10px",
    fontSize: "10px",
    background: "transparent",
    border: "0.5px solid",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
  },
  keyboardHint: {
    fontSize: "9px",
    textAlign: "center",
    opacity: 0.4,
    marginTop: "2px",
  },
};
