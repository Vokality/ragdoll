import type { FacialMood, FacialAction, SpeechBubbleState, PomodoroDuration, TaskStatus } from "@vokality/ragdoll";

/**
 * Messages sent from VS Code extension to webview
 */
export type ExtensionMessage =
  | {
      type: "setMood";
      mood: FacialMood;
      duration?: number;
    }
  | {
      type: "triggerAction";
      action: Exclude<FacialAction, "none">;
      duration?: number;
    }
  | {
      type: "clearAction";
    }
  | {
      type: "setHeadPose";
      yaw?: number;
      pitch?: number;
      duration?: number;
    }
  | {
      type: "setSpeechBubble";
      text: string | null;
      tone?: SpeechBubbleState["tone"];
    }
  | {
      type: "setTheme";
      themeId: string;
    }
  | {
      type: "startPomodoro";
      sessionDuration?: PomodoroDuration;
      breakDuration?: PomodoroDuration;
    }
  | {
      type: "pausePomodoro";
    }
  | {
      type: "resetPomodoro";
    }
  | {
      type: "addTask";
      text: string;
      status?: TaskStatus;
    }
  | {
      type: "updateTaskStatus";
      taskId: string;
      status: TaskStatus;
      blockedReason?: string;
    }
  | {
      type: "setActiveTask";
      taskId: string;
    }
  | {
      type: "removeTask";
      taskId: string;
    }
  | {
      type: "completeActiveTask";
    }
  | {
      type: "clearCompletedTasks";
    }
  | {
      type: "clearAllTasks";
    }
  | {
      type: "expandTasks";
    }
  | {
      type: "collapseTasks";
    }
  | {
      type: "toggleTasks";
    }
  | {
      type: "listTasks";
    }
  | {
      type: "getPomodoroState";
    };

/**
 * Task data structure
 */
export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  createdAt: number;
  blockedReason?: string;
}

/**
 * Messages sent from webview to VS Code extension
 */
export type WebviewMessage =
  | {
      type: "ready";
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "tasksUpdate";
      tasks: Task[];
    }
  | {
      type: "pomodoroStateUpdate";
      state: {
        state: string;
        remainingTime: number;
        isBreak: boolean;
        sessionDuration: number;
        breakDuration: number;
        elapsedTime: number;
      };
    };

/**
 * VS Code API interface provided to webviews
 */
export interface VSCodeAPI {
  postMessage(message: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  function acquireVsCodeApi(): VSCodeAPI;
}







