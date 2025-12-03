export const chatUiTheme = {
  bubble: {
    text: "#ffffff",
    border: "#5a9bc4",
    assistantBackground: "#000000",
    userBackground: "#6bb3dc",
  },
  speech: {
    text: "#f1f5f9",
    border: "rgba(148, 163, 184, 0.3)",
    background: "rgba(0, 0, 0, 0.65)",
  },
  text: {
    primary: "#f1f5f9",
    muted: "#94a3b8",
  },
  surfaces: {
    glass: "rgba(0, 0, 0, 0.65)",
    border: "rgba(148, 163, 184, 0.3)",
  },
  accent: {
    primary: "#5a9bc4",
    success: "#4ade80",
    warning: "#f87171",
  },
} as const;

export type ChatUiTheme = typeof chatUiTheme;
