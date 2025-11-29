import type { FacialMood, FacialAction, SpeechBubbleState } from "@character/types";

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







