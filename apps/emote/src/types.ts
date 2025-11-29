/**
 * Facial mood types
 */
export type FacialMood =
  | "neutral"
  | "smile"
  | "frown"
  | "laugh"
  | "angry"
  | "sad"
  | "surprise"
  | "confusion"
  | "thinking";

/**
 * Facial action types
 */
export type FacialAction = "none" | "wink" | "talk";

/**
 * Speech bubble tone
 */
export type BubbleTone = "default" | "whisper" | "shout";

/**
 * Pomodoro duration options (in minutes)
 */
export type PomodoroDuration = 5 | 15 | 30 | 60 | 120;

/**
 * Task status types
 */
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

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
      tone?: BubbleTone;
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
    };

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
    };







