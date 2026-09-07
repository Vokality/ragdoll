import { useState } from "react";
import {
  sourceCitationSchema,
  type SourceCitation,
} from "../../electron/electron-api";

export function SourcePills({
  sources,
}: {
  sources: readonly SourceCitation[];
}) {
  const safeSources = sources.filter(
    (source) => sourceCitationSchema.safeParse(source).success,
  );
  if (!safeSources.length) return null;
  return (
    <div className="source-pills" aria-label="Sources">
      {safeSources.map((source) => (
        <a
          key={source.url}
          className="source-pill"
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${source.title} — ${new URL(source.url).hostname}`}
        >
          <SourceIcon
            key={new URL(source.url).origin}
            origin={new URL(source.url).origin}
          />
          <span>{source.title}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M4 12 12 4M4 4h8v8" />
          </svg>
        </a>
      ))}
    </div>
  );
}

function SourceIcon({ origin }: { origin: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" />
    </svg>
  ) : (
    <img
      className="source-favicon"
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(origin).hostname)}&sz=32`}
      width="14"
      height="14"
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
