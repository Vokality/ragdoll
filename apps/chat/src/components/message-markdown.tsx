import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import "./message-markdown.css";

const plugins = [remarkGfm];

function safeMessageUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.href;
  } catch {
    // Relative links have no remote document base in a chat message.
  }
  return undefined;
}

const components: Components = {
  a: ({ href, children }) =>
    href ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  // A message may reference an image without making an automatic remote request.
  img: ({ src, alt }) =>
    typeof src === "string" && src ? (
      <a href={src} target="_blank" rel="noopener noreferrer">
        {alt || "View image"}
      </a>
    ) : (
      <span>{alt || "Image"}</span>
    ),
  pre: ({ children }) => (
    <pre tabIndex={0} aria-label="Code block">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div
      className="message-table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Table"
    >
      <table>{children}</table>
    </div>
  ),
};

/** Shared by both roles and the live stream; raw HTML is never executed. */
export const MessageMarkdown = memo(function MessageMarkdown({
  content,
}: {
  content: string;
}) {
  return (
    <div className="message-markdown">
      <Markdown
        remarkPlugins={plugins}
        components={components}
        urlTransform={safeMessageUrl}
        skipHtml
      >
        {content}
      </Markdown>
    </div>
  );
});
