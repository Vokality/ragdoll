import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useSmoothText } from "../src/hooks/use-smooth-text.ts";
const originalRequest = window.requestAnimationFrame;
const originalCancel = window.cancelAnimationFrame;
const originalNow = Object.getOwnPropertyDescriptor(performance, "now");
Object.defineProperty(performance, "now", {
  configurable: true,
  value: () => 0,
});
const callbacks = new Map();
let nextId = 0;
window.requestAnimationFrame = (callback) => {
  callbacks.set(++nextId, callback);
  return nextId;
};
window.cancelAnimationFrame = (id) => callbacks.delete(id);
const root = createRoot(document.getElementById("root"));
function Sample({ id }) {
  const text = useSmoothText(
    "A short streaming reply for comparison.",
    "reply",
    true,
  );
  return React.createElement("output", { id }, text);
}
try {
  flushSync(() =>
    root.render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          StrictMode,
          null,
          React.createElement(Sample, { id: "strict" }),
        ),
        React.createElement(Sample, { id: "normal" }),
      ),
    ),
  );
  const start = performance.now();
  for (let frame = 1; frame <= 90; frame++) {
    const pending = [...callbacks.values()];
    callbacks.clear();
    flushSync(() => {
      for (const callback of pending) callback(start + (frame * 1000) / 60);
    });
    if (
      document.getElementById("strict").textContent !==
      document.getElementById("normal").textContent
    ) {
      throw new Error(`Strict Mode diverged at frame ${frame}`);
    }
  }
  if (!document.getElementById("strict").textContent.endsWith("comparison."))
    throw new Error("Reveal did not finish");
  document.getElementById("result").textContent =
    "PASS: Strict Mode and normal reveal match across 90 frames";
} catch (error) {
  document.getElementById("result").textContent = `FAIL: ${error.message}`;
  throw error;
} finally {
  root.unmount();
  window.requestAnimationFrame = originalRequest;
  window.cancelAnimationFrame = originalCancel;
  if (originalNow) Object.defineProperty(performance, "now", originalNow);
  else delete performance.now;
}
