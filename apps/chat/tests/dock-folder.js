import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { SlotBar, createSlotState } from "@vokality/ragdoll-extensions/ui";
import "../src/styles/global.css";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById("root"));
const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
const reportError = (error) => {
  throw error;
};
const makeSlot = (id, label, icon, badge, priority) => ({
  id,
  label,
  icon,
  priority,
  state: createSlotState(
    {
      visible: true,
      badge,
      panel: { type: "list", title: label, items: [] },
    },
    reportError,
  ),
});
const slots = [
  makeSlot("tasks.main", "Tasks", "checklist", 3, 6),
  makeSlot("list.main", "Working list", "list", 2, 5),
  makeSlot("timer.main", "Timer", "timer", null, 4),
  makeSlot("notes.main", "Notes", "notebook", 0, 3),
  makeSlot("cards.main", "Flash Cards", "cards", null, 2),
  makeSlot("game.main", "Tic-Tac-Toe", "game", null, 1),
  makeSlot("canvas.main", "Canvas", "canvas", null, 0),
];
const dockOpen = () =>
  document.querySelector(".extension-slot-dock").getAttribute("data-open") ===
  "true";
try {
  await act(async () => root.render(React.createElement(SlotBar, { slots })));
  const folder = document.querySelector(".extension-slot-folder");
  const tasks = document.querySelector('[aria-label="Tasks"]');
  check(folder, "Cards folder missing");
  check(
    folder.getAttribute("aria-expanded") === "false" && !dockOpen(),
    "Folder started open",
  );
  check(folder.textContent.includes("5"), "Folder missed combined badge");
  check(tasks, "Slot buttons were not kept in the document");
  const icons = [...document.querySelectorAll(".extension-slot-button svg")];
  check(icons.length === slots.length, "A card is missing its icon");
  check(
    new Set(icons.map((icon) => icon.innerHTML)).size === slots.length,
    "Two cards share the same icon artwork",
  );
  check(
    icons.every((icon) => icon.getAttribute("aria-hidden") === "true"),
    "Decorative icons duplicate the accessible button names",
  );
  check(
    getComputedStyle(document.querySelector(".extension-slot-tray"))
      .visibility === "hidden",
    "Dock icons were visible while stacked",
  );
  check(
    folder.getBoundingClientRect().width > 0 &&
      folder.getBoundingClientRect().right <= 401,
    "Folder overflowed compact width",
  );
  await act(async () =>
    document.querySelector(".extension-slot-folder").click(),
  );
  check(
    document
      .querySelector(".extension-slot-folder")
      .getAttribute("aria-expanded") === "true" && dockOpen(),
    "Clicking the folder did not expand the icons",
  );
  const backdrop = document.querySelector(".extension-slot-folder-backdrop");
  check(
    backdrop.parentElement === document.body,
    "Folder dim overlay was not attached to the window",
  );
  check(
    getComputedStyle(backdrop).display !== "none",
    "Folder dim overlay stayed hidden after expand",
  );
  const covered = document.elementFromPoint(
    Math.min(200, window.innerWidth / 2),
    Math.min(360, window.innerHeight / 2),
  );
  check(
    covered === backdrop || backdrop.contains(covered),
    "Folder dim overlay did not cover the window",
  );
  check(
    document.documentElement.scrollWidth <=
      document.documentElement.clientWidth + 1,
    "Expanded folder overflowed the window",
  );
  await act(async () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  check(
    document
      .querySelector(".extension-slot-folder")
      .getAttribute("aria-expanded") === "false" && !dockOpen(),
    "Escape did not collapse the folder",
  );
  await act(async () =>
    document.querySelector(".extension-slot-folder").click(),
  );
  await act(async () =>
    document.querySelector(".extension-slot-folder-backdrop").click(),
  );
  check(
    document
      .querySelector(".extension-slot-folder")
      .getAttribute("aria-expanded") === "false",
    "Backdrop did not collapse the folder",
  );
  await act(async () =>
    document.querySelector(".extension-slot-folder").click(),
  );
  await act(async () => tasks.click());
  check(
    folder.getAttribute("aria-expanded") === "false",
    "Choosing a card left the folder open",
  );
  check(
    tasks.getAttribute("aria-pressed") === "true",
    "Choosing a card did not select it",
  );
  await act(async () =>
    root.render(React.createElement(SlotBar, { slots: slots.slice(0, 1) })),
  );
  check(
    !document.querySelector(".extension-slot-folder") &&
      getComputedStyle(document.querySelector('[aria-label="Tasks"]'))
        .visibility !== "hidden",
    "A single card still used a folder",
  );
  await act(async () => root.unmount());
  document.getElementById("result").textContent =
    "PASS: stacked Cards folder expands, collapses, and keeps a compact header";
} catch (error) {
  document.getElementById("result").textContent =
    `FAIL: ${error.stack ?? error}`;
  throw error;
}
