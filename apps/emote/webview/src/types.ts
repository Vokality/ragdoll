export type {
  BubbleTone,
  ExtensionMessage,
  WebviewMessage,
} from "../../src/types";
import type { WebviewMessage } from "../../src/types";

export interface VSCodeAPI {
  postMessage(message: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  function acquireVsCodeApi(): VSCodeAPI;
}
