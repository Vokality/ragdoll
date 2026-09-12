/**
 * Slot dock folder — collapsed stack of slot icons that expands like an iOS folder.
 */

import {
  createElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { SlotButton } from "./slot-button.js";
import { getSlotIcon } from "./slot-icons.js";
import { combineSlotBadges } from "./combine-slot-badges.js";
import type { ExtensionUISlot } from "./types.js";

const FOLDER_PREVIEW_COUNT = 3;
const FOLDER_LABEL = "Cards";

export interface SlotDockProps {
  slots: ExtensionUISlot[];
  activeSlotId: string | null;
  onSlotClick: (slotId: string) => void;
  className?: string;
  style?: CSSProperties;
}

function formatBadge(badge: number | string | null): string {
  if (badge === null) return "";
  if (typeof badge === "number") {
    return badge > 99 ? "99+" : String(badge);
  }
  return badge;
}

export function SlotDock({
  slots,
  activeSlotId,
  onSlotClick,
  className,
  style,
}: SlotDockProps) {
  const trayId = useId();
  const [open, setOpen] = useState(false);
  const useFolder = slots.length > 1;
  const badge = useCombinedBadge(slots);
  if (!useFolder && open) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing)
        return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  const handleSlotClick = useCallback(
    (slotId: string) => {
      setOpen(false);
      onSlotClick(slotId);
    },
    [onSlotClick],
  );

  const previewSlots = slots.slice(0, FOLDER_PREVIEW_COUNT);
  const hasBadge = badge !== null && badge !== 0;
  const folderOpen = useFolder && open;

  return (
    <div
      style={{ ...styles.dock, ...style }}
      className={["extension-slot-dock", className].filter(Boolean).join(" ")}
      data-folder={useFolder ? "true" : "false"}
      data-open={folderOpen ? "true" : "false"}
    >
      <style>{folderStyles}</style>
      {useFolder && (
        <div
          className="extension-slot-folder-backdrop"
          hidden={!folderOpen}
          onClick={() => setOpen(false)}
        />
      )}
      {useFolder && (
        <button
          type="button"
          className={`extension-slot-folder${folderOpen ? " open" : ""}`}
          aria-label={
            hasBadge ? `${FOLDER_LABEL}, ${formatBadge(badge)}` : FOLDER_LABEL
          }
          aria-haspopup="true"
          aria-expanded={folderOpen}
          aria-controls={trayId}
          title={FOLDER_LABEL}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="extension-slot-folder-stack" aria-hidden="true">
            {previewSlots.map((slot, index) => {
              const offset = index - (previewSlots.length - 1) / 2;
              return (
                <span
                  key={slot.id}
                  className="extension-slot-folder-tile"
                  style={{
                    zIndex: previewSlots.length - index,
                    transform: `translate(${offset * 5}px, ${Math.abs(offset) * 1.5}px) rotate(${offset * 11}deg)`,
                  }}
                >
                  {createElement(getSlotIcon(slot.icon), { size: 10 })}
                </span>
              );
            })}
          </span>
          {hasBadge && (
            <span className="extension-slot-folder-badge">
              {formatBadge(badge)}
            </span>
          )}
        </button>
      )}
      <div
        id={trayId}
        className="extension-slot-tray"
        role="toolbar"
        aria-label={FOLDER_LABEL}
        aria-hidden={useFolder && !folderOpen ? true : undefined}
      >
        {slots.map((slot) => (
          <div key={slot.id} className="extension-slot-tray-item">
            <SlotButton
              slot={slot}
              isActive={slot.id === activeSlotId}
              onClick={() => handleSlotClick(slot.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function useCombinedBadge(
  slots: ExtensionUISlot[],
): number | string | null {
  const cacheRef = useRef<number | string | null>(null);
  const subscribe = useCallback(
    (callback: () => void) => {
      const unsubscribes = slots.map((slot) => slot.state.subscribe(callback));
      return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    },
    [slots],
  );
  const getSnapshot = useCallback(() => {
    const next = combineSlotBadges(
      slots.map((slot) => slot.state.getState().badge),
    );
    if (cacheRef.current !== next) cacheRef.current = next;
    return cacheRef.current;
  }, [slots]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const styles: Record<string, CSSProperties> = {
  dock: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
};

const folderStyles = `
  .extension-slot-folder-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    margin: 0;
    padding: 0;
    border: 0;
    background: rgba(2, 6, 16, 0.42);
    cursor: default;
    animation: extensionSlotFolderFade 180ms ease;
  }

  .extension-slot-folder-backdrop[hidden] {
    display: none;
  }

  .extension-slot-folder {
    position: relative;
    z-index: 41;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--slot-button-size, 40px);
    height: var(--slot-button-size, 40px);
    padding: 0;
    flex-shrink: 0;
    border-radius: var(--radius-md, 10px);
    background: var(--bg-glass, rgba(30, 41, 59, 0.8));
    border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
    color: var(--text-muted, #94a3b8);
    cursor: pointer;
    transition:
      color 150ms ease,
      background 150ms ease,
      border-color 150ms ease,
      transform 150ms ease;
  }

  .extension-slot-folder:hover,
  .extension-slot-folder.open {
    color: var(--text-primary, #f1f5f9);
    background: var(--bg-glass-light, rgba(51, 65, 85, 0.6));
    border-color: var(--accent, #5a9bc4);
  }

  .extension-slot-folder.open {
    background: var(--accent-glow, rgba(90, 155, 196, 0.3));
    color: var(--accent, #5a9bc4);
  }

  .extension-slot-folder-stack {
    position: relative;
    width: 22px;
    height: 18px;
  }

  .extension-slot-folder-tile {
    position: absolute;
    top: 1px;
    left: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 5px;
    background: var(--bg-secondary, #101828);
    border: 1px solid var(--border-strong, rgba(148, 163, 184, 0.35));
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  }

  .extension-slot-folder-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    max-width: 36px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--bg-primary, #0f172a);
    background-color: var(--accent, #5a9bc4);
    border-radius: 10px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .extension-slot-tray {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--slot-button-gap, 12px);
  }

  .extension-slot-dock[data-folder="true"] .extension-slot-tray {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 42;
    width: max-content;
    max-width: min(248px, calc(100vw - 24px));
    padding: 10px;
    border-radius: 16px;
    background: var(--bg-secondary, #101828);
    border: 1px solid var(--border-strong, rgba(148, 173, 202, 0.3));
    box-shadow: var(--shadow-lg, 0 24px 48px -12px rgba(2, 6, 16, 0.55));
    transform-origin: top right;
    transition:
      transform 280ms cubic-bezier(0.32, 0.72, 0, 1),
      opacity 180ms ease,
      visibility 180ms ease;
  }

  .extension-slot-dock[data-folder="true"][data-open="false"] .extension-slot-tray {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: scale(0.42);
  }

  .extension-slot-dock[data-folder="true"][data-open="true"] .extension-slot-tray {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: scale(1);
  }

  .extension-slot-tray-item {
    display: flex;
    flex-shrink: 0;
  }

  @keyframes extensionSlotFolderFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .extension-slot-folder-backdrop,
    .extension-slot-dock[data-folder="true"] .extension-slot-tray {
      animation: none;
      transition: none;
    }
  }
`;
