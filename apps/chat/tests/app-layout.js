import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ChatScreen } from "../src/screens/chat-screen.tsx";
import { SetupScreen } from "../src/screens/setup-screen.tsx";
import { LoadingScreen } from "../src/components/loading-screen.tsx";
import { createSlotState } from "@vokality/ragdoll-extensions/ui";
import "../src/styles/global.css";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const noop = () => {};
const unsub = () => noop;
const reportError = (e) => {
  throw e;
};
const store = (initial) => {
  let value = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => value,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set: (next) => {
      value = next;
      listeners.forEach((fn) => fn());
    },
  };
};
const messages = [
  {
    id: "app-layout-1",
    role: "user",
    content: "Help me plan a focused morning.",
  },
  {
    id: "app-layout-2",
    role: "assistant",
    content:
      "Start with the proposal, then take a short break.\n\n- Review the notes\n- Draft the outline\n- Send it when you’re ready",
  },
];
const chat = store({
  settings: { theme: "default", variant: "human" },
  visibleMessages: messages,
  isStreaming: false,
  isLoading: false,
  error: null,
});
Object.assign(chat, {
  start: async () => {},
  stop: noop,
  onFunctionCall: unsub,
  sendMessage: async () => ({ success: true }),
  stopStreaming: async () => {},
  changeTheme: async () => {},
  changeVariant: async () => {},
  clearConversation: async () => true,
});
const experience = store({
  profile: {
    name: "Sam",
    nameDeclined: false,
    longTermSummary: null,
    notes: [
      {
        id: crypto.randomUUID(),
        text: "Prefers quiet mornings",
        tier: "working",
        createdAt: 1,
        lastUsedAt: 1,
      },
    ],
    checkInsEnabled: true,
    revision: 0,
  },
  needsFirstAction: true,
  busy: false,
  error: null,
});
Object.assign(experience, {
  start: unsub,
  reactions: unsub,
  save: async () => {},
  cancel: async () => {},
  retry: async () => {},
});
const panels = [
  {
    type: "list",
    title: "Tasks",
    items: Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      label:
        i === 0
          ? "Review the architecture notes and prepare the implementation proposal"
          : "Morning task " + i,
      onToggle: noop,
      checked: false,
    })),
    actions: [{ id: "add", label: "Add task", onClick: noop }],
  },
  {
    type: "list",
    title: "Focus Timer",
    status: { label: "Ready to focus", tone: "default" },
    items: [{ id: "time", label: "25 min", sublabel: "Focus session" }],
    actions: [
      {
        id: "start",
        label: "Start Focus",
        variant: "primary",
        onClick: noop,
      },
    ],
  },
  {
    type: "grid",
    title: "Tic-Tac-Toe",
    columns: 3,
    cells: Array.from({ length: 9 }, (_, i) => ({
      id: String(i),
      label: i % 2 ? "X" : "O",
      onClick: noop,
    })),
    actions: [{ id: "new", label: "New game", onClick: noop }],
  },
  {
    type: "cards",
    title: "Spanish vocabulary",
    progress: { current: 2, total: 12, label: "Review" },
    card: {
      id: "card",
      attemptId: "one",
      front:
        "How would you ask a friend to join you for a walk tomorrow morning?",
      back: "¿Quieres dar un paseo mañana por la mañana?",
      face: "front",
    },
    answerInput: { id: "one" },
    onSubmitAnswer: noop,
    actions: [{ id: "end", label: "End", onClick: noop }],
  },
  {
    type: "canvas",
    title: "Canvas",
    document: {
      id: "drawing",
      revision: 1,
      title: "Morning sketch",
      width: 640,
      height: 480,
      background: "#dceaf3",
      elements: [],
    },
  },
  {
    type: "list",
    title: "Now playing",
    items: [
      {
        id: "track",
        label: "A long album title that should wrap neatly inside the player",
        sublabel: "Artist · Album",
      },
    ],
    actions: [
      { id: "prev", label: "Previous", onClick: noop },
      { id: "play", label: "Play", onClick: noop },
      { id: "next", label: "Next", onClick: noop },
    ],
  },
];
const labels = ["Tasks", "Timer", "Game", "Cards", "Canvas", "Music"];
const icons = ["checklist", "timer", "grid", "bookmark", "canvas", "music"];
const ids = [
  "tasks.main",
  "pomodoro.main",
  "game.main",
  "cards.main",
  "canvas.main",
  "music.main",
];
const slots = panels.map((panel, i) => ({
  id: ids[i],
  label: labels[i],
  icon: icons[i],
  priority: i,
  state: createSlotState({ visible: true, badge: null, panel }, reportError),
}));
const selection = store(null);
const extensionSlots = {
  subscribe: selection.subscribe,
  getSnapshot: () => slots,
  getActiveCardSnapshot: selection.getSnapshot,
  selectCard: async (id) => selection.set(id),
  start: async () => {},
  stop: noop,
};
const extensions = {
  loadOverview: async () => ({
    available: [],
    builtIn: [],
    configurable: [],
    disabled: [],
    installed: [],
  }),
};
const connections = {
  subscribe: unsub,
  getSnapshot: () => [],
  start: async () => {},
  stop: noop,
};
const root = createRoot(document.getElementById("root"));
const render = async (screen) =>
  act(async () =>
    root.render(
      screen === "setup"
        ? React.createElement(SetupScreen, {
            service: {
              configureApiKey: async () => ({
                success: false,
                error: "The key could not be verified. Check it and try again.",
              }),
              openApiKeyPage: async () => ({ success: true }),
            },
            onComplete: noop,
            reportError,
          })
        : screen === "loading"
          ? React.createElement(LoadingScreen)
          : React.createElement(ChatScreen, {
              chatService: chat,
              experience,
              characterCommands: { react: noop, execute: noop },
              extensionSlots,
              extensions,
              connections,
              onConfigureProvider: noop,
              reportError,
            }),
    ),
  );
const settle = async () => {
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
};
const check = (ok, msg) => {
  if (!ok) throw new Error(msg);
};
const bounds = (selector) =>
  document.querySelector(selector).getBoundingClientRect();
const inspect = () => {
  const header = bounds(".chat-header"),
    composer = bounds(".chat-input-form"),
    conversation = bounds(".conversation-scroller"),
    stage = bounds(".character-stage");
  check(
    conversation.height >= 99,
    "Conversation collapsed at compact size: " + conversation.height,
  );
  check(
    conversation.bottom <= composer.top + 1,
    "Conversation overlaps composer",
  );
  check(stage.bottom <= conversation.top + 1, "Card overlaps conversation");
  check(composer.bottom <= innerHeight + 1, "Composer clipped below window");
  check(header.height < 110, "Toolbar wraps and consumes conversation space");
  check(
    document.documentElement.scrollWidth <= innerWidth,
    "App overflows horizontally",
  );
  const panel = document.querySelector(".inline-slot-panel");
  if (panel) {
    const footer = panel.querySelector("footer");
    if (footer)
      check(
        footer.getBoundingClientRect().bottom <= stage.bottom + 1,
        "Panel footer clipped",
      );
  }
};
try {
  const preview = new URLSearchParams(location.search).get("preview");
  await render(preview ?? "chat");
  if (preview) {
    if (ids.includes(preview)) await act(async () => selection.set(preview));
    globalThis.layoutPreview = { chat, experience, selection, render };
  } else {
    await settle();
    inspect();
    const folder = document.querySelector(".extension-slot-folder");
    check(folder, "Cards folder missing from the compact dock");
    check(
      folder.getAttribute("aria-expanded") === "false",
      "Cards folder started expanded",
    );
    check(
      getComputedStyle(document.querySelector(".extension-slot-tray"))
        .visibility === "hidden",
      "Dock icons were visible while the folder was closed",
    );
    await act(async () =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: ",",
          code: "Comma",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    check(
      document.querySelector("dialog[open]")?.getAttribute("aria-label") ===
        "Settings",
      "Ctrl+, did not open settings",
    );
    await act(async () =>
      document.querySelector('[aria-label="Close Settings"]').click(),
    );
    check(
      !document.querySelector("dialog[open]"),
      "Settings stayed open after close",
    );
    for (const slot of slots) {
      await act(async () => selection.set(slot.id));
      await settle();
      inspect();
    }
    await act(async () => {
      chat.set({ ...chat.getSnapshot(), isLoading: true });
    });
    await settle();
    inspect();
    await act(async () =>
      chat.set({
        ...chat.getSnapshot(),
        error: "The connection could not be completed. ".repeat(12),
      }),
    );
    await settle();
    inspect();
    check(
      document.querySelector(".banner-error").clientHeight <= 96,
      "Long error consumes chat space",
    );
    await act(async () => chat.set({ ...chat.getSnapshot(), error: null }));
    const dock = document.querySelector(".extension-dock");
    const folderControl = document.querySelector(".extension-slot-folder");
    const visibleDockButtons = [
      folderControl,
      ...dock.querySelectorAll("button"),
    ].filter((button, index, buttons) => {
      if (!button || buttons.indexOf(button) !== index) return false;
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return (
        style.visibility !== "hidden" &&
        style.pointerEvents !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    check(visibleDockButtons.length >= 1, "Dock has no visible control");
    dock.scrollLeft = dock.scrollWidth;
    for (const control of [
      visibleDockButtons[0],
      visibleDockButtons.at(-1),
    ]) {
      control.focus();
      const rect = control.getBoundingClientRect();
      check(
        rect.left >= dock.getBoundingClientRect().left &&
          rect.right <= dock.getBoundingClientRect().right + 1,
        "Toolbar control unreachable by keyboard",
      );
    }
    await act(async () => {
      selection.set(null);
      chat.set({
        ...chat.getSnapshot(),
        isLoading: false,
        visibleMessages: [
          ...messages,
          {
            id: "app-layout-3",
            role: "assistant",
            content:
              "## A summary\n\n" +
              "Readable text. ".repeat(100) +
              "\n\n```typescript\nconst longLine = '" +
              "long".repeat(80) +
              "';\n```\n\n| Task | Status |\n|---|---|\n|Review|Ready|",
            sources: [
              {
                title: "A useful source with a long descriptive title",
                url: "https://example.com/reference",
                startIndex: 0,
                endIndex: 1,
              },
            ],
          },
        ],
      });
    });
    await settle();
    inspect();
    check(
      getComputedStyle(document.querySelector(".message-markdown"))
        .userSelect === "text",
      "Messages cannot be selected for copying",
    );
    const scroller = document.querySelector(".conversation-scroller");
    scroller.scrollTop = scroller.scrollHeight;
    scroller.dispatchEvent(new Event("scroll"));

    await act(async () => selection.set(ids[0]));
    await settle();
    check(
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 2,
      "Opening card loses latest reply",
    );
    document.getElementById("root").style.width = "340px";
    await settle();
    check(
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 2,
      "Narrower layout loses the latest reply",
    );
    document.getElementById("root").style.width = "100%";
    await settle();
    scroller.scrollTop = 0;
    scroller.dispatchEvent(new Event("scroll"));
    await act(async () => selection.set(null));
    await settle();
    check(
      scroller.scrollTop === 0,
      "Resizing steals position while reading history",
    );
    await act(async () => root.unmount());
    document.getElementById("result").textContent =
      "PASS: full compact chat, six cards, busy toolbar, markdown, copy selection, scroll ownership and composer reachability";
  }
} catch (error) {
  document.getElementById("result").textContent =
    `FAIL: ${error.stack ?? error}`;
}
