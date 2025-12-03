import { useState, useCallback, useEffect, useRef, useMemo, type CSSProperties } from "react";
import type { CharacterController, FacialMood, PomodoroDuration, TaskState, TaskController, PomodoroController } from "@vokality/ragdoll";
import {
  createDerivedSlotState,
  createSpotifyUISlot,
  SpotifyPanelComponent,
  type ExtensionUISlot,
  type ListPanelSection,
  type ItemStatus,
  type PanelAction,
  type SpotifySetupActions,
} from "@vokality/ragdoll-extensions";
import { CharacterView } from "../components/character-view";
import { ChatInput } from "../components/chat-input";
import { SettingsModal } from "../components/settings-modal";
import { useSpotifyPlayback } from "../hooks/use-spotify-playback";

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

/**
 * Create a task UI slot from a CharacterController's TaskController
 */
function createTaskSlotFromController(taskController: TaskController): ExtensionUISlot {
  const state = createDerivedSlotState({
    getSourceState: () => taskController.getState(),
    subscribeToSource: (callback) => taskController.onUpdate(() => callback()),
    deriveState: (taskState) => {
      const { tasks, activeTaskId } = taskState;

      const activeTasks = tasks.filter((t) => t.status !== "done");
      const completedTasks = tasks.filter((t) => t.status === "done");

      const badge = activeTasks.length > 0 ? activeTasks.length : null;
      const visible = tasks.length > 0;

      const sections: ListPanelSection[] = [];

      if (activeTasks.length > 0) {
        sections.push({
          id: "active",
          title: "Active",
          items: activeTasks.map((task) => {
            const isDone = task.status === "done";
            const isActive = task.id === activeTaskId;

            let status: ItemStatus = "default";
            if (isActive) status = "active";
            else if (task.status === "blocked") status = "error";
            else if (task.status === "in_progress") status = "active";

            return {
              id: task.id,
              label: task.text,
              sublabel: task.blockedReason,
              status,
              checkable: true,
              checked: isDone,
              onToggle: () => {
                if (isDone) {
                  taskController.updateTaskStatus(task.id, "todo");
                } else {
                  taskController.updateTaskStatus(task.id, "done");
                }
              },
              onClick: !isDone
                ? () => taskController.setActiveTask(task.id)
                : undefined,
            };
          }),
        });
      }

      if (completedTasks.length > 0) {
        sections.push({
          id: "completed",
          title: "Completed",
          items: completedTasks.map((task) => ({
            id: task.id,
            label: task.text,
            status: "success" as ItemStatus,
            checkable: true,
            checked: true,
            onToggle: () => taskController.updateTaskStatus(task.id, "todo"),
          })),
          collapsible: true,
          defaultCollapsed: activeTasks.length > 3,
          actions: [
            {
              id: "clear-completed",
              label: "Clear all",
              onClick: () => taskController.clearCompleted(),
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
    },
  });

  return {
    id: "tasks.main",
    label: "Tasks",
    icon: "checklist",
    priority: 100,
    state,
  };
}

/**
 * Create a pomodoro UI slot from a CharacterController's PomodoroController
 */
function createPomodoroSlotFromController(pomodoroController: PomodoroController): ExtensionUISlot {
  const formatTime = (seconds: number): string => {
    const totalSeconds = Math.ceil(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const state = createDerivedSlotState({
    getSourceState: () => pomodoroController.getState(),
    subscribeToSource: (callback) => pomodoroController.onUpdate(() => callback()),
    deriveState: (pomodoroState) => {
      const { state: phase, remainingTime, isBreak } = pomodoroState;

      // Badge shows time remaining when active
      const badge = phase === "running" || phase === "paused"
        ? formatTime(remainingTime)
        : null;

      // Only visible when timer is active
      const visible = phase !== "idle";

      // Build panel items
      const items: Array<{
        id: string;
        label: string;
        sublabel?: string;
        status?: ItemStatus;
      }> = [];

      // Current status item
      const phaseLabel = isBreak
        ? (phase === "running" ? "Break time" : "Break paused")
        : (phase === "running" ? "Focus time" : phase === "paused" ? "Paused" : "Ready");

      items.push({
        id: "status",
        label: phaseLabel,
        sublabel: phase !== "idle" ? `${formatTime(remainingTime)} remaining` : undefined,
        status: phase === "running" ? (isBreak ? "success" : "active") : phase === "paused" ? "warning" : "default",
      });

      // Build actions based on state
      const actions: PanelAction[] = [];

      if (phase === "idle") {
        actions.push({
          id: "start",
          label: "Start Focus",
          variant: "primary",
          onClick: () => pomodoroController.start(),
        });
      } else if (phase === "running") {
        actions.push({
          id: "pause",
          label: "Pause",
          variant: "secondary",
          onClick: () => pomodoroController.pause(),
        });
        actions.push({
          id: "reset",
          label: "Reset",
          variant: "danger",
          onClick: () => pomodoroController.reset(),
        });
      } else if (phase === "paused") {
        actions.push({
          id: "resume",
          label: "Resume",
          variant: "primary",
          onClick: () => pomodoroController.start(),
        });
        actions.push({
          id: "reset",
          label: "Reset",
          variant: "danger",
          onClick: () => pomodoroController.reset(),
        });
      }

      return {
        badge,
        visible,
        panel: {
          type: "list" as const,
          title: isBreak ? "Break Time" : "Focus Timer",
          items,
          actions,
        },
      };
    },
  });

  return {
    id: "pomodoro.main",
    label: "Timer",
    icon: "timer",
    priority: 90,
    state,
  };
}

export function ChatScreen({ onLogout }: ChatScreenProps) {
  const [controller, setController] = useState<CharacterController | null>(null);
  const [settings, setSettings] = useState({ theme: "default", variant: "human" });
  const [conversation, setConversation] = useState<Message[]>([]);
  const [initialTaskState, setInitialTaskState] = useState<TaskState | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const streamingTextRef = useRef("");
  const [streamingContent, setStreamingContent] = useState<string>("");

  // Spotify Web Playback SDK integration
  const { state: spotifyState, controls: spotifyControls } = useSpotifyPlayback();

  // Setup actions for Spotify extension UI
  const spotifySetupActions = useMemo<SpotifySetupActions>(() => ({
    getClientId: () => window.electronAPI.spotifyGetClientId(),
    saveClientId: async (clientId: string) => {
      await window.electronAPI.spotifySetClientId(clientId);
      window.location.reload();
    },
    isEnabled: () => window.electronAPI.spotifyIsEnabled(),
    isAuthenticated: () => window.electronAPI.spotifyIsAuthenticated(),
    getAuthUrl: () => window.electronAPI.spotifyGetAuthUrl(),
    disconnect: async () => {
      await window.electronAPI.spotifyDisconnect();
      window.location.reload();
    },
    getPlaybackState: () => window.electronAPI.spotifyGetPlaybackState(),
  }), []);

  // Create Spotify slot ONCE (stable reference) - state updates handled via useEffect
  const spotifySlotRef = useRef<{
    slot: ExtensionUISlot;
    stateStore: ReturnType<typeof createSpotifyUISlot>["stateStore"];
  } | null>(null);

  // Initialize slot on first render
  if (!spotifySlotRef.current) {
    const { slot, stateStore } = createSpotifyUISlot({
      controls: spotifyControls,
      setupActions: spotifySetupActions,
      playback: spotifyState.playback,
      hasConnected: spotifyState.hasConnected,
      error: spotifyState.error,
    });
    spotifySlotRef.current = { slot, stateStore };
  }

  const spotifyTrackId = spotifyState.playback.track?.id ?? null;
  const spotifyIsPlaying = spotifyState.playback.isPlaying;
  const spotifyHasTrack = spotifyTrackId !== null;
  const playbackSnapshot = useMemo(
    () => spotifyState.playback,
    [spotifyTrackId, spotifyIsPlaying],
  );

  // Update slot state only when connection or track/play state meaningfully changes
  useEffect(() => {
    if (!spotifySlotRef.current) return;

    const { stateStore } = spotifySlotRef.current;

    // Badge shows play state indicator
    const badge = spotifyHasTrack ? (spotifyIsPlaying ? "▶" : "❚❚") : null;

    // Visibility: always show until connected, then only when playing
    const visible = !spotifyState.hasConnected || spotifyHasTrack;

    stateStore.setState({
      badge,
      visible,
      panel: {
        type: "custom" as const,
        title: "Spotify",
        component: ({ onClose }) => (
          <SpotifyPanelComponent
            onClose={onClose}
            controls={spotifyControls}
            setupActions={spotifySetupActions}
            playback={playbackSnapshot}
            error={spotifyState.error}
          />
        ),
      },
    });
  }, [
    spotifyHasTrack,
    spotifyIsPlaying,
    spotifyState.hasConnected,
    spotifyState.error,
    spotifyControls,
    spotifySetupActions,
    playbackSnapshot,
  ]);

  const spotifySlot = spotifySlotRef.current!.slot;

  // Create extension UI slots when controller is ready
  const slots = useMemo<ExtensionUISlot[]>(() => {
    const result: ExtensionUISlot[] = [];

    if (controller) {
      result.push(createTaskSlotFromController(controller.getTaskController()));
      result.push(createPomodoroSlotFromController(controller.getPomodoroController()));
    }

    // Always include Spotify slot
    result.push(spotifySlot);

    return result;
  }, [controller, spotifySlot]);

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

      {/* Chat Input with extension slots */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={isLoading}
        slots={slots}
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

      // Query-only tools (handled by main process, no UI action needed)
      case "listTasks":
      case "getPomodoroState":
        // No-op: these return data to the AI, no renderer action needed
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
