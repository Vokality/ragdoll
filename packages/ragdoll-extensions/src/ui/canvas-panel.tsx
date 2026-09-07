import { useId } from "react";
import { type CanvasDocument, type CanvasElement } from "../canvas.js";

function Element({ element }: { element: CanvasElement }) {
  const paint = {
    fill: element.fill,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
    opacity: element.opacity,
  };
  switch (element.type) {
    case "rect":
      return (
        <rect
          {...paint}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rx={element.radius}
        />
      );
    case "ellipse":
      return (
        <ellipse
          {...paint}
          cx={element.cx}
          cy={element.cy}
          rx={element.rx}
          ry={element.ry}
        />
      );
    case "path":
      return (
        <path
          {...paint}
          d={element.d}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "text":
      return (
        <text
          {...paint}
          x={element.x}
          y={element.y}
          fontSize={element.fontSize}
          fontFamily="sans-serif"
          textAnchor={element.anchor}
        >
          {element.text}
        </text>
      );
  }
}

/** Fits an editable vector document into the host's available content region. */
export function CanvasPanel({ document }: { document: CanvasDocument }) {
  const titleId = useId();
  return (
    <div
      className="slot-panel-canvas"
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        padding: "8px 12px 12px",
        display: "flex",
        position: "relative",
      }}
    >
      <svg
        role="img"
        aria-labelledby={titleId}
        viewBox={`0 0 ${document.width} ${document.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          display: "block",
          borderRadius: 8,
        }}
      >
        <title id={titleId}>{document.title}</title>
        <rect
          width={document.width}
          height={document.height}
          fill={document.background}
        />
        {document.elements.map((element) => (
          <Element key={element.id} element={element} />
        ))}
      </svg>
      {document.elements.length === 0 && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            color: "var(--text-secondary, #94a3b8)",
            fontSize: 12,
          }}
        >
          Ask me to draw something
        </span>
      )}
    </div>
  );
}
