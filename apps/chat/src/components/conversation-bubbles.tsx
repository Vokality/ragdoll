import { MessageMarkdown } from "./message-markdown";
import { citedResponse } from "../../electron/electron-api";
import type { ChatMessage } from "../domain/chat";
import { SourcePills } from "./source-pills";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type UIEvent,
} from "react";
import { useSmoothText } from "../hooks/use-smooth-text";

interface ConversationBubblesProps {
  messages: ChatMessage[];
  isStreaming: boolean;
}

/** How close to the bottom (px) still counts as "following the stream". */
const PIN_THRESHOLD = 80;

export function ConversationBubbles({
  messages,
  isStreaming,
}: ConversationBubblesProps) {
  // Messages present on first render (a restored conversation) get a gentle
  // staggered entrance; everything after animates individually on arrival.
  const [initialCount] = useState(() => messages.length);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollbarVisible, setScrollbarVisible] = useState(false);
  const hideScrollbarRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollInputUntilRef = useRef(0);
  const markScrollInput = () => {
    scrollInputUntilRef.current = Date.now() + 1500;
  };
  const automaticScrollRef = useRef<number | null>(null);
  const followBottom = useCallback((container: HTMLDivElement) => {
    const bottom = Math.max(0, container.scrollHeight - container.clientHeight);
    if (container.scrollTop === bottom) return;
    automaticScrollRef.current = bottom;
    container.scrollTop = bottom;
  }, []);
  useEffect(
    () => () => {
      if (hideScrollbarRef.current !== null)
        clearTimeout(hideScrollbarRef.current);
    },
    [],
  );
  // Whether the user is at (or near) the bottom. Starts pinned.
  const pinnedRef = useRef(true);
  const viewportRef = useRef({ width: 0, height: 0 });

  const responses = useMemo(
    () =>
      messages.map((message) =>
        message.role === "assistant"
          ? citedResponse(message.content, message.sources)
          : { content: message.content },
      ),
    [messages],
  );
  const lastMessage = messages[messages.length - 1];
  const lastContent = lastMessage?.content ?? "";

  const { smoothedContent, isRevealing } = useAssistantReveal(
    lastMessage,
    responses.at(-1),
    isStreaming,
  );

  // Follow new content only while the user hasn't scrolled up to read;
  // their own new message always snaps the view back down.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (pinnedRef.current || lastMessage?.role === "user") {
      pinnedRef.current = true;
      followBottom(container);
    }
  }, [
    followBottom,
    messages.length,
    lastContent,
    smoothedContent,
    isStreaming,
    lastMessage?.role,
  ]);

  const hasConversation = messages.length > 0 || isStreaming;

  // Resizing the window or opening a card changes the viewport without a new
  // message. Keep the latest reply visible only while the reader is following it.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      viewportRef.current = {
        width: container.clientWidth,
        height: container.clientHeight,
      };
      if (pinnedRef.current) followBottom(container);
    });
    observer.observe(container);
    if (container.firstElementChild)
      observer.observe(container.firstElementChild);
    return () => observer.disconnect();
  }, [hasConversation, followBottom]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight, clientWidth } =
      event.currentTarget;
    // A layout-driven scroll can precede ResizeObserver. It is not the reader
    // asking to leave the bottom of the conversation.
    if (
      viewportRef.current.width !== clientWidth ||
      viewportRef.current.height !== clientHeight
    )
      return;
    pinnedRef.current = scrollHeight - scrollTop - clientHeight < PIN_THRESHOLD;
    const automatic =
      automaticScrollRef.current !== null &&
      Math.abs(scrollTop - automaticScrollRef.current) < 1;
    automaticScrollRef.current = null;
    if (automatic || Date.now() > scrollInputUntilRef.current) return;
    markScrollInput();
    setScrollbarVisible(true);
    if (hideScrollbarRef.current !== null)
      clearTimeout(hideScrollbarRef.current);
    hideScrollbarRef.current = setTimeout(
      () => setScrollbarVisible(false),
      1000,
    );
  };

  const awaitingReply =
    isStreaming && (!lastMessage || lastMessage.role === "user");

  if (messages.length === 0 && !awaitingReply) return null;

  return (
    <div
      ref={scrollRef}
      className={`conversation-scroller${scrollbarVisible ? " is-scrolling" : ""}`}
      onScroll={handleScroll}
      onWheel={markScrollInput}
      onTouchMove={markScrollInput}
      onPointerDown={markScrollInput}
      onPointerMove={(event) => {
        if (event.buttons === 1) markScrollInput();
      }}
      onKeyDown={(event) => {
        if (
          [
            "ArrowUp",
            "ArrowDown",
            "PageUp",
            "PageDown",
            "Home",
            "End",
            " ",
          ].includes(event.key)
        )
          markScrollInput();
      }}
      style={styles.scroller}
      aria-live="polite"
    >
      <div style={styles.list}>
        {messages.map((message, index) => {
          const response = responses[index];
          if (!response) return null;
          const isRevealTarget =
            index === messages.length - 1 && message.role === "assistant";
          const reveal = isRevealTarget && (isStreaming || isRevealing);
          const staggerDelay =
            index < initialCount ? `${Math.min(index * 60, 300)}ms` : undefined;

          return (
            <div
              key={message.id}
              className={`bubble ${
                message.role === "user" ? "bubble-user" : "bubble-assistant"
              }`}
              style={
                staggerDelay ? { animationDelay: staggerDelay } : undefined
              }
            >
              <MessageMarkdown
                content={reveal ? smoothedContent : response.content}
              />
              {message.role === "assistant" && (
                <SourcePills sources={response.sources ?? []} />
              )}
            </div>
          );
        })}

        {awaitingReply && (
          <div className="bubble bubble-assistant" aria-label="Lumen is typing">
            <span className="typing-dots">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Reveal state belongs to a message ID, including when the visible history window shifts. */
function useAssistantReveal(
  message: ChatMessage | undefined,
  response: ReturnType<typeof citedResponse> | undefined,
  streaming: boolean,
) {
  const assistant = message?.role === "assistant" ? message : null;
  const content = assistant ? (response?.content ?? "") : "";
  const smoothedContent = useSmoothText(
    content,
    assistant?.id ?? "",
    streaming && assistant !== null,
  );
  return {
    smoothedContent,
    isRevealing: assistant !== null && smoothedContent.length < content.length,
  };
}

const styles: Record<string, CSSProperties> = {
  scroller: {
    flex: 1,
    width: "100%",
    maxWidth: "var(--chat-content-width)",
    overflowY: "auto",
    marginTop: "8px",
    padding: "18px 0",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%",
  },
};
