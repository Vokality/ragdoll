/**
 * SlotBar - Container component for rendering extension UI slot buttons.
 *
 * Displays a row of slot buttons and manages the active slot panel.
 */

import { useState, useCallback, useMemo, type CSSProperties } from "react";
import { SlotButton } from "./slot-button.js";
import { SlotPanelBase } from "./slot-panel.js";
import { useVisibleSlots } from "./hooks.js";
import type { ExtensionUISlot } from "./types.js";

// =============================================================================
// SlotBar Component
// =============================================================================

export interface SlotBarProps {
  /** Array of slots to display */
  slots: ExtensionUISlot[];
  /** Optional additional class name */
  className?: string;
  /** Optional inline styles for the container */
  style?: CSSProperties;
}

/**
 * Container component that renders a row of extension UI slot buttons.
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

  // Get visible slots sorted by priority
  const visibleSlots = useVisibleSlots(slots);

  // Find the active slot
  const activeSlot = useMemo(() => {
    if (!activeSlotId) return null;
    return visibleSlots.find((s) => s.id === activeSlotId) ?? null;
  }, [visibleSlots, activeSlotId]);

  // Auto-close panel if active slot becomes invisible
  useMemo(() => {
    if (activeSlotId && !visibleSlots.some((s) => s.id === activeSlotId)) {
      setActiveSlotId(null);
    }
  }, [activeSlotId, visibleSlots]);

  const handleSlotClick = useCallback((slotId: string) => {
    setActiveSlotId((current) => (current === slotId ? null : slotId));
  }, []);

  const handleClosePanel = useCallback(() => {
    setActiveSlotId(null);
  }, []);

  // Don't render if no visible slots
  if (visibleSlots.length === 0) {
    return null;
  }

  return (
    <>
      <div style={{ ...styles.container, ...style }} className={className}>
        {visibleSlots.map((slot) => (
          <SlotButton
            key={slot.id}
            slot={slot}
            isActive={slot.id === activeSlotId}
            onClick={() => handleSlotClick(slot.id)}
          />
        ))}
      </div>

      {/* Render active slot's panel */}
      {activeSlot && (
        <SlotPanelBase
          isOpen={true}
          onClose={handleClosePanel}
          panel={activeSlot.state.getState().panel}
        />
      )}
    </>
  );
}

// =============================================================================
// Controlled SlotBar Component
// =============================================================================

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
 *       {activeSlotId && (
 *         <MyCustomPanel
 *           slot={slots.find(s => s.id === activeSlotId)}
 *           onClose={() => setActiveSlotId(null)}
 *         />
 *       )}
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
  // Get visible slots sorted by priority
  const visibleSlots = useVisibleSlots(slots);

  const handleSlotClick = useCallback(
    (slotId: string) => {
      onSlotClick(activeSlotId === slotId ? null : slotId);
    },
    [activeSlotId, onSlotClick]
  );

  // Don't render if no visible slots
  if (visibleSlots.length === 0) {
    return null;
  }

  return (
    <div style={{ ...styles.container, ...style }} className={className}>
      {visibleSlots.map((slot) => (
        <SlotButton
          key={slot.id}
          slot={slot}
          isActive={slot.id === activeSlotId}
          onClick={() => handleSlotClick(slot.id)}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
};
