import { useState } from "react";
import { Icon } from "./ui/icons";
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
          <Icon name="external" size={10} />
        </a>
      ))}
    </div>
  );
}

function SourceIcon({ origin }: { origin: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <Icon name="globe" size={12} />
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
