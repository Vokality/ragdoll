import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ConversationBubbles } from "../src/components/conversation-bubbles.tsx";
import "../src/styles/global.css";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const check = (value, message) => {
  if (!value) throw new Error(message);
};
const settle = async () => {
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
};
const root = createRoot(document.getElementById("root"));
const messages = Array.from({ length: 30 }, (_, i) => ({
  id: `message-${i}`,
  role: "user",
  content: `Message ${i}: a conversation long enough to scroll.`,
}));
try {
  await act(async () =>
    root.render(
      React.createElement(ConversationBubbles, {
        messages,
        isStreaming: false,
      }),
    ),
  );
  await settle();
  const scroller = document.querySelector(".conversation-scroller");
  check(scroller.scrollHeight > scroller.clientHeight, "Fixture must overflow");
  check(
    !scroller.classList.contains("is-scrolling"),
    "Restoring chat reveals the scrollbar",
  );
  const retainedBubble = scroller.querySelectorAll(".bubble")[1];
  await act(async () =>
    root.render(
      React.createElement(ConversationBubbles, {
        messages: messages.slice(1),
        isStreaming: false,
      }),
    ),
  );
  check(
    scroller.querySelector(".bubble") === retainedBubble,
    "Trimming history remounted or reused the wrong message bubble",
  );
  await act(async () =>
    root.render(
      React.createElement(ConversationBubbles, {
        messages: [
          ...messages,
          { id: "new-message", role: "user", content: "New message" },
        ],
        isStreaming: false,
      }),
    ),
  );
  await settle();
  check(
    !scroller.classList.contains("is-scrolling"),
    "Following a new message reveals the scrollbar",
  );
  await act(async () => {
    scroller.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -100, bubbles: true }),
    );
    scroller.scrollTop = 0;
    scroller.dispatchEvent(new Event("scroll"));
  });
  check(
    scroller.classList.contains("is-scrolling"),
    "User scrolling does not reveal the scrollbar",
  );
  const idleDeadline = performance.now() + 3000;
  while (
    scroller.classList.contains("is-scrolling") &&
    performance.now() < idleDeadline
  ) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  }
  check(
    !scroller.classList.contains("is-scrolling"),
    "Idle scrollbar did not disappear",
  );
  await act(async () => {
    scroller.dispatchEvent(
      new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }),
    );
    scroller.scrollTop = 100;
    scroller.dispatchEvent(new Event("scroll"));
  });
  check(
    scroller.classList.contains("is-scrolling"),
    "Keyboard scrolling does not reveal the scrollbar",
  );
  await act(async () => root.unmount());
  document.getElementById("result").textContent =
    "PASS: automatic scrolling stays hidden, user scrolling reveals, idle hides, keyboard scrolling and timer cleanup";
} catch (error) {
  document.getElementById("result").textContent =
    `FAIL: ${error.stack ?? error}`;
}
