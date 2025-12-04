import { useState, useCallback, useEffect, useRef, useMemo, type CSSProperties } from "react";
import type { CharacterController, FacialMood } from "@vokality/ragdoll";
import {
  createSlotState,
  createSpotifyUISlot,
  SpotifyPanelComponent,
  type ExtensionUISlot,
  type ListPanelSection,
  type ItemStatus,
  type PanelAction,
  type SlotState,
  type SpotifySetupActions,
} from "@vokality/ragdoll-extensions";
import type { TaskState, PomodoroState } from "@vokality/ragdoll-extensions";
import { CharacterView } from "../components/character-view";
import { ChatInput } from "../components/chat-input";
import { SettingsModal } from "../components/settings-modal";
import { useSpotifyPlayback } from "../hooks/use-spotify-playback";
import { useChatApplication } from "../hooks/use-chat-application";

interface ChatScreenProps {
  onLogout: () => void;
}


const DEFAULT_TASK_SLOT_STATE: SlotState = {
  badge: null,
  visible: false,
  panel: {
    type: "list",
    title: "Tasks",
    emptyMessage: "No tasks yet",
    sections: [],
  },
};

const DEFAULT_POMODORO_SLOT_STATE: SlotState = {
  badge: null,
  visible: false,
  panel: {
    type: "list",
    title: "Focus Timer",
    items: [],
  },
};

interface PomodoroStateSnapshot {
  phase: string;
  remainingSeconds: number;
  isBreak: boolean;
  sessionsCompleted: number;
}

interface RendererTaskEvent {
  state: TaskState;
}

interface RendererPomodoroEvent {
  state: PomodoroState;
}

function useTaskSlot(): ExtensionUISlot {
  const slotRef = useRef<{
    slot: ExtensionUISlot;
    store: ReturnType<typeof createSlotState>;
  } | null>(null);

  if (!slotRef.current) {
    const store = createSlotState(DEFAULT_TASK_SLOT_STATE);
    slotRef.current = {
      store,
      slot: {
        id: "tasks.main",
        label: "Tasks",
        icon: "checklist",
        priority: 100,
        state: store,
      },
    };
  }

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getTaskState || !api.onTaskStateChanged) {
      return;
    }

    let isMounted = true;
    const store = slotRef.current!.store;

    const updateState = (state: TaskState | null) => {
      if (!isMounted) return;
      store.replaceState(mapTaskStateToSlotState(state));
    };

    api
      .getTaskState()
      .then((state) => updateState(state))
      .catch((error) => {
        console.error("[Chat] Failed to load task state", error);
      });

    const unsubscribe = api.onTaskStateChanged((event: RendererTaskEvent) => {
      updateState(event.state);
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  return slotRef.current!.slot;
}

function usePomodoroSlot(): ExtensionUISlot {
  const slotRef = useRef<{
    slot: ExtensionUISlot;
    store: ReturnType<typeof createSlotState>;
  } | null>(null);

  if (!slotRef.current) {
    const store = createSlotState(DEFAULT_POMODORO_SLOT_STATE);
    slotRef.current = {
      store,
      slot: {
        id: "pomodoro.main",
        label: "Timer",
        icon: "timer",
        priority: 90,
        state: store,
      },
    };
  }

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getPomodoroState || !api.onPomodoroStateChanged) {
      return;
    }

    let isMounted = true;
    const store = slotRef.current!.store;

    const updateState = (state: PomodoroState | PomodoroStateSnapshot | null) => {
      if (!isMounted) return;
      store.replaceState(mapPomodoroStateToSlotState(state));
    };

    api
      .getPomodoroState()
      .then((state: PomodoroStateSnapshot | null) => updateState(state))
      .catch((error: unknown) => {
        console.error("[Chat] Failed to load pomodoro state", error);
      });

    const unsubscribe = api.onPomodoroStateChanged((event: RendererPomodoroEvent) => {
      updateState(event.state);
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  return slotRef.current!.slot;
}

function mapTaskStateToSlotState(taskState: TaskState | null): SlotState {
  if (!taskState || taskState.tasks.length === 0) {
    return {
      badge: null,
      visible: false,
      panel: {
        type: "list",
        title: "Tasks",
        emptyMessage: "No tasks yet",
        sections: [],
      },
    };
  }

  const tasks = taskState.tasks;
  const activeTaskId = taskState.activeTaskId;

  const activeTasks = tasks.filter((task) => task.status !== "done");
  const completedTasks = tasks.filter((task) => task.status === "done");

  const runTool = (tool: string, args: Record<string, unknown> = {}) => () => {
    void executeExtensionTool(tool, args);
  };

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
          onToggle: runTool("updateTaskStatus", {
            taskId: task.id,
            status: isDone ? "todo" : "done",
          }),
          onClick: !isDone ? runTool("setActiveTask", { taskId: task.id }) : undefined,
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
        onToggle: runTool("updateTaskStatus", {
          taskId: task.id,
          status: "todo",
        }),
      })),
      collapsible: true,
      defaultCollapsed: activeTasks.length > 3,
      actions: [
        {
          id: "clear-completed",
          label: "Clear all",
          onClick: runTool("clearCompletedTasks"),
        },
      ],
    });
  }

  return {
    badge: activeTasks.length > 0 ? activeTasks.length : null,
    visible: tasks.length > 0,
    panel: {
      type: "list",
      title: "Tasks",
      emptyMessage: "No tasks yet",
      sections,
    },
  };
}

function mapPomodoroStateToSlotState(
  state: PomodoroState | PomodoroStateSnapshot | null
): SlotState {
  if (!state) {
    return {
      badge: null,
      visible: false,
      panel: {
        type: "list",
        title: "Focus Timer",
        items: [],
      },
    };
  }

  const isEventState = (value: any): value is PomodoroState =>
    value && typeof value.remainingMs === "number";

  const remainingSeconds = isEventState(state)
    ? Math.ceil(state.remainingMs / 1000)
    : Math.max(0, Math.ceil(state.remainingSeconds));

  const phase = state.phase ?? "idle";
  const isBreak = state.isBreak ?? false;
  const sessionsCompleted = state.sessionsCompleted ?? 0;

  const badge = phase === "running" || phase === "paused"
    ? formatTime(remainingSeconds)
    : null;

  const phaseLabel = isBreak
    ? phase === "running"
      ? "Break time"
      : "Break paused"
    : phase === "running"
      ? "Focus time"
      : phase === "paused"
        ? "Paused"
        : "Ready";

  const items: Array<{ id: string; label: string; sublabel?: string; status?: ItemStatus }> = [
    {
      id: "status",
      label: phaseLabel,
      sublabel: phase !== "idle" ? `${formatTime(remainingSeconds)} remaining` : undefined,
      status:
        phase === "running"
          ? isBreak
            ? "success"
            : "active"
          : phase === "paused"
            ? "warning"
            : "default",
    },
  ];

  if (sessionsCompleted > 0) {
    items.push({
      id: "sessions",
      label: `${sessionsCompleted} session${sessionsCompleted === 1 ? "" : "s"} completed`,
      status: "success",
    });
  }

  const actions: PanelAction[] = [];

  if (phase === "idle") {
    actions.push({
      id: "start",
      label: "Start Focus",
      variant: "primary",
      onClick: () => {
        void executeExtensionTool("startPomodoro");
      },
    });
  } else if (phase === "running") {
    actions.push({
      id: "pause",
      label: "Pause",
      variant: "secondary",
      onClick: () => {
        void executeExtensionTool("pausePomodoro");
      },
    });
    actions.push({
      id: "reset",
      label: "Reset",
      variant: "danger",
      onClick: () => {
        void executeExtensionTool("resetPomodoro");
      },
    });
  } else if (phase === "paused") {
    actions.push({
      id: "resume",
      label: "Resume",
      variant: "primary",
      onClick: () => {
        void executeExtensionTool("startPomodoro");
      },
    });
    actions.push({
      id: "reset",
      label: "Reset",
      variant: "danger",
      onClick: () => {
        void executeExtensionTool("resetPomodoro");
      },
    });
  }

  return {
    badge,
    visible: phase !== "idle",
    panel: {
      type: "list",
      title: isBreak ? "Break Time" : "Focus Timer",
      items,
      actions,
    },
  };
}

function formatTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

async function executeExtensionTool(
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<void> {
  if (!window.electronAPI?.executeExtensionTool) {
    console.warn(`[Extensions] executeExtensionTool unavailable for ${toolName}`);
    return;
  }

  try {
    const result = await window.electronAPI.executeExtensionTool(toolName, args);
    if (result && !result.success) {
      console.error(`[Extensions] Tool ${toolName} failed`, result.error);
    }
  } catch (error) {
    console.error(`[Extensions] Tool ${toolName} threw`, error);
  }
}

export function ChatScreen({ onLogout }: ChatScreenProps) {
  const [controller, setController] = useState<CharacterController | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const {
    settings,
    visibleMessages,
    isStreaming,
    isLoading,
    actions: { sendMessage: sendChatMessage, changeTheme, changeVariant, clearConversation, clearApiKey },
    subscribeToFunctionCalls,
  } = useChatApplication();

  const { state: spotifyState, controls: spotifyControls } = useSpotifyPlayback();

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

  const spotifySlotRef = useRef<{
    slot: ExtensionUISlot;
    stateStore: ReturnType<typeof createSpotifyUISlot>["stateStore"];
  } | null>(null);

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

  const playbackRef = useRef(spotifyState.playback);
  const spotifyTrackId = spotifyState.playback.track?.id ?? null;
  const spotifyIsPlaying = spotifyState.playback.isPlaying;
  const spotifyHasTrack = spotifyTrackId !== null;

  useEffect(() => {
    playbackRef.current = spotifyState.playback;
  }, [spotifyState.playback]);

  useEffect(() => {
    if (!spotifySlotRef.current) return;

    const { stateStore } = spotifySlotRef.current;
    const playbackSnapshot = playbackRef.current;

    const badge = spotifyHasTrack ? (spotifyIsPlaying ? "▶" : "❚❚") : null;
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
  ]);

  const spotifySlot = spotifySlotRef.current!.slot;
  const taskSlot = useTaskSlot();
  const pomodoroSlot = usePomodoroSlot();

  const slots = useMemo<ExtensionUISlot[]>(() => {
    return [taskSlot, pomodoroSlot, spotifySlot];
  }, [taskSlot, pomodoroSlot, spotifySlot]);

  useEffect(() => {
    if (!controller) return;
    return subscribeToFunctionCalls((name, args) => {
      executeFunctionCall(controller, name, args);
    });
  }, [controller, subscribeToFunctionCalls]);

  const handleControllerReady = useCallback((ctrl: CharacterController) => {
    setController(ctrl);
    ctrl.setMood("smile", 0.5);
  }, []);

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (isLoading) return;

      if (controller) {
        controller.setMood("thinking", 0.3);
      }

      const result = await sendChatMessage(message);

      if (!result.success && controller) {
        controller.setMood("sad", 0.3);
      }
    },
    [controller, isLoading, sendChatMessage]
  );

  const handleThemeChange = useCallback(
    async (theme: string) => {
      await changeTheme(theme);
    },
    [changeTheme]
  );

  const handleVariantChange = useCallback(
    async (variant: string) => {
      await changeVariant(variant);
    },
    [changeVariant]
  );

  const handleClearConversation = useCallback(async () => {
    await clearConversation();
    setIsSettingsOpen(false);
    if (controller) {
      controller.setMood("smile", 0.3);
    }
  }, [clearConversation, controller]);

  const handleChangeApiKey = useCallback(async () => {
    await clearApiKey();
    onLogout();
  }, [clearApiKey, onLogout]);

  return (
    <div style={styles.container}>
      <div style={styles.dragRegion} className="drag-region" />

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

      <CharacterView
        messages={visibleMessages}
        isStreaming={isStreaming}
        themeId={settings.theme}
        variantId={settings.variant}
        onControllerReady={handleControllerReady}
      />

      <ChatInput
        onSend={handleSendMessage}
        disabled={isLoading}
        slots={slots}
      />

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
      default:
        console.warn(`Renderer cannot handle function call: ${name}`);
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
