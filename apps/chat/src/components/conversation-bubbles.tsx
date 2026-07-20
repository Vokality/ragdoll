import { useEffect, useRef, type CSSProperties, type UIEvent } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
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
  const initialCountRef = useRef<number | null>(null);
  if (initialCountRef.current === null) {
    initialCountRef.current = messages.length;
  }
  const initialCount = initialCountRef.current;

  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the user is at (or near) the bottom. Starts pinned.
  const pinnedRef = useRef(true);

  const lastMessage = messages[messages.length - 1];
  const lastContent = lastMessage?.content ?? "";

  // Follow new content only while the user hasn't scrolled up to read;
  // their own new message always snaps the view back down.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (pinnedRef.current || lastMessage?.role === "user") {
      pinnedRef.current = true;
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length, lastContent, isStreaming, lastMessage?.role]);

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
      onScroll={handleScroll}
      style={styles.scroller}
      aria-live="polite"
    >
      <div style={styles.list}>
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;
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
              {message.content}
              {isStreaming &&
                isLastMessage &&
                message.role === "assistant" && (
                  <span className="stream-cursor" aria-hidden="true">
                    ▌
                  </span>
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
    maxWidth: "440px",
    overflowY: "auto",
    marginTop: "8px",
    padding: "4px 12px 16px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%",
  },
};
