import { useState, useCallback, useEffect, useRef, useMemo, type CSSProperties } from "react";
import type { CharacterController, FacialMood, PomodoroDuration, TaskState } from "@vokality/ragdoll";
import { CharacterView } from "../components/character-view";
import { ChatInput } from "../components/chat-input";
import { SettingsModal } from "../components/settings-modal";
import { TaskSheet } from "../components/task-sheet";

interface ChatScreenProps {
  onLogout: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const EMPTY_TASK_STATE: TaskState = {
  tasks: [],
  activeTaskId: null,
  isExpanded: false,
};

export function ChatScreen({ onLogout }: ChatScreenProps) {
  const [controller, setController] = useState<CharacterController | null>(null);
  const [settings, setSettings] = useState({ theme: "default", variant: "human" });
  const [conversation, setConversation] = useState<Message[]>([]);
  const [initialTaskState, setInitialTaskState] = useState<TaskState | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [taskState, setTaskState] = useState<TaskState>(EMPTY_TASK_STATE);

  const streamingTextRef = useRef("");
  const [streamingContent, setStreamingContent] = useState<string>("");

  // Load settings on mount
  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setSettings({ theme: s.theme ?? "default", variant: s.variant ?? "human" });
    });
    window.electronAPI.getConversation().then((conv) => {
      if (conv && conv.length > 0) {
        setConversation(conv);
      }
    });
    window.electronAPI
      .getTaskState()
      .then((state) => setInitialTaskState(state ?? EMPTY_TASK_STATE))
      .catch((error) => {
        console.error("Failed to load task state", error);
        setInitialTaskState(EMPTY_TASK_STATE);
      });
  }, []);

  // Subscribe to task state updates
  useEffect(() => {
    if (!controller) {
      return;
    }
    const taskController = controller.getTaskController();
    // Initialize with current state
    setTaskState(taskController.getState());

    const unsubscribe = taskController.onUpdate((state) => {
      setTaskState(state);
    });
    return unsubscribe;
  }, [controller]);

  // Auto-close task sheet when no tasks remain
  useEffect(() => {
    const hasNoTasks = taskState.tasks.length === 0;
    if (hasNoTasks && isTaskSheetOpen) {
      setIsTaskSheetOpen(false);
    }
  }, [taskState.tasks.length, isTaskSheetOpen]);

  // Set up streaming event listeners
  useEffect(() => {
    const unsubText = window.electronAPI.onStreamingText((text) => {
      streamingTextRef.current += text;
      setStreamingContent(streamingTextRef.current);
    });

    const unsubFunctionCall = window.electronAPI.onFunctionCall((name, args) => {
      if (controller) {
        executeFunctionCall(controller, name, args);
      }
    });

    const unsubStreamEnd = window.electronAPI.onStreamEnd(() => {
      setIsStreaming(false);
      setIsLoading(false);

      // Save the assistant's response to conversation
      if (streamingTextRef.current) {
        const assistantMessage: Message = {
          role: "assistant",
          content: streamingTextRef.current,
        };
        setConversation((prev) => {
          const updated = [...prev, assistantMessage];
          // Save to storage
          window.electronAPI.saveConversation(updated);
          return updated;
        });
      }
      // Speech bubble stays visible until next message
    });

    return () => {
      unsubText();
      unsubFunctionCall();
      unsubStreamEnd();
    };
  }, [controller]);

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    setController(ctrl);
    // Set initial greeting mood
    ctrl.setMood("smile", 0.5);
  }, []);

  const handleSendMessage = async (message: string) => {
    if (isLoading) return;

    // Add user message to conversation
    const userMessage: Message = { role: "user", content: message };
    const updatedConversation = [...conversation, userMessage];
    setConversation(updatedConversation);

    // Reset streaming state
    streamingTextRef.current = "";
    setStreamingContent("");
    setIsStreaming(true);
    setIsLoading(true);

    // Show thinking expression
    if (controller) {
      controller.setMood("thinking", 0.3);
    }

    // Send message to main process with updated history
    const result = await window.electronAPI.sendMessage(message, updatedConversation);

    if (!result.success) {
      setIsStreaming(false);
      setIsLoading(false);
      setStreamingContent("");
      if (controller) {
        controller.setMood("sad", 0.3);
      }
    }
  };

  const handleThemeChange = async (theme: string) => {
    setSettings((prev) => ({ ...prev, theme }));
    await window.electronAPI.setSettings({ theme });
  };

  const handleVariantChange = async (variant: string) => {
    setSettings((prev) => ({ ...prev, variant }));
    await window.electronAPI.setSettings({ variant });
  };

  const handleClearConversation = async () => {
    setConversation([]);
    setStreamingContent("");
    await window.electronAPI.clearConversation();
    setIsSettingsOpen(false);
    if (controller) {
      controller.setMood("smile", 0.3);
    }
  };

  const handleChangeApiKey = async () => {
    await window.electronAPI.clearApiKey();
    onLogout();
  };

  // Compute visible messages (last 2 from conversation + streaming if active)
  const visibleMessages = useMemo(() => {
    let messages = [...conversation];

    // Add streaming message if active
    if (isStreaming && streamingContent) {
      messages = [...messages, { role: "assistant" as const, content: streamingContent }];
    }

    // Get last 2 messages
    return messages.slice(-2);
  }, [conversation, isStreaming, streamingContent]);

  // Count active (non-done) tasks for the badge
  const activeTaskCount = useMemo(() => {
    return taskState.tasks.filter((t) => t.status !== "done").length;
  }, [taskState.tasks]);

  return (
    <div style={styles.container}>
      {/* Drag region for window */}
      <div style={styles.dragRegion} className="drag-region" />

      {/* Header */}
      <header style={styles.header}>
        <button
          onClick={() => setIsSettingsOpen(true)}
          style={styles.settingsButton}
          className="no-drag"
        >
          <SettingsIcon />
        </button>

        <div style={styles.status}>
          <span
            style={{
              ...styles.statusDot,
              backgroundColor: isLoading ? "var(--warning)" : "var(--success)",
            }}
          />
          <span style={styles.statusText}>
            {isLoading ? "Thinking..." : "Ready"}
          </span>
        </div>
      </header>

      {/* Character View - wait for initial state to load */}
      {initialTaskState !== null && (
        <CharacterView
          messages={visibleMessages}
          isStreaming={isStreaming}
          themeId={settings.theme}
          variantId={settings.variant}
          onControllerReady={handleControllerReady}
          initialTaskState={initialTaskState}
        />
      )}

      {/* Chat Input */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={isLoading}
        activeTaskCount={activeTaskCount}
        onTaskButtonClick={() => setIsTaskSheetOpen(true)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTheme={settings.theme}
        currentVariant={settings.variant}
        onThemeChange={handleThemeChange}
        onVariantChange={handleVariantChange}
        onClearConversation={handleClearConversation}
        onChangeApiKey={handleChangeApiKey}
      />

      {/* Task Sheet */}
      {controller && (
        <TaskSheet
          isOpen={isTaskSheetOpen}
          onClose={() => setIsTaskSheetOpen(false)}
          controller={controller.getTaskController()}
        />
      )}
    </div>
  );
}

// Execute MCP function calls on the CharacterController
function executeFunctionCall(
  controller: CharacterController,
  name: string,
  args: Record<string, unknown>
): void {
  try {
    switch (name) {
      // Expression tools
      case "setMood":
        controller.setMood(
          args.mood as FacialMood,
          args.duration as number | undefined
        );
        break;
      case "triggerAction":
        controller.triggerAction(
          args.action as "wink" | "talk" | "shake",
          args.duration as number | undefined
        );
        break;
      case "setHeadPose":
        controller.setHeadPose(
          {
            yaw: args.yawDegrees
              ? ((args.yawDegrees as number) * Math.PI) / 180
              : undefined,
            pitch: args.pitchDegrees
              ? ((args.pitchDegrees as number) * Math.PI) / 180
              : undefined,
          },
          args.duration as number | undefined
        );
        break;

      // Pomodoro tools
      case "startPomodoro":
        controller.startPomodoro(
          args.sessionDuration as PomodoroDuration | undefined,
          args.breakDuration as PomodoroDuration | undefined
        );
        break;
      case "pausePomodoro":
        controller.pausePomodoro();
        break;
      case "resetPomodoro":
        controller.resetPomodoro();
        break;

      // Task tools
      case "addTask":
        controller.addTask(
          args.text as string,
          args.status as "todo" | "in_progress" | "blocked" | "done" | undefined
        );
        break;
      case "updateTaskStatus":
        controller.updateTaskStatus(
          args.taskId as string,
          args.status as "todo" | "in_progress" | "blocked" | "done",
          args.blockedReason as string | undefined
        );
        break;
      case "setActiveTask":
        controller.setActiveTask(args.taskId as string);
        break;
      case "removeTask":
        controller.removeTask(args.taskId as string);
        break;
      case "completeActiveTask":
        controller.completeActiveTask();
        break;
      case "clearCompletedTasks":
        controller.clearCompletedTasks();
        break;
      case "clearAllTasks":
        controller.clearAllTasks();
        break;
      case "expandTasks":
        controller.expandTasks();
        break;
      case "collapseTasks":
        controller.collapseTasks();
        break;
      case "toggleTasks":
        controller.toggleTasks();
        break;

      default:
        console.warn(`Unknown function call: ${name}`);
    }
  } catch (error) {
    console.error(`Error executing function ${name}:`, error);
  }
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    background: "var(--bg-primary)",
    position: "relative",
  },
  dragRegion: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "32px",
    zIndex: 10,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    paddingTop: "40px", // Account for drag region on macOS
  },
  settingsButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    color: "var(--text-muted)",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    transition: "color var(--transition-fast), background var(--transition-fast)",
  },
  status: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    background: "var(--bg-glass)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
  statusText: {
    fontSize: "12px",
    fontWeight: "500",
    color: "var(--text-muted)",
  },
};
