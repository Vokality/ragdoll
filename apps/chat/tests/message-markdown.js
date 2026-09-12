import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ConversationBubbles } from "../src/components/conversation-bubbles.tsx";
import "../src/styles/global.css";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById("root"));
const check = (value, message) => {
  if (!value) throw new Error(message);
};
// Flush React between polls; one long act batches animation updates until it ends.
const waitFor = async (predicate, message) => {
  const deadline = performance.now() + 10000;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error(message);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  }
};
const content =
  '# Heading\n\n**Bold** and *italic*, ~~removed~~ and `code`.\n\n- first\n- second\n\n1. ordered\n2. list\n\n> quote\n\n- [x] done\n- [ ] next\n\n| Name | Value |\n| --- | --- |\n| Row | Cell |\n\n```js\nconst veryLongName = "' +
  "x".repeat(150) +
  '";\n// [literal](https://example.com)\n```';
const render = (messages, isStreaming = false) =>
  act(async () =>
    root.render(
      React.createElement(ConversationBubbles, { messages, isStreaming }),
    ),
  );
try {
  await render([
    { id: "user-message", role: "user", content },
    {
      id: "assistant-message",
      role: "assistant",
      content,
      sources: [{ title: "Source", url: "https://example.com" }],
    },
  ]);
  for (const role of ["user", "assistant"]) {
    const bubble = document.querySelector(`.bubble-${role}`);
    for (const selector of [
      "h1",
      "strong",
      "em",
      "del",
      "code",
      "ul",
      "ol",
      "blockquote",
      "table",
      "input:checked",
      "pre",
    ])
      check(bubble.querySelector(selector), `${role} missing ${selector}`);
    check(
      bubble
        .querySelector("pre")
        .textContent.includes("[literal](https://example.com)"),
      "Citation processing damaged code",
    );
    check(
      bubble.querySelector("pre").scrollWidth >
        bubble.querySelector("pre").clientWidth,
      "Long code does not scroll",
    );
    check(
      bubble.getBoundingClientRect().width <= 320,
      "Bubble overflowed narrow chat",
    );
  }
  check(
    document.querySelector(".source-pills") &&
      !document.querySelector(".message-markdown .source-pills"),
    "Sources moved inside Markdown",
  );
  const hostile =
    "[safe](https://example.com) [unsafe](javascript:alert%281%29) [local](file:///etc/passwd) [relative](/settings)\n\n<img src=x onerror=alert(1)>\n\n![image](https://example.com/pixel.png)";
  await render([{ id: "user-message", role: "user", content: hostile }]);
  check(
    document.querySelector('a[href="https://example.com/"]')?.target ===
      "_blank",
    "Safe link is not external",
  );
  check(
    !document.querySelector(
      'a[href^="javascript:"],a[href^="file:"],a[href^="/"],img,script:not([type="module"])',
    ),
    "Untrusted markup created unsafe content",
  );
  await render(
    [
      {
        id: "assistant-message",
        role: "assistant",
        content: "**Streamed**\n\n```js\nconst x = 1;\n```\n\nComplete.",
      },
    ],
    true,
  );
  await waitFor(
    () =>
      document.querySelector(".bubble-assistant strong")?.textContent ===
      "Streamed",
    "Live text is not Markdown",
  );
  check(
    !document
      .querySelector(".bubble-assistant p:last-child")
      ?.textContent.includes("Complete."),
    "Stream should still be revealing before it closes",
  );
  await render(
    [
      {
        id: "assistant-message",
        role: "assistant",
        content: "**Streamed**\n\n```js\nconst x = 1;\n```\n\nComplete.",
      },
    ],
    false,
  );
  await waitFor(
    () =>
      document
        .querySelector(".bubble-assistant pre")
        ?.textContent.includes("const x = 1") &&
      document.querySelector(".bubble-assistant p:last-child")?.textContent ===
        "Complete.",
    "Final code block or completed reveal missing",
  );
  const completionCases = [
    ["short reply", "Done."],
    [
      "wrapped prose",
      "A reply long enough to wrap across several lines in a narrow conversation bubble. ".repeat(3),
    ],
    ["list", "- first item\n- second item"],
    ["code block", "```js\nconst x = 1;\n```"],
    ["table", "| Name | Value |\n| --- | --- |\n| Row | Cell |"],
  ];
  for (const width of [220, 380]) {
    document.getElementById("root").style.width = `${width}px`;
    for (const [label, text] of completionCases) {
      const messages = [
        {
          id: `${width}-${label}`,
          role: "assistant",
          content: text,
          sources:
            label === "wrapped prose"
              ? [{ title: "Source", url: "https://example.com" }]
              : [],
        },
      ];
      // Start fully revealed to isolate completion from incoming text growth.
      await render(messages);
      await render(messages, true);
      const bubble = document.querySelector(".bubble-assistant");
      const streamingSize = {
        width: bubble.offsetWidth,
        height: bubble.offsetHeight,
      };
      const streamingMarkdown =
        bubble.querySelector(".message-markdown").innerHTML;
      await render(messages, false);
      check(
        bubble === document.querySelector(".bubble-assistant"),
        "Completion remounted the bubble",
      );
      check(
        streamingMarkdown === bubble.querySelector(".message-markdown").innerHTML,
        "Completion changed the message text",
      );
      check(
        bubble.offsetWidth === streamingSize.width &&
          bubble.offsetHeight === streamingSize.height,
        `${label} at ${width}px changed size on completion: ${streamingSize.width}x${streamingSize.height} -> ${bubble.offsetWidth}x${bubble.offsetHeight}`,
      );
    }
  }
  await act(async () => root.unmount());
  document.getElementById("result").textContent =
    "PASS: both roles, GFM, safe links, literal code, citations, narrow overflow, streamed Markdown and stable bubble size on completion";
} catch (error) {
  document.getElementById("result").textContent =
    `FAIL: ${error.stack ?? error}`;
}
