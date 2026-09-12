import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  InlineSlotPanel,
  SlotButtonStateless,
} from "@vokality/ragdoll-extensions/ui";
import {
  createRegistry,
  serializeSlotState,
  serializeCanvasSvg,
} from "@vokality/ragdoll-extensions";
import { createExtension } from "@vokality/ragdoll-extension-canvas";
import "../src/styles/global.css";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById("root"));
const registry = createRegistry({
  now: Date.now,
  onListenerError: (error) => {
    throw error;
  },
});
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
try {
  await registry.register(createExtension(), {
    host: {
      capabilities: new Set(["storage", "logger"]),
      storage: {
        read: async () => undefined,
        write: async () => {},
        delete: async () => {},
        list: async () => [],
      },
      logger: { debug() {}, info() {}, warn() {}, error() {} },
    },
  });
  const slot = registry.getSlot("canvas.main").slot;
  await act(async () =>
    root.render(
      React.createElement(SlotButtonStateless, {
        icon: "canvas",
        label: "Canvas",
      }),
    ),
  );
  check(
    document.querySelector('button[aria-label="Canvas"] svg path'),
    "Canvas toolbar icon is missing",
  );
  await registry.executeTool("canvas_draw", {
    expectedRevision: 0,
    removeIds: [],
    elements: [
      {
        id: "box",
        type: "rect",
        x: 40,
        y: 80,
        width: 180,
        height: 140,
        radius: 20,
        fill: "#0891b2",
        stroke: "none",
        strokeWidth: 0,
        opacity: 1,
      },
      {
        id: "sun",
        type: "ellipse",
        cx: 460,
        cy: 150,
        rx: 60,
        ry: 60,
        fill: "#f59e0b",
        stroke: "none",
        strokeWidth: 0,
        opacity: 1,
      },
      {
        id: "arrow",
        type: "path",
        d: "M240 150 L370 150 M355 135 L370 150 L355 165",
        fill: "none",
        stroke: "#334155",
        strokeWidth: 5,
        opacity: 1,
      },
      {
        id: "text",
        type: "text",
        x: 320,
        y: 320,
        text: "Draw something together",
        fontSize: 28,
        anchor: "middle",
        fill: "#334155",
        stroke: "none",
        strokeWidth: 0,
        opacity: 1,
      },
    ],
  });
  for (const width of [360, 440]) {
    await act(async () =>
      root.render(
        React.createElement(
          "div",
          {
            style: {
              width,
              height: 300,
              display: "flex",
              flexDirection: "column",
            },
          },
          React.createElement(InlineSlotPanel, {
            slot,
            onClose: () => {},
          }),
        ),
      ),
    );
    const svg = document.querySelector(".slot-panel-canvas svg");
    check(
      svg.getAttribute("viewBox") === "0 0 640 400",
      "Missing document coordinates",
    );
    check(
      svg.querySelectorAll("text").length === 1 &&
        svg.querySelectorAll("path").length === 1,
      "Missing drawing elements",
    );
    const bounds = svg.getBoundingClientRect();
    const header = document.querySelector("header").getBoundingClientRect();
    const footer = document.querySelector("footer").getBoundingClientRect();
    check(
      bounds.height > 100 &&
        bounds.top >= header.bottom &&
        bounds.bottom <= footer.top + 1,
      "Canvas overlaps card controls",
    );
    check(bounds.width <= width, "Canvas exceeds card width");
    const exported = serializeCanvasSvg(slot.state.getState().panel.document);
    const parsed = new DOMParser().parseFromString(exported, "image/svg+xml");
    check(
      !parsed.querySelector("parsererror") &&
        parsed.querySelector("text").textContent === "Draw something together",
      "SVG export is invalid",
    );
  }
  const serialized = structuredClone(serializeSlotState(slot.state.getState()));
  check(
    serialized.panel.document.elements.length === 4,
    "Drawing lost across IPC",
  );
  await act(async () =>
    [...document.querySelectorAll("footer button")]
      .find((button) => button.textContent === "Clear")
      .click(),
  );
  check(
    document.querySelectorAll(".slot-panel-canvas text").length === 0,
    "Clear did not update canvas",
  );
  await act(async () =>
    [...document.querySelectorAll("footer button")]
      .find((button) => button.textContent === "Undo")
      .click(),
  );
  check(
    document.querySelectorAll(".slot-panel-canvas text").length === 1,
    "Undo did not restore drawing",
  );
  await act(async () => root.unmount());
  await registry.destroy();
  document.getElementById("result").textContent =
    "PASS: canvas geometry, drawing tools, SVG export, serialization, clear and undo at compact card sizes";
} catch (error) {
  document.getElementById("result").textContent = "FAIL: " + error.stack;
}
