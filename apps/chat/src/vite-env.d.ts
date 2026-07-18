/// <reference types="vite/client" />
import type { ElectronAPI } from "../electron/electron-api";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
