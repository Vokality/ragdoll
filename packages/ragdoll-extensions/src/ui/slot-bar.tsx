/**
 * SlotBar - Container for extension UI slot buttons.
 *
 * Two or more visible slots collapse into a Cards folder. Clicking the folder
 * expands the icons; choosing a card closes the folder again.
 */

import { useState, useCallback, useMemo, type CSSProperties } from "react";
import { SlotPanel } from "./slot-panel.js";
import { SlotDock } from "./slot-folder.js";
import { useVisibleSlots } from "./hooks.js";
import type { ExtensionUISlot } from "./types.js";

export interface SlotBarProps {
  /** Array of slots to display */
  slots: ExtensionUISlot[];
  /** Optional additional class name */
  className?: string;
  /** Optional inline styles for the container */
  style?: CSSProperties;
}

/**
 * Container that renders extension UI slot buttons.
 *
 * Automatically filters to visible slots and sorts by priority.
 * Manages the active slot panel state internally.
 *
 * @example
 * ```tsx
 * const slots = [taskSlot, pomodoroSlot, notificationSlot];
 *
 * function App() {
 *   return (
 *     <div>
 *       <SlotBar slots={slots} />
 *     </div>
 *   );
 * }
 * ```
 */
export function SlotBar({ slots, className, style }: SlotBarProps) {
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  const visibleSlots = useVisibleSlots(slots);

  const activeSlot = useMemo(() => {
    if (!activeSlotId) return null;
    return visibleSlots.find((s) => s.id === activeSlotId) ?? null;
  }, [visibleSlots, activeSlotId]);

  const handleSlotClick = useCallback((slotId: string) => {
    setActiveSlotId((current) => (current === slotId ? null : slotId));
  }, []);

  const handleClosePanel = useCallback(() => {
    setActiveSlotId(null);
  }, []);

  if (visibleSlots.length === 0) {
    return null;
  }

  return (
    <>
      <SlotDock
        slots={visibleSlots}
        activeSlotId={activeSlotId}
        onSlotClick={handleSlotClick}
        className={className}
        style={style}
      />

      {activeSlot && (
        <SlotPanel
          key={activeSlot.id}
          slot={activeSlot}
          onClose={handleClosePanel}
        />
      )}
    </>
  );
}

export interface ControlledSlotBarProps {
  /** Array of slots to display */
  slots: ExtensionUISlot[];
  /** Currently active slot ID (controlled) */
  activeSlotId: string | null;
  /** Called when a slot is clicked */
  onSlotClick: (slotId: string | null) => void;
  /** Optional additional class name */
  className?: string;
  /** Optional inline styles for the container */
  style?: CSSProperties;
}

/**
 * Controlled version of SlotBar where active state is managed externally.
 *
 * Use this when you need to control the active slot from outside the component.
 *
 * @example
 * ```tsx
 * function App() {
 *   const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
 *
 *   return (
 *     <>
 *       <ControlledSlotBar
 *         slots={slots}
 *         activeSlotId={activeSlotId}
 *         onSlotClick={setActiveSlotId}
 *       />
 *       {activeSlotId && <span>Active slot: {activeSlotId}</span>}
 *     </>
 *   );
 * }
 * ```
 */
export function ControlledSlotBar({
  slots,
  activeSlotId,
  onSlotClick,
  className,
  style,
}: ControlledSlotBarProps) {
  const visibleSlots = useVisibleSlots(slots);

  const handleSlotClick = useCallback(
    (slotId: string) => {
      onSlotClick(activeSlotId === slotId ? null : slotId);
    },
    [activeSlotId, onSlotClick],
  );

  if (visibleSlots.length === 0) {
    return null;
  }

  return (
    <SlotDock
      slots={visibleSlots}
      activeSlotId={activeSlotId}
      onSlotClick={handleSlotClick}
      className={className}
      style={style}
    />
  );
}
