import { MessageMarkdown } from "./message-markdown";
import {
  citedResponse,
  type SourceCitation,
} from "../../electron/electron-api";
import { SourcePills } from "./source-pills";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type UIEvent,
} from "react";
import { useSmoothText } from "../hooks/use-smooth-text";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: SourceCitation[];
}

interface ConversationBubblesProps {
  messages: Message[];
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
  // Whether the user is at (or near) the bottom. Starts pinned.
  const pinnedRef = useRef(true);

  const responses = useMemo(
    () =>
      messages.map((message) =>
        message.role === "assistant"
          ? citedResponse(message.content, message.sources)
          : { content: message.content },
      ),
    [messages],
  );
  const lastResponse = responses.at(-1);
  const lastMessage = messages[messages.length - 1];
  const lastContent = lastMessage?.content ?? "";

  // Reveal the newest assistant reply at a steady pace instead of
  // network-paced bursts; it keeps draining after the stream closes.
  const liveAssistant = lastMessage?.role === "assistant" ? lastMessage : null;
  const smoothedContent = useSmoothText(
    liveAssistant ? (lastResponse?.content ?? "") : "",
    messages.length,
    isStreaming && liveAssistant !== null,
  );
  const isRevealing =
    liveAssistant !== null &&
    smoothedContent.length < (lastResponse?.content.length ?? 0);

  // Follow new content only while the user hasn't scrolled up to read;
  // their own new message always snaps the view back down.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (pinnedRef.current || lastMessage?.role === "user") {
      pinnedRef.current = true;
      const bottom = container.scrollHeight - container.clientHeight;
      if (container.scrollTop < bottom) container.scrollTop = bottom;
    }
  }, [
    messages.length,
    lastContent,
    smoothedContent,
    isStreaming,
    lastMessage?.role,
  ]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    pinnedRef.current = scrollHeight - scrollTop - clientHeight < PIN_THRESHOLD;
  };

  const awaitingReply =
    isStreaming && (!lastMessage || lastMessage.role === "user");

  if (messages.length === 0 && !awaitingReply) return null;

  return (
    <div
      ref={scrollRef}
      className="conversation-scroller"
      onScroll={handleScroll}
      style={styles.scroller}
      aria-live="polite"
    >
      <div style={styles.list}>
        {messages.map((message, index) => {
          const response = responses[index];
          if (!response) return null;
          const isRevealTarget =
            index === messages.length - 1 && message.role === "assistant";
          const staggerDelay =
            index < initialCount ? `${Math.min(index * 60, 300)}ms` : undefined;

          return (
            <div
              key={index}
              className={`bubble ${
                message.role === "user" ? "bubble-user" : "bubble-assistant"
              }`}
              style={
                staggerDelay ? { animationDelay: staggerDelay } : undefined
              }
            >
              <MessageMarkdown
                content={
                  message.role === "user"
                    ? message.content
                    : isRevealTarget && (isStreaming || isRevealing)
                      ? smoothedContent
                      : response.content
                }
              />
              {isRevealTarget && (isStreaming || isRevealing) && (
                <span className="stream-cursor" aria-hidden="true">
                  ▌
                </span>
              )}
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

const styles: Record<string, CSSProperties> = {
  scroller: {
    flex: 1,
    minHeight: 0,
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
