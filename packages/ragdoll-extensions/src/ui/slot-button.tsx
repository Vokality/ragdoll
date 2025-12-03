/**
 * SlotButton - Renders an extension UI slot as a clickable button with badge.
 */

import { type CSSProperties } from "react";
import { useSlotState } from "./hooks.js";
import { getSlotIcon } from "./slot-icons.js";
import type { ExtensionUISlot, SlotButtonProps } from "./types.js";

/**
 * Button component for an extension UI slot.
 *
 * Displays the slot's icon with an optional badge showing count/status.
 * Subscribes to the slot's state for reactive updates.
 *
 * @example
 * ```tsx
 * <SlotButton
 *   slot={taskSlot}
 *   isActive={activeSlotId === taskSlot.id}
 *   onClick={() => setActiveSlotId(taskSlot.id)}
 * />
 * ```
 */
export function SlotButton({ slot, isActive = false, onClick }: SlotButtonProps) {
  const state = useSlotState(slot);

  // Don't render if slot is not visible
  if (!state.visible) {
    return null;
  }

  const IconComponent = getSlotIcon(slot.icon);
  const hasBadge = state.badge !== null && state.badge !== 0;

  return (
    <>
      <style>{`
        @keyframes slotButtonEnter {
          from {
            opacity: 0;
            transform: scale(0.8) translateY(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes slotBadgePop {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }

        .extension-slot-button {
          animation: slotButtonEnter 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .extension-slot-button:hover {
          color: var(--text-primary, #f1f5f9);
          background: var(--bg-glass-light, rgba(51, 65, 85, 0.6));
          border-color: var(--accent, #5a9bc4);
          transform: translateY(-1px);
        }

        .extension-slot-button:active {
          transform: translateY(0) scale(0.98);
        }

        .extension-slot-button.active {
          color: var(--accent, #5a9bc4);
          border-color: var(--accent, #5a9bc4);
          background: var(--accent-glow, rgba(90, 155, 196, 0.3));
        }

        .extension-slot-badge {
          animation: slotBadgePop 300ms cubic-bezier(0.34, 1.56, 0.64, 1) 100ms backwards;
        }
      `}</style>
      <button
        onClick={onClick}
        style={styles.button}
        className={`extension-slot-button ${isActive ? "active" : ""}`}
        aria-label={slot.label}
        aria-pressed={isActive}
        title={slot.label}
      >
        <IconComponent size={20} />
        {hasBadge && (
          <span style={styles.badge} className="extension-slot-badge">
            {formatBadge(state.badge)}
          </span>
        )}
      </button>
    </>
  );
}

/**
 * Format badge content for display
 */
function formatBadge(badge: number | string | null): string {
  if (badge === null) return "";
  if (typeof badge === "number") {
    return badge > 99 ? "99+" : String(badge);
  }
  return badge;
}

/**
 * Minimal slot button without state subscription.
 * Use this when you're managing state externally.
 */
export function SlotButtonStateless({
  icon,
  label,
  badge,
  isActive = false,
  onClick,
}: {
  icon: ExtensionUISlot["icon"];
  label: string;
  badge?: number | string | null;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const IconComponent = getSlotIcon(icon);
  const hasBadge = badge !== null && badge !== undefined && badge !== 0;

  return (
    <>
      <style>{`
        @keyframes slotButtonEnter {
          from {
            opacity: 0;
            transform: scale(0.8) translateY(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes slotBadgePop {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }

        .extension-slot-button {
          animation: slotButtonEnter 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .extension-slot-button:hover {
          color: var(--text-primary, #f1f5f9);
          background: var(--bg-glass-light, rgba(51, 65, 85, 0.6));
          border-color: var(--accent, #5a9bc4);
          transform: translateY(-1px);
        }

        .extension-slot-button:active {
          transform: translateY(0) scale(0.98);
        }

        .extension-slot-button.active {
          color: var(--accent, #5a9bc4);
          border-color: var(--accent, #5a9bc4);
          background: var(--accent-glow, rgba(90, 155, 196, 0.3));
        }

        .extension-slot-badge {
          animation: slotBadgePop 300ms cubic-bezier(0.34, 1.56, 0.64, 1) 100ms backwards;
        }
      `}</style>
      <button
        onClick={onClick}
        style={styles.button}
        className={`extension-slot-button ${isActive ? "active" : ""}`}
        aria-label={label}
        aria-pressed={isActive}
        title={label}
      >
        <IconComponent size={20} />
        {hasBadge && (
          <span style={styles.badge} className="extension-slot-badge">
            {formatBadge(badge!)}
          </span>
        )}
      </button>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  button: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: "var(--radius-md, 10px)",
    background: "var(--bg-glass, rgba(30, 41, 59, 0.8))",
    border: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
    color: "var(--text-muted, #94a3b8)",
    cursor: "pointer",
    transition:
      "color 150ms ease, background 150ms ease, border-color 150ms ease, transform 150ms ease",
    flexShrink: 0,
    padding: 0,
  },
  badge: {
    position: "absolute",
    top: "-6px",
    right: "-6px",
    minWidth: "20px",
    height: "20px",
    padding: "0 6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "600",
    color: "var(--bg-primary, #0f172a)",
    backgroundColor: "var(--accent, #5a9bc4)",
    borderRadius: "10px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
  },
};
