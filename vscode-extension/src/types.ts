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







