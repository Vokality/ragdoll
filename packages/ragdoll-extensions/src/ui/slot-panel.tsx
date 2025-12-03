/**
 * SlotPanel - Renders an extension UI slot's panel as a bottom sheet.
 *
 * Supports both list-based panels (with items, sections, actions)
 * and custom panels (with a React component).
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
} from "react";
import { useSlotState } from "./hooks.js";
import type {
  SlotPanelProps,
  PanelConfig,
  ListPanelConfig,
  ListPanelItem,
  ListPanelSection,
  PanelAction,
  ItemStatus,
} from "./types.js";

// =============================================================================
// Animation Constants
// =============================================================================

const ANIMATION_DURATION = 250;

type AnimationState = "entering" | "visible" | "exiting" | "hidden";

// =============================================================================
// Main SlotPanel Component
// =============================================================================

/**
 * Panel component for an extension UI slot.
 *
 * Renders as a bottom sheet with the slot's panel configuration.
 * Handles both list-based and custom panel types.
 */
export function SlotPanel({ slot, onClose }: SlotPanelProps) {
  const state = useSlotState(slot);

  return (
    <SlotPanelBase
      isOpen={true}
      onClose={onClose}
      panel={state.panel}
    />
  );
}

// =============================================================================
// Base Panel Component (for direct use without slot)
// =============================================================================

interface SlotPanelBaseProps {
  isOpen: boolean;
  onClose: () => void;
  panel: PanelConfig;
}

/**
 * Base panel component that can be used directly with a panel config.
 */
export function SlotPanelBase({ isOpen, onClose, panel }: SlotPanelBaseProps) {
  const [animationState, setAnimationState] = useState<AnimationState>("hidden");
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle open/close with animation states
  useEffect(() => {
    if (isOpen) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      if (animationState === "hidden" || animationState === "exiting") {
        setAnimationState("entering");
        requestAnimationFrame(() => {
          setAnimationState("visible");
        });
      }
    } else {
      if (animationState === "visible" || animationState === "entering") {
        setAnimationState("exiting");
        exitTimerRef.current = setTimeout(() => {
          setAnimationState("hidden");
          exitTimerRef.current = null;
        }, ANIMATION_DURATION);
      }
    }

    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [isOpen, animationState]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Don't render if fully hidden
  if (animationState === "hidden") {
    return null;
  }

  const isExiting = animationState === "exiting";

  return (
    <>
      <style>{panelStyles}</style>

      {/* Backdrop */}
      <div
        className={`slot-panel-backdrop ${isExiting ? "exiting" : ""}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div className={`slot-panel-sheet ${isExiting ? "exiting" : ""}`}>
        {/* Handle */}
        <div style={styles.handleWrapper}>
          <div style={styles.handle} />
        </div>

        {/* Render based on panel type */}
        {panel.type === "list" ? (
          <ListPanel config={panel} onClose={handleClose} />
        ) : (
          <CustomPanel config={panel} onClose={handleClose} />
        )}
      </div>
    </>
  );
}

// =============================================================================
// List Panel Renderer
// =============================================================================

interface ListPanelProps {
  config: ListPanelConfig;
  onClose: () => void;
}

function ListPanel({ config, onClose }: ListPanelProps) {
  const { title, emptyMessage, emptyIcon, items, sections, actions } = config;

  const hasItems = (items && items.length > 0) || (sections && sections.some(s => s.items.length > 0));

  return (
    <>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        <button
          onClick={onClose}
          style={styles.closeButton}
          className="slot-panel-close"
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {!hasItems ? (
          <div style={styles.emptyState}>
            {emptyIcon && <span style={styles.emptyIcon}>{emptyIcon}</span>}
            <p style={styles.emptyText}>{emptyMessage ?? "No items"}</p>
          </div>
        ) : sections ? (
          // Render sections
          sections.map((section) => (
            <PanelSection key={section.id} section={section} />
          ))
        ) : items ? (
          // Render flat list
          <ul style={styles.itemList}>
            {items.map((item, index) => (
              <PanelItem key={item.id} item={item} index={index} />
            ))}
          </ul>
        ) : null}

        {/* Panel-level actions */}
        {actions && actions.length > 0 && (
          <div style={styles.actions}>
            {actions.map((action) => (
              <ActionButton key={action.id} action={action} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// =============================================================================
// Custom Panel Renderer
// =============================================================================

interface CustomPanelProps {
  config: { type: "custom"; title?: string; component: React.ComponentType<{ onClose: () => void }> };
  onClose: () => void;
}

function CustomPanel({ config, onClose }: CustomPanelProps) {
  const { title, component: CustomComponent } = config;

  return (
    <>
      {/* Optional header for custom panels */}
      {title && (
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button
            onClick={onClose}
            style={styles.closeButton}
            className="slot-panel-close"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* Custom content */}
      <div style={styles.customContent}>
        <CustomComponent onClose={onClose} />
      </div>
    </>
  );
}

// =============================================================================
// Panel Section Component
// =============================================================================

interface PanelSectionProps {
  section: ListPanelSection;
}

function PanelSection({ section }: PanelSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(section.defaultCollapsed ?? false);

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3
          style={{
            ...styles.sectionTitle,
            cursor: section.collapsible ? "pointer" : "default",
          }}
          onClick={section.collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
        >
          {section.collapsible && (
            <span style={{ marginRight: "8px" }}>{isCollapsed ? "▸" : "▾"}</span>
          )}
          {section.title} ({section.items.length})
        </h3>
        {section.actions && (
          <div style={styles.sectionActions}>
            {section.actions.map((action) => (
              <button
                key={action.id}
                onClick={action.onClick}
                disabled={action.disabled}
                style={styles.sectionActionButton}
                className="slot-panel-section-action"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isCollapsed && (
        <ul style={styles.itemList}>
          {section.items.map((item, index) => (
            <PanelItem key={item.id} item={item} index={index} />
          ))}
        </ul>
      )}
    </section>
  );
}

// =============================================================================
// Panel Item Component
// =============================================================================

interface PanelItemProps {
  item: ListPanelItem;
  index: number;
}

function PanelItem({ item, index }: PanelItemProps) {
  const statusStyle = getStatusStyle(item.status);

  return (
    <li
      className="slot-panel-item"
      style={{
        ...styles.item,
        ...statusStyle,
        animationDelay: `${index * 50}ms`,
      }}
    >
      {item.checkable && (
        <button
          onClick={item.onToggle}
          style={{
            ...styles.checkbox,
            ...(item.checked && styles.checkboxChecked),
          }}
          className="slot-panel-checkbox"
          aria-label={item.checked ? "Mark as incomplete" : "Mark as complete"}
        >
          {item.checked && <CheckIcon />}
        </button>
      )}

      {item.mediaUrl && (
        <img
          src={item.mediaUrl}
          alt={item.mediaAlt ?? ""}
          style={styles.itemMedia}
        />
      )}

      <div
        style={styles.itemContent}
        className={item.onClick ? "slot-panel-item-clickable" : undefined}
        onClick={item.onClick}
      >
        <span
          style={{
            ...styles.itemLabel,
            ...(item.checked && styles.itemLabelChecked),
          }}
        >
          {item.label}
        </span>
        {item.sublabel && <span style={styles.itemSublabel}>{item.sublabel}</span>}
      </div>
    </li>
  );
}

// =============================================================================
// Action Button Component
// =============================================================================

interface ActionButtonProps {
  action: PanelAction;
}

function ActionButton({ action }: ActionButtonProps) {
  const variantStyle = getActionVariantStyle(action.variant);

  return (
    <button
      onClick={action.onClick}
      disabled={action.disabled}
      style={{ ...styles.actionButton, ...variantStyle }}
      className="slot-panel-action"
    >
      {action.label}
    </button>
  );
}

// =============================================================================
// Icons
// =============================================================================

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// =============================================================================
// Style Helpers
// =============================================================================

function getStatusStyle(status?: ItemStatus): CSSProperties {
  switch (status) {
    case "active":
      return {
        borderColor: "var(--accent, #5a9bc4)",
        boxShadow: "0 0 0 1px var(--accent-glow, rgba(90, 155, 196, 0.3)), 0 0 12px var(--accent-glow, rgba(90, 155, 196, 0.3))",
      };
    case "success":
      return {
        borderColor: "var(--success, #4ade80)",
        backgroundColor: "var(--success-dim, rgba(74, 222, 128, 0.2))",
      };
    case "warning":
      return {
        borderColor: "var(--warning, #fbbf24)",
        backgroundColor: "rgba(251, 191, 36, 0.1)",
      };
    case "error":
      return {
        borderColor: "var(--error, #f87171)",
        backgroundColor: "var(--error-dim, rgba(248, 113, 113, 0.2))",
      };
    default:
      return {};
  }
}

function getActionVariantStyle(variant?: PanelAction["variant"]): CSSProperties {
  switch (variant) {
    case "primary":
      return {
        backgroundColor: "var(--accent, #5a9bc4)",
        color: "var(--bg-primary, #0f172a)",
      };
    case "danger":
      return {
        backgroundColor: "var(--error-dim, rgba(248, 113, 113, 0.2))",
        color: "var(--error, #f87171)",
        borderColor: "var(--error, #f87171)",
      };
    default:
      return {};
  }
}

// =============================================================================
// CSS Styles (as string for animations)
// =============================================================================

const panelStyles = `
  @keyframes slotPanelSlideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  @keyframes slotPanelSlideDown {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(100%);
    }
  }

  @keyframes slotPanelBackdropFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slotPanelBackdropFadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  @keyframes slotPanelItemFadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .slot-panel-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 100;
    animation: slotPanelBackdropFadeIn ${ANIMATION_DURATION}ms ease-out forwards;
  }

  .slot-panel-backdrop.exiting {
    animation: slotPanelBackdropFadeOut ${ANIMATION_DURATION}ms ease-out forwards;
  }

  .slot-panel-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 70vh;
    background-color: var(--bg-secondary, #1e293b);
    border-top-left-radius: var(--radius-xl, 24px);
    border-top-right-radius: var(--radius-xl, 24px);
    border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
    border-bottom: none;
    z-index: 101;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.3);
    animation: slotPanelSlideUp ${ANIMATION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
  }

  .slot-panel-sheet.exiting {
    animation: slotPanelSlideDown ${ANIMATION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
  }

  .slot-panel-item {
    animation: slotPanelItemFadeIn 200ms ease-out backwards;
  }

  .slot-panel-close:hover {
    color: var(--text-primary, #f1f5f9);
    background: var(--bg-glass, rgba(30, 41, 59, 0.8));
  }

  .slot-panel-section-action:hover {
    color: var(--text-primary, #f1f5f9);
    background: var(--bg-glass, rgba(30, 41, 59, 0.8));
  }

  .slot-panel-checkbox:hover {
    border-color: var(--accent, #5a9bc4);
  }

  .slot-panel-item-clickable:hover {
    background: var(--bg-glass-light, rgba(51, 65, 85, 0.6));
    border-radius: var(--radius-sm, 6px);
  }

  .slot-panel-action:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .slot-panel-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// =============================================================================
// Inline Styles
// =============================================================================

const styles: Record<string, CSSProperties> = {
  handleWrapper: {
    display: "flex",
    justifyContent: "center",
    padding: "12px 0 4px",
  },
  handle: {
    width: "36px",
    height: "4px",
    backgroundColor: "var(--bg-tertiary, #334155)",
    borderRadius: "2px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 20px 16px",
    borderBottom: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
    flexShrink: 0,
  },
  title: {
    fontSize: "18px",
    fontWeight: "600",
    color: "var(--text-primary, #f1f5f9)",
    margin: 0,
  },
  closeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "var(--radius-md, 10px)",
    color: "var(--text-muted, #94a3b8)",
    cursor: "pointer",
    transition: "color 150ms ease, background 150ms ease",
    border: "none",
    background: "transparent",
    padding: 0,
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "16px 20px 24px",
  },
  customContent: {
    flex: 1,
    overflow: "auto",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "16px",
    opacity: 0.3,
  },
  emptyText: {
    fontSize: "16px",
    fontWeight: "500",
    color: "var(--text-muted, #94a3b8)",
    margin: 0,
  },
  section: {
    marginBottom: "24px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--text-dim, #64748b)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: 0,
    display: "flex",
    alignItems: "center",
  },
  sectionActions: {
    display: "flex",
    gap: "8px",
  },
  sectionActionButton: {
    fontSize: "12px",
    color: "var(--text-muted, #94a3b8)",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: "var(--radius-sm, 6px)",
    transition: "color 150ms ease, background 150ms ease",
    border: "none",
    background: "transparent",
  },
  itemList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "12px",
    backgroundColor: "var(--bg-glass, rgba(30, 41, 59, 0.8))",
    borderRadius: "var(--radius-md, 10px)",
    border: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
    transition: "border-color 150ms ease, box-shadow 150ms ease, background 150ms ease",
  },
  itemMedia: {
    width: "48px",
    height: "48px",
    borderRadius: "var(--radius-sm, 6px)",
    objectFit: "cover",
    flexShrink: 0,
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "6px",
    border: "2px solid var(--border, rgba(148, 163, 184, 0.2))",
    backgroundColor: "transparent",
    cursor: "pointer",
    flexShrink: 0,
    marginTop: "2px",
    transition: "border-color 150ms ease, background 150ms ease, transform 150ms ease",
    padding: 0,
  },
  checkboxChecked: {
    borderColor: "var(--success, #4ade80)",
    backgroundColor: "var(--success, #4ade80)",
    color: "var(--bg-primary, #0f172a)",
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
    cursor: "pointer",
    padding: "2px 4px",
    margin: "-2px -4px",
    transition: "background 150ms ease",
    borderRadius: "var(--radius-sm, 6px)",
  },
  itemLabel: {
    display: "block",
    fontSize: "14px",
    fontWeight: "500",
    color: "var(--text-primary, #f1f5f9)",
    lineHeight: "1.4",
    wordBreak: "break-word",
  },
  itemLabelChecked: {
    textDecoration: "line-through",
    color: "var(--text-dim, #64748b)",
  },
  itemSublabel: {
    display: "block",
    fontSize: "12px",
    color: "var(--text-muted, #94a3b8)",
    marginTop: "4px",
  },
  actions: {
    display: "flex",
    gap: "12px",
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
  },
  actionButton: {
    flex: 1,
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: "500",
    borderRadius: "var(--radius-md, 10px)",
    border: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
    backgroundColor: "var(--bg-glass, rgba(30, 41, 59, 0.8))",
    color: "var(--text-primary, #f1f5f9)",
    cursor: "pointer",
    transition: "opacity 150ms ease, transform 150ms ease",
  },
};
